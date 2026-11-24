import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { writeFile } from 'node:fs/promises';
import { dirname, join, relative } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import { sha256OfBytes } from '../src/bytes.ts';
import { blobPath, COLLECTION_KEYS, headPath } from '../src/contract.ts';
import { checkBaseUrl, fetchProjection, FIRST_BUILD, readLastBuild } from '../src/fetch.ts';
import type { FetchFunction, FetchProjectionOptions, FetchProjectionResult } from '../src/fetch.ts';
import {
	FIXTURE_PUBLIC_KEY,
	fixtureTree,
	memoryHub,
	newSigner,
	scratch,
	signManifest,
	text,
	treeWith,
	VALID_BLOG,
	validBlogManifest,
} from './helpers.ts';
import type { Tree } from './helpers.ts';

const BASE = 'https://hub.test';

/** Every file under a directory, by relative path, with its sha256. */
async function snapshot(dir: string): Promise<Map<string, string>> {
	const out = new Map<string, string>();
	const walk = async (current: string): Promise<void> => {
		for (const item of readdirSync(current, { withFileTypes: true })) {
			const path = join(current, item.name);
			if (item.isDirectory()) await walk(path);
			else out.set(relative(dir, path), await sha256OfBytes(readFileSync(path)));
		}
	};
	await walk(dir);
	return out;
}

function options(outDir: string, fetch: FetchFunction, extra: Partial<FetchProjectionOptions> = {}): FetchProjectionOptions {
	return {
		baseUrl: BASE,
		target: 'blog',
		manifestSha256: VALID_BLOG,
		seq: 1,
		lastSeq: 0,
		lastManifest: null,
		publicKey: FIXTURE_PUBLIC_KEY,
		outDir,
		fetch,
		...extra,
	};
}

const codes = (result: FetchProjectionResult): string[] => (result.ok ? [] : result.findings.map((item) => item.code));

/** A valid tree, a run that fills <root>/out, and a snapshot of it. */
async function goodRun(prefix: string): Promise<{ outDir: string; before: Map<string, string> }> {
	const outDir = join(await scratch(prefix), 'out');
	const result = await fetchProjection(options(outDir, memoryHub(fixtureTree('blog', VALID_BLOG)).fetch));
	assert.ok(result.ok, JSON.stringify(result));
	return { outDir, before: await snapshot(outDir) };
}

/** Nothing but the output directory is left beside it: no staged or moved-aside copy. */
function onlyOutput(outDir: string): void {
	assert.deepEqual(readdirSync(dirname(outDir)), ['out']);
}

describe('fetchProjection', () => {
	it('writes the verified projection for a good run', async () => {
		const { outDir, before } = await goodRun('good');
		const manifest = validBlogManifest();
		const entries = COLLECTION_KEYS.flatMap((key) => manifest.collections[key]);

		const receipt = JSON.parse(readFileSync(join(outDir, 'projection.json'), 'utf8')) as Record<string, unknown>;
		assert.deepEqual(receipt, { contract: 'xoxd-projection/v2', target: 'blog', seq: 1, manifest: VALID_BLOG });
		assert.equal(await sha256OfBytes(readFileSync(join(outDir, 'manifest.json'))), VALID_BLOG);

		assert.deepEqual(readdirSync(join(outDir, 'posts')).sort(), entries.map((entry) => `${entry.id}.json`).sort());
		for (const entry of entries) {
			const post = JSON.parse(readFileSync(join(outDir, 'posts', `${entry.id}.json`), 'utf8')) as {
				path: string;
				title: string;
				html: string;
				approval: string;
			};
			assert.equal(post.path, entry.path);
			assert.equal(post.title, entry.title);
			assert.equal(post.approval, entry.approval.sha256);
			assert.equal(await sha256OfBytes(text(post.html)), entry.html.sha256);
		}

		const attachments = entries.flatMap((entry) => entry.attachments);
		assert.ok(attachments.length > 0);
		assert.deepEqual(
			readdirSync(join(outDir, 'attachments')).sort(),
			[...new Set(attachments.map((item) => item.sha256))].sort(),
		);
		for (const item of attachments) {
			assert.equal(await sha256OfBytes(readFileSync(join(outDir, 'attachments', item.sha256))), item.sha256);
		}

		const redirects = JSON.parse(readFileSync(join(outDir, 'redirects.json'), 'utf8')) as Array<{ from: string; to: string }>;
		const tombstones = JSON.parse(readFileSync(join(outDir, 'tombstones.json'), 'utf8')) as Array<{
			id: string;
			formerPaths: string[];
			redirectTo: string | null;
		}>;
		assert.deepEqual(
			tombstones.map((row) => row.id),
			manifest.tombstones.map((row) => row.id),
		);
		for (const row of tombstones) {
			for (const from of row.formerPaths) {
				const redirect = redirects.find((item) => item.from === from);
				assert.equal(redirect?.to ?? null, row.redirectTo);
			}
		}
		assert.deepEqual(
			redirects.map((item) => item.from),
			redirects.map((item) => item.from).sort(),
		);

		// A second run over the same manifest writes the same bytes.
		const again = await fetchProjection(options(outDir, memoryHub(fixtureTree('blog', VALID_BLOG)).fetch));
		assert.ok(again.ok);
		assert.deepEqual(await snapshot(outDir), before);
		onlyOutput(outDir);
	});

	it('fetches each path once and writes the bytes it verified', async () => {
		const tree = fixtureTree('blog', VALID_BLOG);
		const hub = memoryHub(tree);
		const manifest = validBlogManifest();
		const image = manifest.collections.article[0]?.attachments[0];
		assert.ok(image);
		// The blob changes on the hub after the first GET. A fetcher that read
		// it twice would write bytes it never verified.
		const fetch: FetchFunction = async (url) => {
			const response = await hub.fetch(url);
			if (url.endsWith(blobPath(image.sha256))) tree.set(blobPath(image.sha256), text('changed after verify'));
			return response;
		};
		const outDir = join(await scratch('once'), 'out');
		const result = await fetchProjection(options(outDir, fetch));
		assert.ok(result.ok, JSON.stringify(result));
		for (const [path, count] of hub.gets) assert.equal(count, 1, path);
		assert.equal(await sha256OfBytes(readFileSync(join(outDir, 'attachments', image.sha256))), image.sha256);
	});

	it('refuses a blob that changed on the hub after the manifest was signed', async () => {
		const { outDir, before } = await goodRun('changed');
		const tree = fixtureTree('blog', VALID_BLOG);
		const html = validBlogManifest().collections.article[0]?.html;
		assert.ok(html);
		tree.set(blobPath(html.sha256), text('<p>edited on the hub</p>'));
		const result = await fetchProjection(options(outDir, memoryHub(tree).fetch));
		assert.deepEqual(codes(result), ['blob_hash_mismatch']);
		assert.deepEqual(await snapshot(outDir), before);
		onlyOutput(outDir);
	});

	it('refuses a blob that answers 404', async () => {
		const { outDir, before } = await goodRun('missing');
		const tree = fixtureTree('blog', VALID_BLOG);
		const html = validBlogManifest().collections.note[0]?.html;
		assert.ok(html);
		tree.delete(blobPath(html.sha256));
		const result = await fetchProjection(options(outDir, memoryHub(tree).fetch));
		assert.deepEqual(codes(result), ['fetch_missing']);
		assert.deepEqual(await snapshot(outDir), before);
		onlyOutput(outDir);
	});

	it('leaves the previous output byte-identical when the hub fails midway', async () => {
		const { outDir, before } = await goodRun('midway');
		const hub = memoryHub(fixtureTree('blog', VALID_BLOG));
		let calls = 0;
		const fetch: FetchFunction = async (url) => {
			calls += 1;
			if (calls === 6) throw new Error('connection reset');
			return hub.fetch(url);
		};
		const result = await fetchProjection(options(outDir, fetch));
		assert.deepEqual(codes(result), ['fetch_failed']);
		assert.ok(calls >= 6);
		assert.deepEqual(await snapshot(outDir), before);
		onlyOutput(outDir);
	});

	it('refuses a status other than 200 or 404', async () => {
		const outDir = join(await scratch('status'), 'out');
		const fetch: FetchFunction = async () => new Response('busy', { status: 503 });
		assert.deepEqual(codes(await fetchProjection(options(outDir, fetch))), ['fetch_failed']);
		assert.throws(() => statSync(outDir));
	});

	it('refuses a dispatched seq that differs from the signed seq', async () => {
		const outDir = join(await scratch('seq'), 'out');
		const result = await fetchProjection(options(outDir, memoryHub(fixtureTree('blog', VALID_BLOG)).fetch, { seq: 2 }));
		assert.deepEqual(codes(result), ['dispatch_mismatch']);
		assert.throws(() => statSync(outDir));
	});

	it('refuses a manifest older than the last accepted seq', async () => {
		const { outDir, before } = await goodRun('older');
		const last = await readLastBuild(join(outDir, 'projection.json'), 'blog', false);
		const result = await fetchProjection(
			options(outDir, memoryHub(fixtureTree('blog', VALID_BLOG)).fetch, { ...last, lastSeq: last.lastSeq + 1 }),
		);
		assert.deepEqual(codes(result), ['seq_regressed']);
		assert.deepEqual(await snapshot(outDir), before);
	});

	it('rebuilds the manifest built last at an equal seq', async () => {
		const { outDir, before } = await goodRun('rebuild');
		const last = await readLastBuild(join(outDir, 'projection.json'), 'blog', false);
		assert.deepEqual(last, { lastSeq: 1, lastManifest: VALID_BLOG });
		const result = await fetchProjection(options(outDir, memoryHub(fixtureTree('blog', VALID_BLOG)).fetch, last));
		assert.ok(result.ok, JSON.stringify(result));
		assert.deepEqual(await snapshot(outDir), before);
	});

	it('refuses another signed manifest at the seq built last and keeps the output', async () => {
		const { outDir, before } = await goodRun('sameseq');
		const last = await readLastBuild(join(outDir, 'projection.json'), 'blog', false);
		const signer = await newSigner();
		const manifest = validBlogManifest() as { previous: string | null };
		manifest.previous = 'a'.repeat(64);
		const other = await signManifest(signer, manifest);
		assert.notEqual(other.sha256, VALID_BLOG);
		const result = await fetchProjection(
			options(outDir, memoryHub(treeWith(other)).fetch, {
				...last,
				manifestSha256: other.sha256,
				publicKey: signer.publicKey,
			}),
		);
		assert.deepEqual(codes(result), ['seq_regressed']);
		assert.deepEqual(await snapshot(outDir), before);
	});

	it('reads the last build from a receipt', async () => {
		const { outDir } = await goodRun('lastbuild');
		const receipt = join(outDir, 'projection.json');
		assert.deepEqual(await readLastBuild(receipt, 'blog', false), { lastSeq: 1, lastManifest: VALID_BLOG });
		await assert.rejects(readLastBuild(receipt, 'firm', false));
		const none = join(outDir, 'none', 'projection.json');
		assert.deepEqual(await readLastBuild(none, 'blog', true), FIRST_BUILD);
		await assert.rejects(readLastBuild(none, 'blog', false));
		const bad = join(await scratch('badreceipt'), 'projection.json');
		await writeFile(bad, '{"contract":"xoxd-projection/v2","target":"blog","seq":1}');
		await assert.rejects(readLastBuild(bad, 'blog', false));
	});

	it('refuses a head.json that is missing', async () => {
		const outDir = join(await scratch('nohead'), 'out');
		const tree: Tree = fixtureTree('blog', VALID_BLOG);
		tree.delete(headPath('blog'));
		assert.deepEqual(codes(await fetchProjection(options(outDir, memoryHub(tree).fetch))), ['fetch_missing']);
	});
});

describe('base URL', () => {
	it('takes https only, with no credentials, query or fragment', () => {
		assert.equal(checkBaseUrl('https://hub.test/', false), 'https://hub.test');
		assert.equal(checkBaseUrl('https://hub.test/base//', false), 'https://hub.test/base');
		for (const url of [
			'http://hub.test',
			'ftp://hub.test',
			'hub.test',
			'https://user:pass@hub.test',
			'https://hub.test/?x=1',
			'https://hub.test/#x',
			'http://127.0.0.1:8080',
		]) {
			const result = checkBaseUrl(url, false);
			assert.equal(typeof result === 'string' ? result : result.code, 'base_url_invalid', url);
		}
	});

	it('lets http through on loopback only when a test asks for it', async () => {
		assert.equal(checkBaseUrl('http://127.0.0.1:8080', true), 'http://127.0.0.1:8080');
		assert.equal(checkBaseUrl('http://[::1]:8080', true), 'http://[::1]:8080');
		assert.equal(checkBaseUrl('http://localhost:8080', true), 'http://localhost:8080');
		const remote = checkBaseUrl('http://hub.test', true);
		assert.equal(typeof remote === 'string' ? remote : remote.code, 'base_url_invalid');

		const base = 'http://127.0.0.1:8080';
		const hub = memoryHub(fixtureTree('blog', VALID_BLOG), base);
		const refused = await fetchProjection(options(join(await scratch('http'), 'out'), hub.fetch, { baseUrl: base }));
		assert.deepEqual(codes(refused), ['base_url_invalid']);
		const allowed = await fetchProjection(
			options(join(await scratch('loopback'), 'out'), hub.fetch, { baseUrl: base, allowLoopbackHttpForTests: true }),
		);
		assert.ok(allowed.ok, JSON.stringify(allowed));
	});
});

describe('CLI', () => {
	const cli = fileURLToPath(new URL('../dist/cli.js', import.meta.url));
	const run = (args: string[]) => spawnSync(process.execPath, [cli, ...args], { encoding: 'utf8' });

	it('exits 2 on a usage error', () => {
		const result = run(['--target', 'blog']);
		assert.equal(result.status, 2, result.stderr);
		assert.match(result.stderr, /usage: xoxd-projection-fetch/);
	});

	it('exits 1 and leaves no output for an http base URL', async () => {
		const root = await scratch('cli');
		const keyFile = join(root, 'hub.pub');
		await writeFile(keyFile, `${FIXTURE_PUBLIC_KEY}\n`);
		const outDir = join(root, 'out');
		const result = run([
			'--base-url',
			'http://127.0.0.1:9',
			'--target',
			'blog',
			'--manifest',
			VALID_BLOG,
			'--seq',
			'1',
			'--public-key-file',
			keyFile,
			'--out',
			outDir,
		]);
		assert.equal(result.status, 1, result.stderr);
		assert.match(result.stderr, /base_url_invalid/);
		assert.throws(() => statSync(outDir));
	});
});
