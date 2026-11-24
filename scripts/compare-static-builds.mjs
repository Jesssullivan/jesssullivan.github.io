#!/usr/bin/env node
/**
 * Compares a candidate static build with two builds of the base commit
 * (TIN-8654). Files that already differ between the two base builds are the
 * baseline noise. Every other file of the base build must exist in the
 * candidate with the same bytes. Files only the candidate has are listed.
 *
 * A second pass reads the noise. SvelteKit stamps each build with a time
 * based version, so the hashed names under _app/immutable change from build
 * to build and every page links to them. The version also names the
 * __sveltekit_ global of each page. The RSS lastBuildDate and the
 * generated time of blog-stats.json are clock values. The pass replaces
 * those names and values with a fixed token. A noise page that is then equal
 * between the two base builds must also be equal in the candidate.
 *
 * Usage: node scripts/compare-static-builds.mjs <base-a> <base-b> <candidate>
 * Prints a JSON report. Exits 1 when a file outside _app/ is missing, a file
 * outside the noise changed, or a page changed in more than client wiring.
 */
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';

const [baseA, baseB, candidate] = process.argv.slice(2);
if (!baseA || !baseB || !candidate) {
	console.error('usage: node scripts/compare-static-builds.mjs <base-a> <base-b> <candidate>');
	process.exit(2);
}

function digests(root) {
	const out = new Map();
	const walk = (dir) => {
		for (const entry of readdirSync(dir, { withFileTypes: true })) {
			const path = join(dir, entry.name);
			if (entry.isDirectory()) walk(path);
			else out.set(relative(root, path), createHash('sha256').update(readFileSync(path)).digest('hex'));
		}
	};
	walk(root);
	return out;
}

const a = digests(baseA);
const b = digests(baseB);
const c = digests(candidate);

const baselineNoise = [...new Set([...a.keys(), ...b.keys()])].filter((path) => a.get(path) !== b.get(path)).sort();
const noise = new Set(baselineNoise);
const missing = [...a.keys()].filter((path) => !c.has(path) && !noise.has(path)).sort();
const changed = [...a.keys()].filter((path) => c.has(path) && !noise.has(path) && a.get(path) !== c.get(path)).sort();
const added = [...c.keys()].filter((path) => !a.has(path) && !b.has(path)).sort();

const TEXT = /\.(?:html|xml|json|txt)$/;
function normalized(root, path) {
	return readFileSync(join(root, path), 'utf8')
		.replace(/_app\/immutable\/[A-Za-z0-9_./-]+/g, '_app/immutable/#')
		.replace(/<lastBuildDate>[^<]*<\/lastBuildDate>/g, '<lastBuildDate>#</lastBuildDate>')
		.replace(/"generated": "[^"]*"/g, '"generated": "#"')
		.replace(/"version":"\d+"/g, '"version":"#"')
		.replace(/__sveltekit_[a-z0-9]+/g, '__sveltekit_#');
}
const comparable = baselineNoise.filter(
	(path) => TEXT.test(path) && !path.startsWith('_app/') && a.has(path) && b.has(path),
);
const stableAfterNormalizing = comparable.filter((path) => normalized(baseA, path) === normalized(baseB, path));
const normalizedChanged = stableAfterNormalizing.filter(
	(path) => !c.has(path) || normalized(baseA, path) !== normalized(candidate, path),
);

// A new route renumbers the SvelteKit client nodes after it, and a component
// shared with a new page moves into its own chunk, so a page can name other
// node ids and preload one more chunk. That is client wiring. The third
// pass removes it and compares what is left: the markup, text and data.
function contentOnly(root, path) {
	return normalized(root, path)
		.replace(/node_ids: \[[0-9, ]*\]/g, 'node_ids: [#]')
		.replace(/[ \t]*<link href="[./]*_app\/immutable\/#" rel="modulepreload">\n?/g, '');
}
const contentChanged = normalizedChanged.filter(
	(path) => !c.has(path) || contentOnly(baseA, path) !== contentOnly(candidate, path),
);
const missingOutsideApp = missing.filter((path) => !path.startsWith('_app/'));

const report = {
	baseFiles: a.size,
	candidateFiles: c.size,
	baselineNoise,
	identicalOutsideNoise: [...a.keys()].filter((path) => !noise.has(path) && a.get(path) === c.get(path)).length,
	missing,
	changed,
	added,
	noiseComparedAfterNormalizing: stableAfterNormalizing.length,
	noiseStillVolatileAfterNormalizing: comparable.filter((path) => !stableAfterNormalizing.includes(path)),
	normalizedChanged,
	contentChanged,
	missingOutsideApp,
};
console.log(JSON.stringify(report, null, 2));
process.exitCode = missingOutsideApp.length || changed.length || contentChanged.length ? 1 : 0;
