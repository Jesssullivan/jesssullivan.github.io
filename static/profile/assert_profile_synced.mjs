#!/usr/bin/env node
// Fails when static/profile/ drifts from @spear_resumes//profile (R53).
// The expected file set comes from the source facts.json itself ("svgs" and
// the "images" src/src_dark paths). The test fails on a stale file, on a file
// the source has that static/profile lacks, and on a file static/profile still
// carries that the source no longer has (a deletion upstream).
import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const roots = unique([
	process.cwd(),
	process.env.RUNFILES_DIR,
	resolve(scriptDir, '..', '..'),
	resolve(scriptDir, '..', '..', '..'),
]);

const sourcePrefixes = ['../spear_resumes+/profile/out/', 'spear_resumes+/profile/out/'];
const staticPrefix = 'static/profile/';

const sourceFactsPath = resolveExisting(sourcePrefixes.map((p) => `${p}facts.json`));
const sourceFacts = JSON.parse(readFileSync(sourceFactsPath, 'utf8'));

if (sourceFacts.schema !== 1) {
	throw new Error(`unexpected facts.json schema ${sourceFacts.schema}; the /about page reads schema 1`);
}

const relPaths = unique([
	'facts.json',
	...(sourceFacts.svgs ?? []),
	...(sourceFacts.images ?? []).flatMap((img) => [img.src, img.src_dark]),
]);

let failures = 0;

for (const rel of relPaths) {
	const source = readFileSync(resolveExisting(sourcePrefixes.map((p) => `${p}${rel}`)));
	let staticPath;
	try {
		staticPath = resolveExisting([`${staticPrefix}${rel}`]);
	} catch {
		failures += 1;
		console.error(`${rel}: missing from static/profile (or from //static/profile:public_files)`);
		continue;
	}
	const current = readFileSync(staticPath);
	if (source.equals(current)) {
		console.log(`${rel}: synced (${digest(source)}, ${source.length} bytes)`);
		continue;
	}
	failures += 1;
	console.error(
		`${rel}: stale; source=${digest(source)} (${source.length} bytes), static=${digest(current)} (${current.length} bytes)`,
	);
}

// Deletions / strays: every file under static/profile/{svg,img} must be in the
// expected set, and so must every file the source filegroups ship.
const expected = new Set(relPaths);
for (const sub of ['svg', 'img']) {
	for (const [label, prefixes] of [
		['static/profile', [staticPrefix]],
		['source', sourcePrefixes],
	]) {
		const dir = resolveDir(prefixes.map((p) => `${p}${sub}`));
		if (!dir) {
			failures += 1;
			console.error(`${label}: no ${sub}/ directory`);
			continue;
		}
		for (const name of readdirSync(dir)) {
			const rel = `${sub}/${name}`;
			if (!expected.has(rel)) {
				failures += 1;
				console.error(`${label}: ${rel} is not listed in the source facts.json (svgs/images); re-sync or remove it`);
			}
		}
	}
}

if (failures > 0) {
	throw new Error(`${failures} profile artifact(s) are stale or missing; run bazel run //static/profile:sync_profile`);
}

function resolveExisting(candidates) {
	for (const root of roots) {
		for (const candidate of candidates) {
			const path = resolve(root, candidate);
			if (existsSync(path)) {
				return path;
			}
		}
	}
	throw new Error(`Unable to resolve runfile from candidates: ${candidates.join(', ')}`);
}

function resolveDir(candidates) {
	for (const root of roots) {
		for (const candidate of candidates) {
			const path = resolve(root, candidate);
			if (existsSync(path) && statSync(path).isDirectory()) {
				return path;
			}
		}
	}
	return null;
}

function digest(data) {
	return createHash('sha256').update(data).digest('hex');
}

function unique(values) {
	return [...new Set(values.filter(Boolean))];
}
