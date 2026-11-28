/**
 * The projection step against the xoxd-projection/v3 contract fixtures. A
 * server on a loopback address serves the fixture trees, and the module's
 * real fetcher reads them over HTTP. The fixtures are signed by the
 * contract's test key, so every test passes that key. The committed pin is
 * checked separately: it is the placeholder or a real key, never the test key.
 */
import assert from 'node:assert/strict';
import { cp, mkdtemp, readdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import {
	CONTRACT,
	FIXTURE_KEY,
	PLACEHOLDER_KEY,
	StepError,
	loadProjectionModule,
	parseConfig,
	parseKey,
	readInputs,
	runProjectionStep,
} from './step.mjs';
import {
	FIXTURE_CONTRACT,
	VALID_BLOG,
	VALID_FIRM,
	fixtureConfig,
	fixturePublicKey,
	fixturesRoot,
	noRedirectFetch,
	startFixtureHub,
} from './testing.mjs';
import { checkDispatch } from './check-dispatch.mjs';

const projection = await loadProjectionModule();
const root = fixturesRoot();
const cases = JSON.parse(await readFile(join(root, 'cases.json'), 'utf8'));
const fixtureKey = { placeholder: false, key: fixturePublicKey() };
const placeholder = { placeholder: true, key: null };
const RECEIPT_PATH = '/.well-known/projection.json';
const V2_RECEIPT = { contract: 'xoxd-projection/v2', target: 'blog', seq: 1, manifest: VALID_BLOG.manifest };

const receipt = (seq) => ({ contract: CONTRACT, target: 'blog', seq, manifest: VALID_BLOG.manifest });

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

/** Runs a body against a loopback hub and stops the hub afterwards. */
async function withHub(options, body) {
	const hub = await startFixtureHub(root, options);
	try {
		return await body(hub);
	} finally {
		await hub.close();
	}
}

/** One run of the step against a hub. */
function step(hub, overrides = {}) {
	const logs = [];
	return {
		logs,
		run: () =>
			runProjectionStep({
				config: fixtureConfig(hub.base),
				key: fixtureKey,
				inputs: { contract: FIXTURE_CONTRACT, base: hub.base, ...VALID_BLOG },
				projection,
				fetch: noRedirectFetch,
				allowLoopbackHttpForTests: true,
				log: (line) => logs.push(line),
				...overrides,
			}),
	};
}

/** A directory holding the verified valid blog projection, as a previous build left it. */
async function previousBuild() {
	const dir = await scratch();
	const outDir = join(dir, 'out');
	await withHub({}, (hub) => step(hub, { outDir }).run());
	return { dir, outDir, before: await tree(outDir) };
}

/**
 * Runs the step over a previous build and expects a refusal that leaves the
 * output as it was. overrides may be a function of the hub. Returns the
 * paths the step asked the hub for.
 */
async function assertRefusedAndUntouched(hubOptions, overrides, code, exitCode = 1) {
	const { dir, outDir, before } = await previousBuild();
	const calls = await withHub(hubOptions, async (hub) => {
		const { run, logs } = step(hub, { outDir, ...(typeof overrides === 'function' ? overrides(hub) : overrides) });
		await assert.rejects(run, (error) => error instanceof StepError && error.code === exitCode);
		if (code) assert.ok(logs.some((line) => line.includes(code)), `expected finding ${code} in ${logs.join(' | ')}`);
		return hub.calls;
	});
	assert.deepEqual(await tree(outDir), before, 'a refused projection must leave the previous output as it was');
	await rm(dir, { recursive: true, force: true });
	return calls;
}

test('the valid blog tree verifies over HTTP and the note is placed by its /notes path', async () => {
	const dir = await scratch();
	const outDir = join(dir, 'out');
	await withHub({}, async (hub) => {
		const { run, logs } = step(hub, { outDir });
		const result = await run();
		assert.equal(result.status, 'verified');
		assert.deepEqual(result.counts, { notes: 1, blog: 2, other: 1 });
		assert.ok(logs.some((line) => line.includes('2 entries with a /blog path ignored')), logs.join(' | '));
		// The live receipt comes first. Everything after it is under /projection/v3/.
		assert.equal(hub.calls[0], RECEIPT_PATH);
		assert.ok(hub.calls.length > 4);
		assert.ok(hub.calls.slice(1).every((path) => path.startsWith('/projection/v3/')), hub.calls.join(' '));
	});
	assert.deepEqual(JSON.parse(await readFile(join(outDir, 'projection.json'), 'utf8')), receipt(1));
	const note = JSON.parse(await readFile(join(outDir, 'posts', 'first-light.json'), 'utf8'));
	assert.equal(note.path, '/notes/first-light');
	assert.equal(note.html, '<p>The hub signed this note and the blog built it from the manifest.</p>');
	assert.equal(note.cover, null);
	assert.equal(note.heading, null);
	assert.deepEqual(note.blocks, [{ type: 'prose', prose: 'The hub signed this note and the blog built it from the manifest.' }]);
	await rm(dir, { recursive: true, force: true });
});

test('the valid blog tree gives the typed v3 post data: cover, heading, blocks and attachment refs', async () => {
	const { dir, outDir } = await previousBuild();
	const post = JSON.parse(await readFile(join(outDir, 'posts', 'marsh-dawn.json'), 'utf8'));
	assert.equal(post.cover.decorative, true);
	assert.equal(post.cover.alt, '');
	assert.equal(post.cover.image.path, '/blog/marsh-dawn/cover.png');
	assert.deepEqual(post.heading, { until: '2026-12-31' });
	assert.deepEqual(
		post.blocks.map((block) => block.type),
		['prose', 'figure', 'recording', 'photos', 'youtube', 'clip'],
	);
	const figure = post.blocks[1];
	assert.equal(figure.label, 'fig-reeds');
	assert.equal(figure.number, 1);
	const clip = post.blocks[5];
	assert.equal(clip.video.mediaType, 'video/mp4');
	assert.equal(clip.video.width, 16);
	assert.equal(clip.video.height, 16);
	assert.equal(clip.alt, 'Ripples spread across the water');
	assert.equal(post.blocks[4].player, 'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ');
	// Each ref names its verified blob in the output directory, by its sha256.
	for (const attachment of post.attachments) {
		assert.equal(attachment.file, `attachments/${attachment.sha256}`);
		assert.equal((await stat(join(outDir, attachment.file))).size, attachment.bytes);
	}
	assert.deepEqual(post.attachments.map((attachment) => attachment.kind).sort(), [
		'audio',
		'image',
		'image',
		'image',
		'image',
		'image',
		'video',
	]);
	await rm(dir, { recursive: true, force: true });
});

test('the valid firm tree verifies through the same fetcher and gives a diagram with its picture', async () => {
	const dir = await scratch();
	const outDir = join(dir, 'out');
	await withHub({}, async (hub) => {
		const result = await projection.fetchProjection({
			contract: FIXTURE_CONTRACT,
			baseUrl: hub.base,
			target: 'firm',
			manifestSha256: VALID_FIRM.manifest,
			seq: VALID_FIRM.seq,
			lastSeq: 0,
			lastManifest: null,
			publicKey: fixturePublicKey(),
			outDir,
			fetch: noRedirectFetch,
			allowLoopbackHttpForTests: true,
		});
		assert.equal(result.ok, true, JSON.stringify(result));
	});
	const post = JSON.parse(await readFile(join(outDir, 'posts', 'signed-pictures.json'), 'utf8'));
	const diagram = post.blocks.find((block) => block.type === 'diagram');
	assert.equal(diagram.picture.mediaType, 'image/svg+xml');
	assert.match(diagram.picture.path, /^\/writing\/signed-pictures\/diagram-[0-9a-f]{24}\.svg$/);
	assert.ok(diagram.alt.length > 0);
	assert.deepEqual(post.heading, { until: null });
	await rm(dir, { recursive: true, force: true });
});

// Every case of the hub's cases.json, through the module's fetcher against
// the loopback hub. A case with findings writes no output directory.
for (const row of cases) {
	test(`contract case ${row.name}: ${row.expect.length === 0 ? 'accepted' : row.expect.join(', ')}`, async () => {
		const dir = await scratch();
		const outDir = join(dir, 'out');
		await withHub({ overlay: row.overlay }, async (hub) => {
			const result = await projection.fetchProjection({
				contract: FIXTURE_CONTRACT,
				baseUrl: hub.base,
				target: row.target,
				manifestSha256: row.manifest,
				seq: 1,
				lastSeq: row.lastSeq,
				lastManifest: row.lastSeq === 0 ? null : row.manifest,
				publicKey: fixturePublicKey(),
				outDir,
				fetch: noRedirectFetch,
				allowLoopbackHttpForTests: true,
			});
			const codes = result.ok ? [] : [...new Set(result.findings.map((item) => item.code))].sort();
			assert.deepEqual(codes, [...row.expect].sort(), JSON.stringify(result));
		});
		if (row.expect.length === 0) assert.ok((await readdir(outDir)).includes('projection.json'));
		else await assert.rejects(readdir(outDir), { code: 'ENOENT' });
		await rm(dir, { recursive: true, force: true });
	});
}

/** Runs the step on a checkout with no earlier output and expects a refusal that writes none. */
async function assertRefusedOnFreshCheckout(hubOptions, overrides, code) {
	const dir = await scratch();
	const outDir = join(dir, 'out');
	await withHub(hubOptions, async (hub) => {
		const { run, logs } = step(hub, { outDir, ...overrides(hub) });
		await assert.rejects(run, (error) => error instanceof StepError && error.code === 1);
		assert.ok(logs.some((line) => line.includes(code)), `expected finding ${code} in ${logs.join(' | ')}`);
	});
	assert.deepEqual(await readdir(dir), [], 'a refused projection must write nothing');
	await rm(dir, { recursive: true, force: true });
}

// Each refusal case of the blog target again, through the step this site
// runs. A case that tampers with the valid manifest runs over a previous
// build of it, and that output stays as it was. A case with a manifest of
// its own runs on a fresh checkout, as a first build, and writes nothing.
// The lower-seq case has its own tests below, since the step refuses it
// before it asks the hub.
for (const row of cases.filter((item) => item.target === 'blog' && item.expect.length > 0 && item.lastSeq === 0)) {
	test(`the step fails closed on ${row.name}`, async () => {
		const inputs = (hub) => ({ inputs: { contract: FIXTURE_CONTRACT, base: hub.base, manifest: row.manifest, seq: 1 } });
		for (const code of row.expect) {
			if (row.manifest === VALID_BLOG.manifest) await assertRefusedAndUntouched({ overlay: row.overlay }, inputs, code);
			else await assertRefusedOnFreshCheckout({ overlay: row.overlay }, inputs, code);
		}
	});
}

test('a dispatch under another contract is refused before anything is fetched', async () => {
	for (const contract of ['xoxd-projection/v2', 'xoxd-projection/v4', 'v3', '']) {
		const calls = await assertRefusedAndUntouched(
			{},
			(hub) => ({ inputs: { contract, base: hub.base, ...VALID_BLOG } }),
			undefined,
			2,
		);
		assert.deepEqual(calls, [], `contract ${JSON.stringify(contract)} must reach no server`);
	}
});

test('an output directory a v2 build left is refused, and the previous output stays', async () => {
	const { dir, outDir } = await previousBuild();
	await writeFile(join(outDir, 'projection.json'), JSON.stringify(V2_RECEIPT));
	const before = await tree(outDir);
	await withHub({}, async (hub) => {
		const { run } = step(hub, { outDir });
		await assert.rejects(run, /Remove that directory to start a first build/);
		assert.deepEqual(hub.calls, [RECEIPT_PATH]);
	});
	assert.deepEqual(await tree(outDir), before);
	await rm(dir, { recursive: true, force: true });
});

test('a v2 receipt on the live site is refused, with and without dispatch inputs', async () => {
	assert.deepEqual(await assertRefusedAndUntouched({ live: V2_RECEIPT }, {}), [RECEIPT_PATH]);
	assert.deepEqual(await assertRefusedAndUntouched({ live: V2_RECEIPT }, { inputs: null }), [RECEIPT_PATH]);
});

test('a first v3 build needs no earlier receipt', async () => {
	const dir = await scratch();
	const outDir = join(dir, 'out');
	await withHub({}, async (hub) => {
		assert.equal((await step(hub, { outDir }).run()).status, 'verified');
	});
	assert.deepEqual(JSON.parse(await readFile(join(outDir, 'projection.json'), 'utf8')), receipt(1));
	await rm(dir, { recursive: true, force: true });
});

test('a dispatched seq lower than the last accepted seq fails before any hub fetch', async () => {
	const { dir, outDir } = await previousBuild();
	await writeFile(join(outDir, 'projection.json'), JSON.stringify(receipt(2)));
	await withHub({}, async (hub) => {
		await assert.rejects(step(hub, { outDir }).run, /lower than the last accepted seq 2/);
		assert.deepEqual(hub.calls, [RECEIPT_PATH]);
	});
	await rm(dir, { recursive: true, force: true });
});

test('the live receipt sets the last accepted seq for a dispatch on a fresh checkout', async () => {
	const dir = await scratch();
	const outDir = join(dir, 'out');
	await withHub({ live: receipt(2) }, async (hub) => {
		await assert.rejects(step(hub, { outDir }).run, /lower than the last accepted seq 2/);
		assert.deepEqual(hub.calls, [RECEIPT_PATH]);
	});
	await assert.rejects(readdir(outDir), { code: 'ENOENT' });
	await rm(dir, { recursive: true, force: true });
});

test('a dispatch refuses to run when the live receipt cannot be read', async () => {
	await assertRefusedAndUntouched({ live: 503 }, {});
});

test('a signed seq lower than the last accepted seq fails closed', async () => {
	const { dir, outDir } = await previousBuild();
	await writeFile(join(outDir, 'projection.json'), JSON.stringify(receipt(2)));
	const before = await tree(outDir);
	await withHub({}, async (hub) => {
		const { run, logs } = step(hub, {
			outDir,
			inputs: { contract: FIXTURE_CONTRACT, base: hub.base, manifest: VALID_BLOG.manifest, seq: 2 },
		});
		await assert.rejects(run, StepError);
		assert.ok(logs.some((line) => line.includes('seq_regressed')), logs.join(' | '));
	});
	assert.deepEqual(await tree(outDir), before);
	await rm(dir, { recursive: true, force: true });
});

test("the firm target's manifest fails closed on the blog", async () => {
	const firm = (hub) => ({ inputs: { contract: FIXTURE_CONTRACT, base: hub.base, ...VALID_FIRM } });
	await assertRefusedAndUntouched({ overlay: 'tampered/wrong-target' }, firm, 'target_mismatch');
	// Without the overlay the firm manifest is not served at a blog address at all.
	await assertRefusedAndUntouched({}, firm, 'fetch_missing');
});

test('a base outside the allowlist fails before any fetch', async () => {
	const calls = await assertRefusedAndUntouched({}, {
		inputs: { contract: FIXTURE_CONTRACT, ...VALID_BLOG, base: 'https://elsewhere.example' },
	});
	assert.deepEqual(calls, []);
});

test('the placeholder key refuses dispatch inputs and fetches nothing', async () => {
	assert.deepEqual(await assertRefusedAndUntouched({}, { key: placeholder }), []);
});

test('the placeholder key with no inputs builds no notes and fetches nothing', async () => {
	const { dir, outDir } = await previousBuild();
	await withHub({}, async (hub) => {
		const { run, logs } = step(hub, { outDir, key: placeholder, inputs: null });
		assert.deepEqual(await run(), { status: 'empty' });
		assert.deepEqual(hub.calls, []);
		assert.ok(logs.some((line) => line.includes('placeholder')));
	});
	await assert.rejects(readdir(outDir), { code: 'ENOENT' });
	await rm(dir, { recursive: true, force: true });
});

test('no inputs and no live receipt builds no notes', async () => {
	const dir = await scratch();
	const outDir = join(dir, 'out');
	await withHub({}, async (hub) => {
		assert.deepEqual(await step(hub, { outDir, inputs: null }).run(), { status: 'empty' });
		assert.deepEqual(hub.calls, [RECEIPT_PATH]);
	});
	await assert.rejects(readdir(outDir), { code: 'ENOENT' });
	await rm(dir, { recursive: true, force: true });
});

test('no inputs rebuilds the live receipt and verifies it in full', async () => {
	const dir = await scratch();
	const outDir = join(dir, 'out');
	await withHub({ live: receipt(1) }, async (hub) => {
		assert.equal((await step(hub, { outDir, inputs: null }).run()).status, 'verified');
	});
	assert.deepEqual(JSON.parse(await readFile(join(outDir, 'projection.json'), 'utf8')), receipt(1));
	await rm(dir, { recursive: true, force: true });
});

test('no inputs refuses a live receipt whose manifest no longer verifies', () =>
	assertRefusedAndUntouched({ overlay: 'tampered/bad-signature', live: receipt(1) }, { inputs: null }, 'signature_invalid'));

test('no inputs refuses when the live receipt cannot be read', async () => {
	await assertRefusedAndUntouched({ live: 503 }, { inputs: null });
	await assertRefusedAndUntouched({ live: { seq: 1 } }, { inputs: null });
	await assertRefusedAndUntouched({ live: receipt(1) }, (hub) => ({
		inputs: null,
		config: fixtureConfig(hub.base, { recoveryBase: null }),
	}));
});

test('the step lets no http base through unless a test asks for it', async () => {
	// The production entry never sets allowLoopbackHttpForTests, so the
	// module refuses the loopback base before it fetches from it.
	const calls = await assertRefusedAndUntouched({}, { allowLoopbackHttpForTests: false }, 'base_url_invalid');
	assert.deepEqual(calls, [RECEIPT_PATH]);
});

test('dispatch inputs are all four or none, each in its contract format, with the contract first', () => {
	assert.equal(readInputs({}), null);
	const good = {
		PROJECTION_CONTRACT: CONTRACT,
		PROJECTION_MANIFEST: VALID_BLOG.manifest,
		PROJECTION_SEQ: '12',
		PROJECTION_BASE: 'https://hub.example',
	};
	assert.deepEqual(readInputs(good), {
		contract: 'xoxd-projection/v3',
		manifest: VALID_BLOG.manifest,
		seq: 12,
		base: 'https://hub.example',
	});
	const bad = [
		{ PROJECTION_MANIFEST: VALID_BLOG.manifest },
		{ ...good, PROJECTION_CONTRACT: '' },
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
	// Another contract is named in the refusal even when every other input is bad or missing.
	for (const contract of ['xoxd-projection/v2', 'xoxd-projection/v3 ', 'XOXD-PROJECTION/V3', 'v3']) {
		assert.throws(() => readInputs({ ...good, PROJECTION_CONTRACT: contract }), /contract must be exactly xoxd-projection\/v3/);
		assert.throws(
			() => readInputs({ PROJECTION_CONTRACT: contract, PROJECTION_SEQ: '0' }),
			/contract must be exactly xoxd-projection\/v3/,
		);
	}
	assert.throws(() => readInputs({ ...good, PROJECTION_CONTRACT: '' }), /all four dispatch inputs/);
});

test("the fixture key is the one the module's own tests verify the fixtures with", async () => {
	const helpers = process.env.XOXD_PROJECTION_HELPERS;
	assert.ok(helpers, 'XOXD_PROJECTION_HELPERS is not set');
	const text = await readFile(helpers, 'utf8');
	assert.ok(text.includes(`export const FIXTURE_PUBLIC_KEY = '${FIXTURE_KEY}';`), 'test/helpers.ts carries another fixture key');
	assert.ok(text.includes(`export const VALID_BLOG = '${VALID_BLOG.manifest}';`), 'test/helpers.ts names another valid blog manifest');
	assert.ok(text.includes(`export const VALID_FIRM = '${VALID_FIRM.manifest}';`), 'test/helpers.ts names another valid firm manifest');
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
	await withHub({}, (hub) => step(hub, { outDir: copy }).run());
	assert.deepEqual(await tree(copy), before);
	await rm(dir, { recursive: true, force: true });
});

test('the dispatch carrier check refuses another ref, another contract, bad inputs, a base off the allowlist and the placeholder key', () => {
	const base = 'https://hub.example';
	const env = {
		GITHUB_REF: 'refs/heads/main',
		PROJECTION_CONTRACT: CONTRACT,
		PROJECTION_MANIFEST: VALID_BLOG.manifest,
		PROJECTION_SEQ: '1',
		PROJECTION_BASE: base,
	};
	const configText = JSON.stringify({
		target: 'blog',
		origin: 'https://transscendsurvival.org',
		publicKeyFile: 'hub-ed25519.pub',
		outDir: 'src/lib/projection-data',
		allowedBases: [base],
		recoveryBase: base,
	});
	const realKey = `${'A'.repeat(43)}=\n`;
	assert.deepEqual(checkDispatch({ env, configText, keyText: realKey }), {
		contract: 'xoxd-projection/v3',
		manifest: VALID_BLOG.manifest,
		seq: 1,
		base,
	});
	assert.throws(() => checkDispatch({ env: { ...env, GITHUB_REF: 'refs/heads/feature' }, configText, keyText: realKey }), /refs\/heads\/main/);
	assert.throws(
		() => checkDispatch({ env: { ...env, PROJECTION_CONTRACT: 'xoxd-projection/v2' }, configText, keyText: realKey }),
		/contract must be exactly xoxd-projection\/v3/,
	);
	const { PROJECTION_CONTRACT: _dropped, ...threeInputs } = env;
	assert.throws(() => checkDispatch({ env: threeInputs, configText, keyText: realKey }), /all four dispatch inputs/);
	assert.throws(() => checkDispatch({ env: { ...env, PROJECTION_SEQ: '01' }, configText, keyText: realKey }), /seq must be/);
	assert.throws(() => checkDispatch({ env: { GITHUB_REF: 'refs/heads/main' }, configText, keyText: realKey }), /all four inputs/);
	assert.throws(
		() => checkDispatch({ env: { ...env, PROJECTION_BASE: 'https://elsewhere.example' }, configText, keyText: realKey }),
		/not in the allowedBases/,
	);
	assert.throws(() => checkDispatch({ env, configText, keyText: PLACEHOLDER_KEY }), /placeholder/);
});
