/**
 * Bundle Size Reporter
 *
 * Reads the SvelteKit build output and reports JS/CSS chunk sizes.
 * Outputs a summary table and optionally writes JSON for tracking.
 */

import { readdirSync, statSync, writeFileSync } from 'fs';
import { join, dirname, extname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const buildDir = join(__dirname, '..', 'build');
const immutableDir = join(buildDir, '_app', 'immutable');

function walkFiles(dir) {
	const results = [];
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

function formatBytes(bytes) {
	if (bytes < 1024) return `${bytes} B`;
	const kb = bytes / 1024;
	if (kb < 1024) return `${kb.toFixed(1)} KB`;
	return `${(kb / 1024).toFixed(2)} MB`;
}

const files = walkFiles(immutableDir);
const chunks = { js: [], css: [], other: [] };

for (const file of files) {
	const ext = extname(file).toLowerCase();
	const size = statSync(file).size;
	const rel = file.replace(immutableDir + '/', '');
	const entry = { file: rel, size };

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
const report = {
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
