#!/usr/bin/env node
/**
 * The projection step for target "blog". It runs before the site build and
 * leaves src/lib/projection-data either holding a verified projection or
 * absent. The site build reads only that directory.
 *
 * It takes the three dispatch inputs as environment values:
 * PROJECTION_MANIFEST, PROJECTION_SEQ and PROJECTION_BASE. All three or none.
 *
 * With the inputs, it checks their formats and the base allowlist in
 * projection/config.json. It reads the last accepted seq from the receipt the
 * live site serves and refuses a lower seq before it fetches from the hub.
 * Then it fetches and verifies that manifest and its blobs with the
 * xoxd_projection module against the pinned key.
 *
 * With no inputs, the last accepted projection is the one the live site
 * serves. The step reads the receipt at <origin>/.well-known/projection.json.
 * A 404 there means nothing was ever accepted, so the site builds with no
 * notes. A receipt means the step fetches that same manifest again from the
 * pinned recovery base and verifies it in full, as an equal-seq rebuild. Any
 * other answer fails the step. So no build drops live notes by accident, and
 * no build takes content that did not verify.
 *
 * The placeholder key verifies nothing. With it and no inputs, the step
 * removes any old output and the site builds with no notes. With it and
 * inputs, the step fails.
 *
 * Exit codes: 0 done, 1 refused, 2 usage or configuration error.
 */
import { readdir, readFile, rm } from 'node:fs/promises';
import { isAbsolute, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

export const TARGET = 'blog';
export const ORIGIN = 'https://transscendsurvival.org';
export const CONTRACT = 'xoxd-projection/v2';

/** The committed placeholder. It is not base64 of 32 bytes, so no verifier accepts it. */
export const PLACEHOLDER_KEY = 'PLACEHOLDER-NOT-A-KEY-replace-with-the-hub-ed25519-public-key-before-merge';

/** The contract's published test key. It signs the fixtures only and must never be pinned. */
export const FIXTURE_KEY = 'Wjm7prpw08+jKXNn2uO49GlsuB2p61fDad8MeU0/vVs=';

const KEY_PATTERN = /^[A-Za-z0-9+/]{43}=$/;
const MANIFEST_PATTERN = /^[0-9a-f]{64}$/;
const SEQ_PATTERN = /^[1-9][0-9]*$/;
const BASE_PATTERN = /^https:\/\/[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+(:[1-9][0-9]{0,4})?$/;
const RECEIPT_KEYS = ['contract', 'manifest', 'seq', 'target'];

export const INPUT_ENV = Object.freeze({
	manifest: 'PROJECTION_MANIFEST',
	seq: 'PROJECTION_SEQ',
	base: 'PROJECTION_BASE',
});

/** A refusal. code 1 is a projection refusal, code 2 a usage or configuration error. */
export class StepError extends Error {
	constructor(message, code = 1) {
		super(message);
		this.code = code;
	}
}

/** True when a value is an https origin with no path, query, fragment or trailing slash. */
export function isProjectionBase(value) {
	if (typeof value !== 'string' || !BASE_PATTERN.test(value)) return false;
	try {
		return new URL(value).origin === value;
	} catch {
		return false;
	}
}

/** Checks projection/config.json. It pins the target, the origin and the base allowlist. */
export function parseConfig(text) {
	let config;
	try {
		config = JSON.parse(text);
	} catch {
		throw new StepError('projection/config.json is not JSON', 2);
	}
	const keys = Object.keys(config ?? {}).sort().join(',');
	if (keys !== 'allowedBases,origin,outDir,publicKeyFile,recoveryBase,target') {
		throw new StepError('projection/config.json must hold exactly allowedBases, origin, outDir, publicKeyFile, recoveryBase and target', 2);
	}
	if (config.target !== TARGET) throw new StepError(`projection/config.json target must be ${TARGET}`, 2);
	if (config.origin !== ORIGIN) throw new StepError(`projection/config.json origin must be ${ORIGIN}`, 2);
	if (config.outDir !== 'src/lib/projection-data') {
		throw new StepError('projection/config.json outDir must be src/lib/projection-data', 2);
	}
	if (typeof config.publicKeyFile !== 'string' || !/^[a-z0-9-]+\.pub$/.test(config.publicKeyFile)) {
		throw new StepError('projection/config.json publicKeyFile must be a file name in projection/', 2);
	}
	if (!Array.isArray(config.allowedBases) || !config.allowedBases.every(isProjectionBase)) {
		throw new StepError('projection/config.json allowedBases must list https origins', 2);
	}
	if (new Set(config.allowedBases).size !== config.allowedBases.length) {
		throw new StepError('projection/config.json allowedBases has a duplicate', 2);
	}
	if (config.recoveryBase !== null && !config.allowedBases.includes(config.recoveryBase)) {
		throw new StepError('projection/config.json recoveryBase must be null or one of allowedBases', 2);
	}
	return Object.freeze(config);
}

/** Reads the pinned key file text. Returns { placeholder: true } or { placeholder: false, key }. */
export function parseKey(text) {
	const key = String(text).trim();
	if (key === PLACEHOLDER_KEY) return { placeholder: true, key: null };
	if (key === FIXTURE_KEY) throw new StepError('the pinned key is the contract test key, which must never be pinned', 2);
	if (!KEY_PATTERN.test(key)) throw new StepError('the pinned key must be 44 characters of standard base64', 2);
	return { placeholder: false, key };
}

/** The dispatch inputs from the environment, or null when none is set. */
export function readInputs(env) {
	const raw = {
		manifest: env[INPUT_ENV.manifest] ?? '',
		seq: env[INPUT_ENV.seq] ?? '',
		base: env[INPUT_ENV.base] ?? '',
	};
	const given = Object.values(raw).filter((value) => value !== '').length;
	if (given === 0) return null;
	if (given !== 3) throw new StepError('set all three dispatch inputs or none', 2);
	if (!MANIFEST_PATTERN.test(raw.manifest)) throw new StepError('manifest must be 64 lowercase hex characters', 2);
	if (!SEQ_PATTERN.test(raw.seq) || !Number.isSafeInteger(Number(raw.seq))) {
		throw new StepError('seq must be a decimal integer of 1 or more with no sign and no leading zero', 2);
	}
	if (!isProjectionBase(raw.base)) {
		throw new StepError('projection_base must be an https origin with no path, query, fragment or trailing slash', 2);
	}
	return Object.freeze({ manifest: raw.manifest, seq: Number(raw.seq), base: raw.base });
}

/** Checks a receipt object as the module writes it and the site serves it. */
export function parseReceipt(value, where) {
	const keys = Object.keys(value ?? {}).sort().join(',');
	if (
		keys !== RECEIPT_KEYS.join(',') ||
		value.contract !== CONTRACT ||
		value.target !== TARGET ||
		!Number.isSafeInteger(value.seq) ||
		value.seq < 1 ||
		typeof value.manifest !== 'string' ||
		!MANIFEST_PATTERN.test(value.manifest)
	) {
		throw new StepError(`${where} is not a ${CONTRACT} receipt for ${TARGET}`);
	}
	return Object.freeze({ seq: value.seq, manifest: value.manifest });
}

/**
 * The receipt the live site serves, or null when it answers 404. Any other
 * answer is a refusal, because building without it could drop live notes.
 */
export async function fetchLiveReceipt(fetch, origin) {
	const url = `${origin}/.well-known/projection.json`;
	let response;
	try {
		response = await fetch(url);
	} catch (error) {
		throw new StepError(`could not read ${url}: ${error instanceof Error ? error.message : String(error)}`);
	}
	if (response.status === 404) return null;
	if (response.status !== 200) throw new StepError(`${url} answered ${response.status}`);
	let value;
	try {
		value = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(await response.arrayBuffer()));
	} catch {
		throw new StepError(`${url} is not JSON`);
	}
	return parseReceipt(value, url);
}

/** Counts the verified entries by where this site places them. */
export async function summarize(outDir) {
	const counts = { notes: 0, blog: 0, other: 0 };
	const postsDir = join(outDir, 'posts');
	for (const name of (await readdir(postsDir)).sort()) {
		if (!name.endsWith('.json')) continue;
		const post = JSON.parse(await readFile(join(postsDir, name), 'utf8'));
		if (/^\/notes\/[^/]+$/.test(post.path) && post.path === `/notes/${post.slug}`) counts.notes += 1;
		else if (post.path.startsWith('/blog/')) counts.blog += 1;
		else counts.other += 1;
	}
	return counts;
}

async function verifyInto(projection, options, log) {
	const result = await projection.fetchProjection(options);
	if (!result.ok) {
		for (const item of result.findings) log(`projection: ${item.code} at ${item.at}: ${item.detail}`);
		throw new StepError(`projection: refused with ${result.findings.length} findings`);
	}
	const counts = await summarize(options.outDir);
	log(`projection: verified ${result.receipt.target} seq ${result.receipt.seq} manifest ${result.receipt.manifest}`);
	log(
		`projection: ${counts.notes} notes built, ${counts.blog} entries with a /blog path ignored (articles stay on their files until the cutover), ${counts.other} other entries ignored`,
	);
	return { status: 'verified', receipt: result.receipt, counts };
}

/**
 * The step itself. projection is the xoxd_projection ./fetch module. fetch is
 * a WHATWG fetch that must not follow redirects. Tests pass the contract
 * fixture key and a fetch that serves the fixture tree.
 */
export async function runProjectionStep({ config, key, inputs, outDir, projection, fetch, log = console.log }) {
	if (inputs !== null) {
		if (key.placeholder) {
			throw new StepError('projection: the pinned hub key is the placeholder, so a dispatched projection is refused');
		}
		if (!config.allowedBases.includes(inputs.base)) {
			throw new StepError(`projection: ${inputs.base} is not in the allowedBases of projection/config.json`);
		}
		const last = await lastAccepted(projection, fetch, config.origin, outDir);
		if (inputs.seq < last.lastSeq) {
			throw new StepError(`projection: dispatched seq ${inputs.seq} is lower than the last accepted seq ${last.lastSeq}`);
		}
		return verifyInto(
			projection,
			{
				baseUrl: inputs.base,
				target: TARGET,
				manifestSha256: inputs.manifest,
				seq: inputs.seq,
				lastSeq: last.lastSeq,
				lastManifest: last.lastManifest,
				publicKey: key.key,
				outDir,
				fetch,
			},
			log,
		);
	}

	if (key.placeholder) {
		await rm(outDir, { recursive: true, force: true });
		log('projection: the pinned hub key is a placeholder, so this build has no notes');
		return { status: 'empty' };
	}

	const live = await fetchLiveReceipt(fetch, config.origin);
	if (live === null) {
		await rm(outDir, { recursive: true, force: true });
		log(`projection: ${config.origin} serves no projection receipt, so this build has no notes`);
		return { status: 'empty' };
	}
	if (config.recoveryBase === null) {
		throw new StepError('projection: the live site serves a receipt but projection/config.json names no recoveryBase');
	}
	log(`projection: no dispatch inputs, rebuilding the live seq ${live.seq} manifest ${live.manifest}`);
	return verifyInto(
		projection,
		{
			baseUrl: config.recoveryBase,
			target: TARGET,
			manifestSha256: live.manifest,
			seq: live.seq,
			lastSeq: live.seq,
			lastManifest: live.manifest,
			publicKey: key.key,
			outDir,
			fetch,
		},
		log,
	);
}

/**
 * The last accepted build: the receipt the live site serves, or the one a
 * previous run left in the output directory, whichever has the higher seq.
 * A CI checkout starts empty, so the live receipt is the one that counts
 * there. Neither one means a first build.
 */
export async function lastAccepted(projection, fetch, origin, outDir) {
	const live = await fetchLiveReceipt(fetch, origin);
	let local;
	try {
		local = await projection.readLastBuild(join(outDir, projection.OUTPUT.receipt), TARGET, true);
	} catch (error) {
		throw new StepError(`projection: the receipt in ${outDir} is unreadable: ${error instanceof Error ? error.message : String(error)}`);
	}
	if (live !== null && live.seq >= local.lastSeq) return { lastSeq: live.seq, lastManifest: live.manifest };
	return local;
}

/** Loads the module's ./fetch export from the Bazel-built package directory. */
export async function loadProjectionModule(env = process.env) {
	const pkg = env.XOXD_PROJECTION_PKG;
	if (!pkg) throw new StepError('XOXD_PROJECTION_PKG is not set; run the step with bazel run //projection:step', 2);
	const candidates = isAbsolute(pkg)
		? [pkg]
		: [resolve(process.cwd(), pkg), ...(env.JS_BINARY__RUNFILES ? [resolve(env.JS_BINARY__RUNFILES, '_main', pkg)] : [])];
	let lastError;
	for (const dir of candidates) {
		try {
			return await import(pathToFileURL(join(dir, 'dist', 'fetch.js')).href);
		} catch (error) {
			lastError = error;
		}
	}
	throw new StepError(`could not load @xoxd/projection from ${pkg}: ${lastError?.message ?? 'not found'}`, 2);
}

/** The command: bazel run //projection:step. projection/cli.mjs calls it. */
export async function main() {
	// Under bazel run the process starts in the runfiles tree. The repository
	// is the directory the command was typed in.
	const repoRoot = process.env.BUILD_WORKING_DIRECTORY ?? process.cwd();
	try {
		const config = parseConfig(await readFile(join(repoRoot, 'projection', 'config.json'), 'utf8'));
		const key = parseKey(await readFile(join(repoRoot, 'projection', config.publicKeyFile), 'utf8'));
		const inputs = readInputs(process.env);
		const projection = await loadProjectionModule();
		await runProjectionStep({
			config,
			key,
			inputs,
			outDir: join(repoRoot, config.outDir),
			projection,
			// No redirect is followed, so every request stays on the https URL it names.
			fetch: (url) => globalThis.fetch(url, { redirect: 'error' }),
		});
		return 0;
	} catch (error) {
		process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
		return error instanceof StepError ? error.code : 1;
	}
}
