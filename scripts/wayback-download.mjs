#!/usr/bin/env node
/**
 * Wayback Machine Media Downloader
 *
 * Downloads archived media files from the Wayback Machine.
 * Reads a CDX query result JSON and downloads images that
 * don't already exist locally.
 *
 * Usage:
 *   node scripts/wayback-download.mjs <cdx-results.json> [options]
 *
 * Options:
 *   --dry-run         Show what would be downloaded without downloading
 *   --skip-existing   Skip files that already exist locally (default: true)
 *   --output-dir <d>  Output directory (default: static/images/posts)
 *   --rate-limit <ms> Milliseconds between requests (default: 3000)
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { buildWaybackUrl, extractFilename, normalizeWpImageUrl } from './wayback-utils.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

const args = process.argv.slice(2);
const inputFile = args.find((a) => !a.startsWith('--'));
const dryRun = args.includes('--dry-run');
const outputDirIdx = args.indexOf('--output-dir');
const outputDir = outputDirIdx >= 0 ? args[outputDirIdx + 1] : join(root, 'static', 'images', 'posts');
const rateLimitIdx = args.indexOf('--rate-limit');
const rateLimit = rateLimitIdx >= 0 ? parseInt(args[rateLimitIdx + 1]) : 3000;

if (!inputFile) {
	console.error('Usage: node scripts/wayback-download.mjs <cdx-results.json> [--dry-run] [--output-dir <dir>]');
	process.exit(1);
}

const records = JSON.parse(readFileSync(inputFile, 'utf-8'));
console.error(`Loaded ${records.length} CDX records from ${inputFile}`);

if (!existsSync(outputDir)) {
	mkdirSync(outputDir, { recursive: true });
}

// Deduplicate by normalized URL (keep latest timestamp)
const byUrl = new Map();
for (const r of records) {
	const normalized = normalizeWpImageUrl(r.original);
	const existing = byUrl.get(normalized);
	if (!existing || r.timestamp > existing.timestamp) {
		byUrl.set(normalized, r);
	}
}

console.error(`${byUrl.size} unique URLs after deduplication.`);

let downloaded = 0;
let skipped = 0;
let failed = 0;

async function downloadWithRetry(url, retries = 3) {
	for (let attempt = 1; attempt <= retries; attempt++) {
		try {
			const res = await fetch(url);
			if (res.status === 429) {
				const wait = Math.pow(2, attempt) * 3000;
				console.error(`  Rate limited. Waiting ${wait / 1000}s...`);
				await new Promise((r) => setTimeout(r, wait));
				continue;
			}
			if (!res.ok) throw new Error(`HTTP ${res.status}`);
			return Buffer.from(await res.arrayBuffer());
		} catch (err) {
			if (attempt === retries) throw err;
			const wait = Math.pow(2, attempt) * 1000;
			console.error(`  Retry ${attempt}/${retries}: ${err.message}`);
			await new Promise((r) => setTimeout(r, wait));
		}
	}
}

for (const [normalized, record] of byUrl) {
	const filename = extractFilename(normalized);
	const outputPath = join(outputDir, filename);

	if (existsSync(outputPath)) {
		skipped++;
		continue;
	}

	const waybackUrl = buildWaybackUrl(record.timestamp, record.original);

	if (dryRun) {
		console.log(`WOULD DOWNLOAD: ${filename}`);
		console.log(`  From: ${waybackUrl}`);
		console.log(`  To:   ${outputPath}`);
		downloaded++;
		continue;
	}

	try {
		console.error(`Downloading: ${filename}`);
		console.error(`  URL: ${waybackUrl}`);
		const data = await downloadWithRetry(waybackUrl);
		writeFileSync(outputPath, data);
		downloaded++;
		console.error(`  Saved: ${outputPath} (${data.length} bytes)`);
	} catch (err) {
		console.error(`  FAILED: ${err.message}`);
		failed++;
	}

	// Rate limiting
	if (!dryRun) {
		await new Promise((r) => setTimeout(r, rateLimit));
	}
}

console.error('\n' + '='.repeat(60));
console.error(`Downloaded: ${downloaded}`);
console.error(`Skipped (existing): ${skipped}`);
console.error(`Failed: ${failed}`);
console.error('='.repeat(60));
