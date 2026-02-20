#!/usr/bin/env node
/**
 * Media Audit Script
 *
 * Scans all blog posts for image references and reports:
 * - Local images that exist
 * - Local images that are missing (broken)
 * - External WordPress/CDN URLs (should be localized)
 * - External non-WP URLs (informational)
 * - Images in wp-url-map.json that aren't referenced by any post
 *
 * Usage: node scripts/audit-media.mjs [--json]
 */

import { readFileSync, readdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { extractImageUrls, isExternalWpUrl, normalizeWpImageUrl, extractFilename } from './wayback-utils.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const postsDir = join(root, 'src', 'posts');
const staticDir = join(root, 'static');
const jsonOutput = process.argv.includes('--json');

// Load existing URL map
const urlMapPath = join(staticDir, 'images', 'wp-url-map.json');
const urlMap = existsSync(urlMapPath) ? JSON.parse(readFileSync(urlMapPath, 'utf-8')) : {};

// Gather local image files
function getLocalImages() {
	const imagesDir = join(staticDir, 'images', 'posts');
	if (!existsSync(imagesDir)) return new Set();
	return new Set(readdirSync(imagesDir));
}

const localImages = getLocalImages();
const files = readdirSync(postsDir).filter((f) => f.endsWith('.md'));

const report = {
	totalPosts: files.length,
	totalImageRefs: 0,
	localExisting: [],
	localMissing: [],
	externalWp: [],
	externalOther: [],
	unmappedUrlMapEntries: [],
};

// Track which wp-url-map entries are referenced
const referencedMapEntries = new Set();

for (const file of files) {
	const content = readFileSync(join(postsDir, file), 'utf-8');
	const images = extractImageUrls(content);
	report.totalImageRefs += images.length;

	for (const img of images) {
		const { url } = img;

		if (url.startsWith('/images/') || url.startsWith('./images/')) {
			// Local image reference
			const filename = url.split('/').pop();
			const staticPath = join(staticDir, url.startsWith('/') ? url.slice(1) : url);
			if (existsSync(staticPath)) {
				report.localExisting.push({ file, url });
			} else {
				report.localMissing.push({ file, url, filename });
			}
		} else if (isExternalWpUrl(url)) {
			// External WordPress URL
			const normalized = normalizeWpImageUrl(url);
			const mapped = urlMap[url] || null;
			if (mapped) referencedMapEntries.add(url);
			report.externalWp.push({ file, url, normalized, mapped });
		} else if (url.startsWith('http')) {
			// Other external URL
			report.externalOther.push({ file, url });
		}
	}
}

// Find wp-url-map entries not referenced by any post
for (const wpUrl of Object.keys(urlMap)) {
	if (!referencedMapEntries.has(wpUrl)) {
		report.unmappedUrlMapEntries.push({ wpUrl, localPath: urlMap[wpUrl] });
	}
}

if (jsonOutput) {
	console.log(JSON.stringify(report, null, 2));
} else {
	console.log('='.repeat(72));
	console.log('  MEDIA AUDIT REPORT');
	console.log('='.repeat(72));
	console.log();
	console.log(`Posts scanned: ${report.totalPosts}`);
	console.log(`Total image references: ${report.totalImageRefs}`);
	console.log(`Local images on disk: ${localImages.size}`);
	console.log(`URL map entries: ${Object.keys(urlMap).length}`);
	console.log();

	function section(title, items, showUrl = true) {
		const mark = items.length > 0 ? (title.includes('Missing') || title.includes('WordPress') ? 'WARN' : 'INFO') : 'PASS';
		console.log(`${mark}: ${title} (${items.length})`);
		console.log('-'.repeat(72));
		if (items.length === 0) {
			console.log('  (none)');
		} else {
			for (const item of items.slice(0, 20)) {
				console.log(`  ${item.file || ''}`);
				if (showUrl && item.url) console.log(`    ${item.url}`);
				if (item.mapped) console.log(`    -> mapped to: ${item.mapped}`);
				if (item.wpUrl) console.log(`    WP: ${item.wpUrl}`);
				if (item.localPath) console.log(`    Local: ${item.localPath}`);
			}
			if (items.length > 20) {
				console.log(`  ... and ${items.length - 20} more`);
			}
		}
		console.log();
	}

	section('Local Images (exist)', report.localExisting);
	section('Local Images (MISSING)', report.localMissing);
	section('External WordPress/CDN URLs', report.externalWp);
	section('External Other URLs', report.externalOther);
	section('Unmapped wp-url-map.json Entries', report.unmappedUrlMapEntries, false);

	const issues = report.localMissing.length + report.externalWp.length;
	console.log('='.repeat(72));
	if (issues > 0) {
		console.log(`ACTION NEEDED: ${issues} items require attention`);
		console.log(`  ${report.localMissing.length} missing local images`);
		console.log(`  ${report.externalWp.length} external WordPress URLs still in posts`);
	} else {
		console.log('ALL CLEAR — all images resolved locally, no external WP URLs.');
	}
	console.log('='.repeat(72));
}
