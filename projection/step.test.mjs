/**
 * The projection step against the xoxd-projection/v2 contract fixtures. The
 * fixtures are signed by the contract's test key, so every test passes that
 * key. The committed pin is checked separately: it is the placeholder or a
 * real key, never the test key.
 */
import assert from 'node:assert/strict';
import { cp, mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import {
	FIXTURE_KEY,
	PLACEHOLDER_KEY,
	StepError,
	loadProjectionModule,
	parseConfig,
	parseKey,
	readInputs,
	runProjectionStep,
} from './step.mjs';
import { FIXTURE_BASE, VALID_BLOG, fixtureFetch, fixturePublicKey, fixturesRoot } from './testing.mjs';
import { checkDispatch } from './check-dispatch.mjs';

const projection = await loadProjectionModule();
const root = fixturesRoot();
const fixtureKey = { placeholder: false, key: fixturePublicKey() };
const placeholder = { placeholder: true, key: null };
const config = parseConfig(
	JSON.stringify({
		target: 'blog',
		origin: 'https://transscendsurvival.org',
		publicKeyFile: 'hub-ed25519.pub',
		outDir: 'src/lib/projection-data',
		allowedBases: [FIXTURE_BASE],
		recoveryBase: FIXTURE_BASE,
	}),
);
const FIRM_MANIFEST = 'e28076a9b53f3422ba013cabc695d12da7baa17302e8904286d780eda4f77b2f';

async function scratch() {
	return mkdtemp(join(tmpdir(), 'projection-step-'));
}

async function tree(dir) {
	const out = {};
	async function walk(sub) {
		for (const entry of (await readdir(join(dir, sub), { withFileTypes: true })).sort((a, b) => (a.name < b.name ? -1 : 1))) {
			const rel = sub ? `${sub}/${entry.name}` : entry.name;
			if (entry.isDirectory()) await walk(rel);
			else out[rel] = (await readFile(join(dir, rel))).toString('base64');
		}
	}
	await walk('');
	return out;
}

function step(overrides) {
	const logs = [];
	return {
		logs,
		run: () =>
			runProjectionStep({
				config,
				key: fixtureKey,
				inputs: { base: FIXTURE_BASE, ...VALID_BLOG },
				projection,
				fetch: fixtureFetch(root),
				log: (line) => logs.push(line),
				...overrides,
			}),
	};
}

/** A directory holding the verified valid blog projection, as a previous build left it. */
async function previousBuild() {
	const dir = await scratch();
	const outDir = join(dir, 'out');
	await step({ outDir }).run();
	return { dir, outDir, before: await tree(outDir) };
}

async function assertRefusedAndUntouched(overrides, code) {
	const { dir, outDir, before } = await previousBuild();
	const { run, logs } = step({ outDir, ...overrides });
	await assert.rejects(run, (error) => error instanceof StepError && error.code === 1);
	if (code) assert.ok(logs.some((line) => line.includes(code)), `expected finding ${code} in ${logs.join(' | ')}`);
	assert.deepEqual(await tree(outDir), before, 'a refused projection must leave the previous output as it was');
	await rm(dir, { recursive: true, force: true });
}

test('the valid blog fixture verifies and the note is placed by its /notes path', async () => {
	const dir = await scratch();
	const outDir = join(dir, 'out');
	const { run, logs } = step({ outDir });
	const result = await run();
	assert.equal(result.status, 'verified');
	assert.deepEqual(result.counts, { notes: 1, blog: 1, other: 1 });
	assert.deepEqual(JSON.parse(await readFile(join(outDir, 'projection.json'), 'utf8')), {
		contract: 'xoxd-projection/v2',
		target: 'blog',
		seq: 1,
		manifest: VALID_BLOG.manifest,
	});
	const note = JSON.parse(await readFile(join(outDir, 'posts', 'first-light.json'), 'utf8'));
	assert.equal(note.path, '/notes/first-light');
	assert.equal(note.html, '<p>The hub signed this note and the blog built it from the manifest.</p>');
	assert.ok(logs.some((line) => line.includes('1 entries with a /blog path ignored')), logs.join(' | '));
	await rm(dir, { recursive: true, force: true });
});

test('a tampered manifest fails closed', () =>
	assertRefusedAndUntouched({ fetch: fixtureFetch(root, { overlay: 'tampered/manifest-bytes-changed' }) }, 'manifest_hash_mismatch'));

test('a wrong signature fails closed', () =>
	assertRefusedAndUntouched({ fetch: fixtureFetch(root, { overlay: 'tampered/bad-signature' }) }, 'signature_invalid'));

const LIVE_RECEIPT_URL = 'https://transscendsurvival.org/.well-known/projection.json';

test('a dispatched seq lower than the last accepted seq fails before any hub fetch', async () => {
	const { dir, outDir } = await previousBuild();
	const receipt = join(outDir, 'projection.json');
	await writeFile(receipt, JSON.stringify({ contract: 'xoxd-projection/v2', target: 'blog', seq: 2, manifest: VALID_BLOG.manifest }));
	const calls = [];
	const { run } = step({ outDir, fetch: fixtureFetch(root, { calls }) });
	await assert.rejects(run, /lower than the last accepted seq 2/);
	assert.deepEqual(calls, [LIVE_RECEIPT_URL]);
	await rm(dir, { recursive: true, force: true });
});

test('the live receipt sets the last accepted seq for a dispatch on a fresh checkout', async () => {
	const dir = await scratch();
	const outDir = join(dir, 'out');
	const calls = [];
	const live = { contract: 'xoxd-projection/v2', target: 'blog', seq: 2, manifest: VALID_BLOG.manifest };
	const { run } = step({ outDir, fetch: fixtureFetch(root, { calls, live }) });
	await assert.rejects(run, /lower than the last accepted seq 2/);
	assert.deepEqual(calls, [LIVE_RECEIPT_URL]);
	await assert.rejects(readdir(outDir), { code: 'ENOENT' });
	await rm(dir, { recursive: true, force: true });
});

test('a dispatch refuses to run when the live receipt cannot be read', async () => {
	await assertRefusedAndUntouched({ fetch: fixtureFetch(root, { live: 503 }) });
});

test('a signed seq lower than the last accepted seq fails closed', async () => {
	const { dir, outDir } = await previousBuild();
	await writeFile(
		join(outDir, 'projection.json'),
		JSON.stringify({ contract: 'xoxd-projection/v2', target: 'blog', seq: 2, manifest: VALID_BLOG.manifest }),
	);
	const before = await tree(outDir);
	const logs = [];
	await assert.rejects(
		runProjectionStep({
			config,
			key: fixtureKey,
			inputs: { base: FIXTURE_BASE, manifest: VALID_BLOG.manifest, seq: 2 },
			outDir,
			projection,
			fetch: fixtureFetch(root),
			log: (line) => logs.push(line),
		}),
		StepError,
	);
	assert.ok(logs.some((line) => line.includes('seq_regressed')), logs.join(' | '));
	assert.deepEqual(await tree(outDir), before);
	await rm(dir, { recursive: true, force: true });
});

test("the firm target's manifest fails closed on the blog", async () => {
	await assertRefusedAndUntouched(
		{
			inputs: { base: FIXTURE_BASE, manifest: FIRM_MANIFEST, seq: 1 },
			fetch: fixtureFetch(root, { overlay: 'tampered/wrong-target' }),
		},
		'target_mismatch',
	);
	// Without the overlay the firm manifest is not served at a blog address at all.
	await assertRefusedAndUntouched({ inputs: { base: FIXTURE_BASE, manifest: FIRM_MANIFEST, seq: 1 } }, 'fetch_missing');
});

test('a base outside the allowlist fails before any fetch', async () => {
	const calls = [];
	await assertRefusedAndUntouched({
		inputs: { ...VALID_BLOG, base: 'https://elsewhere.example' },
		fetch: fixtureFetch(root, { calls }),
	});
	assert.deepEqual(calls, []);
});

test('the placeholder key refuses dispatch inputs and fetches nothing', async () => {
	const calls = [];
	await assertRefusedAndUntouched({ key: placeholder, fetch: fixtureFetch(root, { calls }) });
	assert.deepEqual(calls, []);
});

test('the placeholder key with no inputs builds no notes and fetches nothing', async () => {
	const { dir, outDir } = await previousBuild();
	const calls = [];
	const { run, logs } = step({ outDir, key: placeholder, inputs: null, fetch: fixtureFetch(root, { calls }) });
	assert.deepEqual(await run(), { status: 'empty' });
	await assert.rejects(readdir(outDir), { code: 'ENOENT' });
	assert.deepEqual(calls, []);
	assert.ok(logs.some((line) => line.includes('placeholder')));
	await rm(dir, { recursive: true, force: true });
});

test('no inputs and no live receipt builds no notes', async () => {
	const dir = await scratch();
	const outDir = join(dir, 'out');
	const calls = [];
	const { run } = step({ outDir, inputs: null, fetch: fixtureFetch(root, { calls }) });
	assert.deepEqual(await run(), { status: 'empty' });
	assert.deepEqual(calls, ['https://transscendsurvival.org/.well-known/projection.json']);
	await assert.rejects(readdir(outDir), { code: 'ENOENT' });
	await rm(dir, { recursive: true, force: true });
});

test('no inputs rebuilds the live receipt and verifies it in full', async () => {
	const dir = await scratch();
	const outDir = join(dir, 'out');
	const live = { contract: 'xoxd-projection/v2', target: 'blog', seq: 1, manifest: VALID_BLOG.manifest };
	const { run } = step({ outDir, inputs: null, fetch: fixtureFetch(root, { live }) });
	const result = await run();
	assert.equal(result.status, 'verified');
	assert.deepEqual(JSON.parse(await readFile(join(outDir, 'projection.json'), 'utf8')), live);
	await rm(dir, { recursive: true, force: true });
});

test('no inputs refuses a live receipt whose manifest no longer verifies', () =>
	assertRefusedAndUntouched(
		{
			inputs: null,
			fetch: fixtureFetch(root, {
				overlay: 'tampered/bad-signature',
				live: { contract: 'xoxd-projection/v2', target: 'blog', seq: 1, manifest: VALID_BLOG.manifest },
			}),
		},
		'signature_invalid',
	));

test('no inputs refuses when the live receipt cannot be read', async () => {
	await assertRefusedAndUntouched({ inputs: null, fetch: fixtureFetch(root, { live: 503 }) });
	await assertRefusedAndUntouched({ inputs: null, fetch: fixtureFetch(root, { live: { seq: 1 } }) });
	await assertRefusedAndUntouched({
		inputs: null,
		config: { ...config, recoveryBase: null },
		fetch: fixtureFetch(root, {
			live: { contract: 'xoxd-projection/v2', target: 'blog', seq: 1, manifest: VALID_BLOG.manifest },
		}),
	});
});

test('dispatch inputs are all three or none, each in its contract format', () => {
	assert.equal(readInputs({}), null);
	const good = { PROJECTION_MANIFEST: VALID_BLOG.manifest, PROJECTION_SEQ: '12', PROJECTION_BASE: 'https://hub.example' };
	assert.deepEqual(readInputs(good), { manifest: VALID_BLOG.manifest, seq: 12, base: 'https://hub.example' });
	const bad = [
		{ PROJECTION_MANIFEST: VALID_BLOG.manifest },
		{ ...good, PROJECTION_MANIFEST: VALID_BLOG.manifest.toUpperCase() },
		{ ...good, PROJECTION_SEQ: '0' },
		{ ...good, PROJECTION_SEQ: '012' },
		{ ...good, PROJECTION_SEQ: '+1' },
		{ ...good, PROJECTION_SEQ: '99999999999999999999' },
		{ ...good, PROJECTION_BASE: 'http://hub.example' },
		{ ...good, PROJECTION_BASE: 'https://hub.example/' },
		{ ...good, PROJECTION_BASE: 'https://hub.example/projection' },
		{ ...good, PROJECTION_BASE: 'https://hub.example?x=1' },
		{ ...good, PROJECTION_BASE: 'https://user@hub.example' },
		{ ...good, PROJECTION_BASE: 'https://hub.example\n' },
		{ ...good, PROJECTION_BASE: 'https://localhost' },
	];
	for (const env of bad) assert.throws(() => readInputs(env), (error) => error instanceof StepError && error.code === 2);
});

test("the fixture key is the one the module's own tests verify the fixtures with", async () => {
	const helpers = process.env.XOXD_PROJECTION_HELPERS;
	assert.ok(helpers, 'XOXD_PROJECTION_HELPERS is not set');
	const text = await readFile(helpers, 'utf8');
	assert.ok(text.includes(`export const FIXTURE_PUBLIC_KEY = '${FIXTURE_KEY}';`), 'test/helpers.ts carries another fixture key');
});

test('the key parser refuses the contract test key and anything that is not a key', () => {
	assert.deepEqual(parseKey(`${PLACEHOLDER_KEY}\n`), { placeholder: true, key: null });
	assert.throws(() => parseKey(FIXTURE_KEY), /never be pinned/);
	assert.throws(() => parseKey('abc'), /44 characters/);
	assert.equal(parseKey(`${'A'.repeat(43)}=\n`).key, `${'A'.repeat(43)}=`);
});

test('the committed configuration and pinned key parse, and the pin is never the test key', async () => {
	const committed = parseConfig(await readFile('projection/config.json', 'utf8'));
	assert.equal(committed.target, 'blog');
	const key = parseKey(await readFile(join('projection', committed.publicKeyFile), 'utf8'));
	assert.ok(key.placeholder || key.key !== FIXTURE_KEY);
	if (key.placeholder) {
		assert.deepEqual(committed.allowedBases, [], 'no base is allowed while the key is the placeholder');
	}
});

test('the e2e harness copy of the output tree is reproducible', async () => {
	// The fetcher writes the same bytes for the same manifest, so a second
	// run over a copy is byte-identical. The e2e notes build relies on it.
	const { dir, outDir, before } = await previousBuild();
	const copy = join(dir, 'copy');
	await cp(outDir, copy, { recursive: true });
	await step({ outDir: copy }).run();
	assert.deepEqual(await tree(copy), before);
	await rm(dir, { recursive: true, force: true });
});

test('the dispatch carrier check refuses another ref, bad inputs, a base off the allowlist and the placeholder key', () => {
	const env = {
		GITHUB_REF: 'refs/heads/main',
		PROJECTION_MANIFEST: VALID_BLOG.manifest,
		PROJECTION_SEQ: '1',
		PROJECTION_BASE: FIXTURE_BASE,
	};
	const configText = JSON.stringify({
		target: 'blog',
		origin: 'https://transscendsurvival.org',
		publicKeyFile: 'hub-ed25519.pub',
		outDir: 'src/lib/projection-data',
		allowedBases: [FIXTURE_BASE],
		recoveryBase: FIXTURE_BASE,
	});
	const realKey = `${'A'.repeat(43)}=\n`;
	assert.deepEqual(checkDispatch({ env, configText, keyText: realKey }), { manifest: VALID_BLOG.manifest, seq: 1, base: FIXTURE_BASE });
	assert.throws(() => checkDispatch({ env: { ...env, GITHUB_REF: 'refs/heads/feature' }, configText, keyText: realKey }), /refs\/heads\/main/);
	assert.throws(() => checkDispatch({ env: { ...env, PROJECTION_SEQ: '01' }, configText, keyText: realKey }), /seq must be/);
	assert.throws(() => checkDispatch({ env: { GITHUB_REF: 'refs/heads/main' }, configText, keyText: realKey }), /all three inputs/);
	assert.throws(
		() => checkDispatch({ env: { ...env, PROJECTION_BASE: 'https://elsewhere.example' }, configText, keyText: realKey }),
		/not in the allowedBases/,
	);
	assert.throws(() => checkDispatch({ env, configText, keyText: PLACEHOLDER_KEY }), /placeholder/);
});
