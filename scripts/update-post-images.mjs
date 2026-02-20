#!/usr/bin/env node
/**
 * Update Post Image References
 *
 * Replaces external WordPress CDN URLs in markdown posts with
 * local /images/posts/ paths. Updates wp-url-map.json.
 *
 * Usage:
 *   node scripts/update-post-images.mjs [options]
 *
 * Options:
 *   --dry-run   Show changes without writing (default)
 *   --apply     Actually write changes to files
 */

import { readFileSync, writeFileSync, readdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { extractImageUrls, isExternalWpUrl, normalizeWpImageUrl, extractFilename } from './wayback-utils.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const postsDir = join(root, 'src', 'posts');
const staticDir = join(root, 'static');
const imagesDir = join(staticDir, 'images', 'posts');

const args = process.argv.slice(2);
const apply = args.includes('--apply');
const dryRun = !apply;

if (dryRun) {
	console.log('DRY RUN — pass --apply to write changes.\n');
}

// Load existing URL map
const urlMapPath = join(staticDir, 'images', 'wp-url-map.json');
const urlMap = existsSync(urlMapPath) ? JSON.parse(readFileSync(urlMapPath, 'utf-8')) : {};

// Get existing local images
const localImages = existsSync(imagesDir) ? new Set(readdirSync(imagesDir)) : new Set();

const files = readdirSync(postsDir).filter((f) => f.endsWith('.md'));
let totalReplacements = 0;
let filesModified = 0;

for (const file of files) {
	const filePath = join(postsDir, file);
	let content = readFileSync(filePath, 'utf-8');
	const images = extractImageUrls(content);
	const wpImages = images.filter((img) => isExternalWpUrl(img.url));

	if (wpImages.length === 0) continue;

	let modified = false;

	for (const img of wpImages) {
		const { url } = img;
		const normalized = normalizeWpImageUrl(url);
		const filename = extractFilename(url);

		// Check if we already have this file locally
		if (!localImages.has(filename)) {
			console.log(`  SKIP (no local file): ${filename}`);
			console.log(`    From: ${url}`);
			continue;
		}

		const localPath = `/images/posts/${filename}`;

		// Replace in content
		const before = content;
		content = content.split(url).join(localPath);
		if (content !== before) {
			modified = true;
			totalReplacements++;
			urlMap[url] = localPath;
			console.log(`  ${file}: ${url}`);
			console.log(`    -> ${localPath}`);
		}
	}

	if (modified) {
		filesModified++;
		if (apply) {
			writeFileSync(filePath, content);
			console.log(`  WRITTEN: ${file}`);
		}
	}
}

// Update URL map
if (apply && totalReplacements > 0) {
	writeFileSync(urlMapPath, JSON.stringify(urlMap, null, 2) + '\n');
	console.log(`\nUpdated wp-url-map.json (${Object.keys(urlMap).length} entries)`);
}

console.log('\n' + '='.repeat(60));
console.log(`Files scanned: ${files.length}`);
console.log(`Files modified: ${filesModified}`);
console.log(`URL replacements: ${totalReplacements}`);
if (dryRun && totalReplacements > 0) {
	console.log('\nRun with --apply to write changes.');
}
console.log('='.repeat(60));
