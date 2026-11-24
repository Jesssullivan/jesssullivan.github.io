/**
 * Shared test helpers: the vendored contract fixtures, an in-memory hub, and
 * a signer for manifests this suite changes. Keys for re-signed manifests are
 * generated per run, so no secret lives in the repo.
 */
import { readFileSync } from 'node:fs';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { encodeBase64, plainBytes, sha256OfBytes } from '../src/bytes.ts';
import { canonicalJsonWithNull } from '../src/canonical.ts';
import { blobPath, headPath, manifestPath, signaturePath } from '../src/contract.ts';
import type { Manifest, Site } from '../src/contract.ts';
import type { FetchFunction } from '../src/fetch.ts';

export const TESTDATA = fileURLToPath(new URL('../testdata/', import.meta.url));
export const FIXTURES = join(TESTDATA, 'projection-v2', 'fixtures');

export interface ContractCase {
	readonly name: string;
	readonly overlay: string | null;
	readonly target: Site;
	readonly lastSeq: number;
	readonly manifest: string;
	readonly expect: readonly string[];
}

export const cases: readonly ContractCase[] = JSON.parse(
	readFileSync(join(FIXTURES, 'cases.json'), 'utf8'),
) as ContractCase[];

/** The published test key of the contract fixtures. It protects nothing. */
export const FIXTURE_PUBLIC_KEY: string = (
	JSON.parse(readFileSync(join(FIXTURES, 'TEST-ONLY-ed25519-key.json'), 'utf8')) as { publicKey: string }
).publicKey;

export const VALID_BLOG = 'fbce3ad37f64d9aee7cecc90a2dda1d6bba77f726bb73541b031cf08997e2ee3';

/**
 * Reads a public path from the fixture tree: the overlay first, then valid/.
 * It returns the Node Buffer as read, so every test also passes Buffers in.
 */
export function fixtureBytes(path: string, overlay: string | null = null): Uint8Array | null {
	for (const dir of overlay === null ? ['valid'] : [overlay, 'valid']) {
		try {
			return readFileSync(join(FIXTURES, dir, path));
		} catch {
			// Not in this layer.
		}
	}
	return null;
}

export const text = (value: string): Uint8Array => new TextEncoder().encode(value);

/** A served tree: public path to bytes. */
export type Tree = Map<string, Uint8Array>;

/** An in-memory hub over a tree. It counts every GET by path. */
export function memoryHub(
	tree: Tree,
	base = 'https://hub.test',
): { fetch: FetchFunction; gets: Map<string, number> } {
	const gets = new Map<string, number>();
	const fetch: FetchFunction = async (url) => {
		if (!url.startsWith(`${base}/`)) throw new Error(`unexpected URL ${url}`);
		const path = url.slice(base.length);
		gets.set(path, (gets.get(path) ?? 0) + 1);
		const bytes = tree.get(path);
		return bytes === undefined ? new Response(null, { status: 404 }) : new Response(plainBytes(bytes), { status: 200 });
	};
	return { fetch, gets };
}

/** The served tree of one fixture case, as the in-memory hub serves it. */
export function fixtureTree(target: Site, manifestSha256: string, overlay: string | null = null): Tree {
	const tree: Tree = new Map();
	const add = (path: string): Uint8Array | null => {
		const bytes = fixtureBytes(path, overlay);
		if (bytes !== null) tree.set(path, bytes);
		return bytes;
	};
	add(headPath(target));
	const manifest = add(manifestPath(target, manifestSha256));
	add(signaturePath(target, manifestSha256));
	if (manifest !== null) {
		for (const sha256 of new TextDecoder().decode(manifest).match(/[0-9a-f]{64}/g) ?? []) add(blobPath(sha256));
	}
	return tree;
}

export interface Signer {
	readonly publicKey: string;
	sign(bytes: Uint8Array): Promise<Uint8Array>;
}

/** A fresh ed25519 key pair for this run. */
export async function newSigner(): Promise<Signer> {
	const pair = (await globalThis.crypto.subtle.generateKey({ name: 'Ed25519' }, true, [
		'sign',
		'verify',
	])) as CryptoKeyPair;
	const raw = new Uint8Array(await globalThis.crypto.subtle.exportKey('raw', pair.publicKey));
	return {
		publicKey: encodeBase64(raw),
		async sign(bytes) {
			const signature = new Uint8Array(
				await globalThis.crypto.subtle.sign({ name: 'Ed25519' }, pair.privateKey, plainBytes(bytes)),
			);
			return text(encodeBase64(signature));
		},
	};
}

/** The valid blog manifest as a plain value, a fresh copy each call. */
export function validBlogManifest(): Manifest {
	const bytes = fixtureBytes(manifestPath('blog', VALID_BLOG));
	if (bytes === null) throw new Error('the valid blog manifest is missing');
	return JSON.parse(new TextDecoder().decode(bytes)) as Manifest;
}

export interface Signed {
	readonly bytes: Uint8Array;
	readonly signature: Uint8Array;
	readonly sha256: string;
}

/** Signs exact bytes, canonical or not. */
export async function signBytes(signer: Signer, bytes: Uint8Array): Promise<Signed> {
	return { bytes, signature: await signer.sign(bytes), sha256: await sha256OfBytes(bytes) };
}

/** Serializes a manifest canonically and signs it. */
export async function signManifest(signer: Signer, manifest: unknown): Promise<Signed> {
	return signBytes(signer, text(canonicalJsonWithNull(manifest)));
}

/** A blog tree served from the fixtures, with a re-signed manifest and extra blobs in place. */
export function treeWith(signed: Signed, extraBlobs: ReadonlyMap<string, Uint8Array> = new Map()): Tree {
	const tree = fixtureTree('blog', VALID_BLOG);
	tree.delete(manifestPath('blog', VALID_BLOG));
	tree.delete(signaturePath('blog', VALID_BLOG));
	tree.set(manifestPath('blog', signed.sha256), signed.bytes);
	tree.set(signaturePath('blog', signed.sha256), signed.signature);
	for (const [sha256, bytes] of extraBlobs) tree.set(blobPath(sha256), bytes);
	return tree;
}

/** A fresh scratch directory under the test temp root. */
export async function scratch(prefix: string): Promise<string> {
	return mkdtemp(join(process.env.TEST_TMPDIR ?? tmpdir(), `${prefix}-`));
}
