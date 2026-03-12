#!/usr/bin/env node

/**
 * Download archived bird photography images from birdphoto.website via Wayback Machine.
 *
 * Usage:
 *   tsx scripts/download-birdphoto-images.mts           # download missing images
 *   tsx scripts/download-birdphoto-images.mts --dry-run  # preview what would be downloaded
 */

import { readdirSync, writeFileSync } from 'fs';
import { join, basename } from 'path';

const IMAGES_DIR = 'static/images/posts';
const CDX_API = 'https://web.archive.org/cdx/search/cdx';
const DRY_RUN = process.argv.includes('--dry-run');

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

interface CdxRow {
	timestamp: string;
	original: string;
	statuscode: string;
	mimetype: string;
	filename?: string;
}

async function fetchCdxRecords(mimetype: string): Promise<CdxRow[]> {
	const url = `${CDX_API}?url=api.birdphoto.website/image/*&output=json&fl=timestamp,original,statuscode,mimetype&filter=statuscode:200&filter=mimetype:${mimetype}&collapse=urlkey`;
	console.log(`Querying CDX API (${mimetype})...`);

	const resp = await fetch(url);
	if (!resp.ok) throw new Error(`CDX API error: ${resp.status}`);

	const rows: string[][] = await resp.json();
	if (rows.length < 2) return [];

	const [header, ...data] = rows;
	return data.map((row) => {
		const obj: Record<string, string> = {};
		header.forEach((key, i) => (obj[key] = row[i]));
		return obj as unknown as CdxRow;
	});
}

function extractFilename(originalUrl: string): string {
	try {
		const url = new URL(originalUrl.startsWith('http') ? originalUrl : `https://${originalUrl}`);
		return basename(url.pathname);
	} catch {
		return originalUrl.split('/').pop()?.split('?')[0] || '';
	}
}

function deduplicateByFilename(records: CdxRow[]): (CdxRow & { filename: string })[] {
	const byName = new Map<string, CdxRow & { filename: string }>();
	for (const rec of records) {
		const filename = extractFilename(rec.original);
		if (!filename || filename === 'image') continue;

		const key = filename.toLowerCase();
		const existing = byName.get(key);
		if (!existing || rec.timestamp > existing.timestamp) {
			byName.set(key, { ...rec, filename });
		}
	}
	return [...byName.values()];
}

function getExistingImages(): Set<string> {
	const files = readdirSync(IMAGES_DIR);
	return new Set(files.map((f) => f.toLowerCase()));
}

async function main(): Promise<void> {
	console.log(DRY_RUN ? '=== DRY RUN ===' : '=== Downloading birdphoto.website images ===');

	// Fetch both JPEG (full-res) and WebP (thumbnail) records
	const jpegRecords = await fetchCdxRecords('image/jpeg');
	const webpRecords = await fetchCdxRecords('image/webp');
	console.log(`CDX: ${jpegRecords.length} JPEG records, ${webpRecords.length} WebP records`);

	// Deduplicate JPEGs
	const jpegUnique = deduplicateByFilename(jpegRecords);

	// Find WebP-only images (not available as JPEG)
	const jpegNames = new Set(jpegUnique.map((r) => r.filename.toLowerCase()));
	const webpUnique = deduplicateByFilename(webpRecords).filter(
		(r) => !jpegNames.has(r.filename.toLowerCase())
	);

	const allImages = [...jpegUnique, ...webpUnique];
	console.log(`${allImages.length} unique images (${jpegUnique.length} JPEG + ${webpUnique.length} WebP-only)`);

	const existing = getExistingImages();
	const toDownload = allImages.filter((r) => !existing.has(r.filename.toLowerCase()));
	console.log(`${toDownload.length} images to download (${allImages.length - toDownload.length} already exist)`);

	if (toDownload.length === 0) {
		console.log('Nothing to download.');
		return;
	}

	if (DRY_RUN) {
		console.log('\nWould download:');
		for (const rec of toDownload) {
			const type = rec.mimetype === 'image/webp' ? '(WebP thumbnail)' : '(JPEG)';
			console.log(`  ${rec.filename} ${type} — archived ${rec.timestamp}`);
		}
		return;
	}

	let downloaded = 0;
	let failed = 0;

	for (const rec of toDownload) {
		const waybackUrl = `https://web.archive.org/web/${rec.timestamp}id_/${rec.original}`;
		// For WebP-only images, save as .webp; for JPEGs, keep original extension
		const isWebpOnly = rec.mimetype === 'image/webp';
		const destFilename = isWebpOnly
			? rec.filename.replace(/\.jpg$/i, '.webp')
			: rec.filename;
		const destPath = join(IMAGES_DIR, destFilename);

		process.stdout.write(`  ${destFilename} ... `);

		try {
			const resp = await fetch(waybackUrl);
			if (!resp.ok) {
				console.log(`FAIL (${resp.status})`);
				failed++;
				await sleep(1000);
				continue;
			}

			const contentType = resp.headers.get('content-type') || '';
			if (!contentType.startsWith('image/')) {
				console.log(`FAIL (not image: ${contentType})`);
				failed++;
				await sleep(1000);
				continue;
			}

			const buffer = Buffer.from(await resp.arrayBuffer());
			if (buffer.length < 500) {
				console.log(`FAIL (too small: ${buffer.length} bytes)`);
				failed++;
				await sleep(1000);
				continue;
			}

			writeFileSync(destPath, buffer);
			console.log(`OK (${(buffer.length / 1024).toFixed(0)} KB)`);
			downloaded++;
		} catch (err) {
			console.log(`ERROR: ${(err as Error).message}`);
			failed++;
		}

		await sleep(1000); // rate limit
	}

	console.log(`\nDone: ${downloaded} downloaded, ${failed} failed`);
}

main().catch((err) => {
	console.error('Fatal:', err);
	process.exit(1);
});
