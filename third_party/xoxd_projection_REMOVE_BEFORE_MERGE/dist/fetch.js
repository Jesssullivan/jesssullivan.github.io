// Generated from src/ by tools/emit-js.ts. Edit the TypeScript source.
/**
 * The fetcher a site build runs before it prerenders. It fetches head.json,
 * the dispatched manifest and its signature by hash, verifies them, fetches
 * and verifies every blob, and only then writes the output directory. It
 * writes into a fresh sibling directory and renames that into place, so a
 * failure at any step leaves the previous output as it was. There is no
 * cached or fallback copy.
 *
 * It runs in Node 22 and newer. The fetch function is a parameter, so tests
 * run with no network.
 */
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { basename, dirname, join, resolve } from 'node:path';
import {
	blobPath,
	CONTRACT,
	COLLECTION_KEYS,
	headPath,
	isSite,
	manifestPath,
	SHA256_PATTERN,
	signaturePath,
} from './contract.js';
import { decodeUtf8 } from './bytes.js';
import { finding } from './findings.js';
import { legacyRedirectSource, verifyEntries, verifyManifest } from './verify.js';

/** The part of a fetch Response the fetcher reads. */

/** A WHATWG fetch, or any function with the same call shape for GET. */

/** The receipt a site serves at /.well-known/projection.json. */

const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]']);

/**
 * The base URL as a string with no trailing slash, or a finding. It must be
 * https with no credentials, query or fragment. http passes only on a
 * loopback host and only when a test asks for it.
 */
export function checkBaseUrl(baseUrl        , allowLoopbackHttp         )                             {
	const at = 'baseUrl';
	if (!URL.canParse(baseUrl)) return finding('base_url_invalid', at, 'not an absolute URL');
	const url = new URL(baseUrl);
	const loopbackHttp = allowLoopbackHttp && url.protocol === 'http:' && LOOPBACK_HOSTS.has(url.hostname);
	if (url.protocol !== 'https:' && !loopbackHttp) return finding('base_url_invalid', at, 'the base URL must be https');
	if (url.username !== '' || url.password !== '') return finding('base_url_invalid', at, 'credentials are not allowed');
	if (url.search !== '' || url.hash !== '') return finding('base_url_invalid', at, 'a query or fragment is not allowed');
	return `${url.origin}${url.pathname.replace(/\/+$/, '')}`;
}

/** One GET of a contract path. null means 404. Any other status but 200 throws. */
async function getBytes(fetch               , base        , path        )                             {
	const response = await fetch(`${base}${path}`);
	if (response.status === 404) return null;
	if (response.status !== 200) throw new Error(`${path} answered ${response.status}`);
	return new Uint8Array(await response.arrayBuffer());
}

/** Fetches, verifies and returns everything, or the findings. It writes nothing. */
export async function fetchAndVerify(options                        )                                            {
	const base = checkBaseUrl(options.baseUrl, options.allowLoopbackHttpForTests === true);
	if (typeof base !== 'string') return { ok: false, findings: [base] };
	if (!isSite(options.target)) {
		return { ok: false, findings: [finding('target_mismatch', 'target', `${String(options.target)} is no target`)] };
	}
	const { target, manifestSha256 } = options;
	const get = async (path        )                             => getBytes(options.fetch, base, path);
	try {
		const paths = [headPath(target), manifestPath(target, manifestSha256), signaturePath(target, manifestSha256)];
		const [head, manifest, signature] = await Promise.all(paths.map(get));
		const missing = [head, manifest, signature].findIndex((bytes) => bytes === null);
		if (head === null || manifest === null || signature === null) {
			return { ok: false, findings: [finding('fetch_missing', paths[missing], 'not found')] };
		}
		const verified = await verifyManifest({
			head,
			manifest,
			signature,
			publicKey: options.publicKey,
			manifestSha256,
			target,
			lastSeq: options.lastSeq,
			lastManifest: options.lastManifest,
		});
		if (!verified.ok) return verified;
		if (verified.value.seq !== options.seq) {
			return {
				ok: false,
				findings: [
					finding('dispatch_mismatch', 'seq', `dispatched seq ${options.seq}, the signed manifest is ${verified.value.seq}`),
				],
			};
		}
		const blobs = await verifyEntries(verified.value, async (sha256) => get(blobPath(sha256)));
		if (!blobs.ok) return blobs;
		return { ok: true, value: { manifest: verified.value, manifestBytes: manifest, manifestSha256, blobs: blobs.value } };
	} catch (error) {
		return { ok: false, findings: [finding('fetch_failed', base, error instanceof Error ? error.message : String(error))] };
	}
}

/** Stable, readable JSON: two-space indent, one trailing line feed. Key order is the order each value is built in. */
const json = (value         )         => `${JSON.stringify(value, null, 2)}\n`;

/** The directory layout under the output directory. */
export const OUTPUT = {
	receipt: 'projection.json',
	manifest: 'manifest.json',
	posts: 'posts',
	attachments: 'attachments',
	redirects: 'redirects.json',
	tombstones: 'tombstones.json',
}         ;

function postFile(entry       , html        )          {
	return {
		id: entry.id,
		kind: entry.kind,
		slug: entry.slug,
		path: entry.path,
		date: entry.date,
		updated: entry.updated,
		title: entry.title,
		summary: entry.summary,
		tags: entry.tags,
		placement: entry.placement,
		approval: entry.approval.sha256,
		attachments: entry.attachments.map((attachment) => ({
			id: attachment.id,
			kind: attachment.kind,
			mediaType: attachment.mediaType,
			path: attachment.path,
			sha256: attachment.sha256,
			bytes: attachment.bytes,
			alt: attachment.alt,
			file: `${OUTPUT.attachments}/${attachment.sha256}`,
		})),
		html,
	};
}

/**
 * The permanent redirects the serving rules set: each tombstone former path
 * whose replacement is a live entry, and each on-origin legacyUrl. The
 * address rule already proved that no two of them share a source.
 */
export function redirectsOf(manifest          )             {
	const entries = COLLECTION_KEYS.flatMap((key) => manifest.collections[key]);
	const pathOf = new Map(entries.map((entry) => [entry.id, entry.path]));
	const out             = [];
	for (const entry of entries) {
		const source = legacyRedirectSource(entry.placement.legacyUrl, manifest.target.origin, entry.path);
		if (source !== null) out.push({ from: source, to: entry.path });
	}
	for (const tombstone of manifest.tombstones) {
		const to = tombstone.replacedBy === null ? undefined : pathOf.get(tombstone.replacedBy);
		if (to !== undefined) for (const from of tombstone.formerPaths) out.push({ from, to });
	}
	return out.sort((a, b) => (a.from < b.from ? -1 : a.from > b.from ? 1 : 0));
}

/** A tombstone with the path its former paths redirect to, or null when they answer 410 Gone. */
function tombstoneFile(manifest          , tombstone                   )          {
	const live = COLLECTION_KEYS.flatMap((key) => manifest.collections[key]).find(
		(entry) => entry.id === tombstone.replacedBy,
	);
	return { ...tombstone, redirectTo: live?.path ?? null };
}

/** Writes the whole output tree into an empty directory. */
async function writeTree(dir        , projection                    , receipt                   )                {
	const { manifest, blobs } = projection;
	await mkdir(join(dir, OUTPUT.posts), { recursive: true });
	await mkdir(join(dir, OUTPUT.attachments), { recursive: true });
	await writeFile(join(dir, OUTPUT.receipt), json(receipt));
	await writeFile(join(dir, OUTPUT.manifest), projection.manifestBytes);
	for (const key of COLLECTION_KEYS) {
		for (const entry of manifest.collections[key]) {
			const html = decodeUtf8(blobs.get(entry.html.sha256) ?? new Uint8Array());
			if (html === null) throw new Error(`the HTML of ${entry.id} is not UTF-8`);
			await writeFile(join(dir, OUTPUT.posts, `${entry.id}.json`), json(postFile(entry, html)));
			for (const attachment of entry.attachments) {
				const data = blobs.get(attachment.sha256);
				if (data === undefined) throw new Error(`the blob of ${attachment.path} was not verified`);
				await writeFile(join(dir, OUTPUT.attachments, attachment.sha256), data);
			}
		}
	}
	await writeFile(join(dir, OUTPUT.redirects), json(redirectsOf(manifest)));
	await writeFile(
		join(dir, OUTPUT.tombstones),
		json(manifest.tombstones.map((tombstone) => tombstoneFile(manifest, tombstone))),
	);
}

/**
 * Swaps the staged tree into place. The previous output moves aside first and
 * comes back when the second rename fails, then it is removed.
 */
async function swapInto(staged        , outDir        , token        )                {
	const aside = join(dirname(outDir), `.${basename(outDir)}.previous-${token}`);
	let moved = false;
	try {
		await rename(outDir, aside);
		moved = true;
	} catch (error) {
		if ((error                      ).code !== 'ENOENT') throw error;
	}
	try {
		await rename(staged, outDir);
	} catch (error) {
		if (moved) await rename(aside, outDir);
		throw error;
	}
	if (moved) await rm(aside, { recursive: true, force: true });
}

/**
 * Fetches, verifies and writes. On success the output directory holds exactly
 * the verified projection. On any failure it returns the findings and the
 * output directory is as it was before the call.
 */
export async function fetchProjection(options                        )                                 {
	const verified = await fetchAndVerify(options);
	if (!verified.ok) return verified;
	const receipt                    = {
		contract: CONTRACT,
		target: options.target,
		seq: verified.value.manifest.seq,
		manifest: verified.value.manifestSha256,
	};
	const outDir = resolve(options.outDir);
	const token = globalThis.crypto.randomUUID();
	const staged = join(dirname(outDir), `.${basename(outDir)}.staged-${token}`);
	try {
		await mkdir(dirname(outDir), { recursive: true });
		await mkdir(staged);
		await writeTree(staged, verified.value, receipt);
		await swapInto(staged, outDir, token);
	} catch (error) {
		await rm(staged, { recursive: true, force: true });
		return {
			ok: false,
			findings: [finding('output_failed', outDir, error instanceof Error ? error.message : String(error))],
		};
	}
	return { ok: true, receipt, outDir };
}

/** The seq and manifest a site built last, as rule 5 needs them. */

/** What a site that has built nothing passes as its last build. */
export const FIRST_BUILD            = { lastSeq: 0, lastManifest: null };

/**
 * The last build a receipt records. It must be a receipt of this contract
 * for this target. A missing file is a first build only when the caller says
 * so, because a receipt the site was told to read must exist.
 */
export async function readLastBuild(receiptFile        , target      , missingIsFirstBuild         )                     {
	let text        ;
	try {
		text = await readFile(receiptFile, 'utf8');
	} catch (error) {
		if (missingIsFirstBuild && (error                      ).code === 'ENOENT') return FIRST_BUILD;
		throw error;
	}
	const receipt = JSON.parse(text)                                                     ;
	const { seq, manifest } = receipt;
	if (
		receipt.contract !== CONTRACT ||
		receipt.target !== target ||
		typeof seq !== 'number' ||
		!Number.isInteger(seq) ||
		seq < 0 ||
		typeof manifest !== 'string' ||
		!SHA256_PATTERN.test(manifest)
	) {
		throw new Error(`${receiptFile} is not a ${CONTRACT} receipt for ${target}`);
	}
	return { lastSeq: seq, lastManifest: manifest };
}
