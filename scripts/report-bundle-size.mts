/**
 * Bundle Size Reporter
 *
 * Reads the SvelteKit build output and reports JS/CSS chunk sizes.
 * Outputs a summary table and optionally writes JSON for tracking.
 */

import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'fs';
import { gzipSync } from 'zlib';
import { join, dirname, extname } from 'path';
import { fileURLToPath } from 'url';
import type { BundleChunk, BundleReport } from './lib/types.mts';

const __dirname = dirname(fileURLToPath(import.meta.url));
const buildDir = join(__dirname, '..', 'build');
const immutableDir = join(buildDir, '_app', 'immutable');

function walkFiles(dir: string): string[] {
	const results: string[] = [];
	try {
		for (const entry of readdirSync(dir, { withFileTypes: true })) {
			const full = join(dir, entry.name);
			if (entry.isDirectory()) {
				results.push(...walkFiles(full));
			} else {
				results.push(full);
			}
		}
	} catch {
		// dir doesn't exist
	}
	return results;
}

function formatBytes(bytes: number): string {
	if (bytes < 1024) return `${bytes} B`;
	const kb = bytes / 1024;
	if (kb < 1024) return `${kb.toFixed(1)} KB`;
	return `${(kb / 1024).toFixed(2)} MB`;
}

const files = walkFiles(immutableDir);
const chunks: { js: BundleChunk[]; css: BundleChunk[]; other: BundleChunk[] } = { js: [], css: [], other: [] };

for (const file of files) {
	const ext = extname(file).toLowerCase();
	const size = statSync(file).size;
	const rel = file.replace(immutableDir + '/', '');
	const entry: BundleChunk = { file: rel, size };

	if (ext === '.js' || ext === '.mjs') chunks.js.push(entry);
	else if (ext === '.css') chunks.css.push(entry);
	else chunks.other.push(entry);
}

// Sort by size descending
for (const list of Object.values(chunks)) {
	list.sort((a, b) => b.size - a.size);
}

const totalJS = chunks.js.reduce((s, c) => s + c.size, 0);
const totalCSS = chunks.css.reduce((s, c) => s + c.size, 0);
const totalOther = chunks.other.reduce((s, c) => s + c.size, 0);
const total = totalJS + totalCSS + totalOther;

// Console output
console.log('Bundle Size Report');
console.log('='.repeat(60));
console.log(`Total: ${formatBytes(total)}`);
console.log(`  JS:    ${formatBytes(totalJS)} (${chunks.js.length} files)`);
console.log(`  CSS:   ${formatBytes(totalCSS)} (${chunks.css.length} files)`);
console.log(`  Other: ${formatBytes(totalOther)} (${chunks.other.length} files)`);
console.log();

// Warn on large chunks (>100KB)
const largeChunks = [...chunks.js, ...chunks.css].filter((c) => c.size > 100 * 1024);
if (largeChunks.length > 0) {
	console.log('Large chunks (> 100 KB):');
	for (const c of largeChunks) {
		console.log(`  ${c.file}: ${formatBytes(c.size)}`);
	}
	console.log();
}

// Top 10 JS chunks
if (chunks.js.length > 0) {
	console.log('Top JS chunks:');
	for (const c of chunks.js.slice(0, 10)) {
		console.log(`  ${formatBytes(c.size).padStart(10)}  ${c.file}`);
	}
	console.log();
}

// Write JSON report
const report: BundleReport = {
	timestamp: new Date().toISOString(),
	totals: { js: totalJS, css: totalCSS, other: totalOther, total },
	counts: { js: chunks.js.length, css: chunks.css.length, other: chunks.other.length },
	largeChunks: largeChunks.map((c) => ({ file: c.file, size: c.size })),
	topJS: chunks.js.slice(0, 10).map((c) => ({ file: c.file, size: c.size })),
};

if (process.argv.includes('--json')) {
	const outPath = join(__dirname, '..', 'bundle-report.json');
	writeFileSync(outPath, JSON.stringify(report, null, 2));
	console.log(`JSON report written to bundle-report.json`);
}

// ---------------------------------------------------------------------------
// Profile map budget (Appendix A, workstream C): the interactive map engine
// (mapScene, the WebGL2/2D layers, theme tokens and the d3-zoom/selection/
// delaunay/polygon code they pull in) is dynamically imported by
// ProjectMap.svelte on mount. Its chunks must stay within 45 KB gzipped and
// must never be reachable from the root layout or the app entry.

const MAP_BUDGET_GZ = 45 * 1024;
const ENGINE_SOURCES = [
	'src/lib/components/profile-map/mapScene.ts',
	'src/lib/components/profile-map/glLayer.ts',
	'src/lib/components/profile-map/canvasLayer.ts',
	'src/lib/components/profile-map/themeTokens.ts',
];
const ENGINE_PACKAGES = /node_modules\/(?:\.pnpm\/[^/]+\/node_modules\/)?(d3-zoom|d3-selection)\//;

interface ManifestChunk {
	file: string;
	src?: string;
	isEntry?: boolean;
	isDynamicEntry?: boolean;
	imports?: string[];
	dynamicImports?: string[];
}

function staticClosure(manifest: Record<string, ManifestChunk>, roots: string[]): Set<string> {
	const seen = new Set<string>();
	const stack = [...roots];
	while (stack.length) {
		const key = stack.pop()!;
		if (seen.has(key) || !manifest[key]) continue;
		seen.add(key);
		stack.push(...(manifest[key].imports ?? []));
	}
	return seen;
}

function checkProfileMapBudget(): number {
	const manifestPath = join(__dirname, '..', '.svelte-kit', 'output', 'client', '.vite', 'manifest.json');
	if (!existsSync(manifestPath)) {
		// A skip is only honest on a checkout that was never built. In CI, or
		// next to a build/ that exists without its manifest, it would hide a
		// missing or relocated manifest, so it fails instead.
		if (process.env.CI || existsSync(buildDir)) {
			console.log(
				`Profile map budget: FAIL, no Vite client manifest at ${manifestPath}` +
					(process.env.CI ? ' (CI is set)' : ' (build/ exists without it)'),
			);
			return 1;
		}
		console.log('Profile map budget: SKIPPED (no build/ and no Vite client manifest; run the build first)');
		return 0;
	}
	const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as Record<string, ManifestChunk>;
	const keys = Object.keys(manifest);
	const engineRoots = keys.filter(
		(k) => manifest[k].isDynamicEntry && (ENGINE_SOURCES.some((s) => k.endsWith(s)) || ENGINE_PACKAGES.test(k)),
	);
	const missing = ENGINE_SOURCES.filter((s) => !engineRoots.some((k) => k.endsWith(s)));
	let failures = 0;
	if (missing.length) {
		console.log(`Profile map budget: FAIL, not dynamically imported: ${missing.join(', ')}`);
		failures++;
	}

	const layoutRoots = keys.filter((k) => manifest[k].isEntry || /nodes\/0\.js$/.test(k));
	const layoutClosure = staticClosure(manifest, layoutRoots);
	// Route chunks that statically include ProjectMap (the /about and /projects nodes).
	const routeRoots = keys.filter((k) => /nodes\/\d+\.js$/.test(k) && !/nodes\/0\.js$/.test(k));
	const routeClosure = staticClosure(manifest, routeRoots);
	const engineClosure = staticClosure(manifest, engineRoots);

	const leaked = [...engineClosure].filter((k) => layoutClosure.has(k) && engineRoots.includes(k));
	if (leaked.length) {
		console.log(`Profile map budget: FAIL, engine chunks reachable from the layout entry: ${leaked.join(', ')}`);
		failures++;
	}

	// Cost of opening the map: engine chunks not already loaded by a route.
	const own = [...engineClosure].filter((k) => !routeClosure.has(k) && !layoutClosure.has(k));
	let gz = 0;
	console.log('Profile map engine chunks (dynamic, gzipped):');
	for (const k of own) {
		const file = join(buildDir, manifest[k].file);
		const size = existsSync(file) ? gzipSync(readFileSync(file), { level: 9 }).length : 0;
		gz += size;
		console.log(`  ${formatBytes(size).padStart(10)}  ${manifest[k].file}  (${k})`);
	}
	const verdict = gz <= MAP_BUDGET_GZ ? 'OK' : 'FAIL';
	console.log(`Profile map budget: ${verdict} ${formatBytes(gz)} gzipped of ${formatBytes(MAP_BUDGET_GZ)}`);
	if (gz > MAP_BUDGET_GZ) failures++;
	return failures;
}

console.log();
if (checkProfileMapBudget() > 0) {
	process.exitCode = 1;
}
