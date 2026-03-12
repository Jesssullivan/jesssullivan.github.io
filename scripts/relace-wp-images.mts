#!/usr/bin/env node
/**
 * Re-lace WordPress images into migrated blog posts.
 *
 * For each post with placeholder text (lost WP images), fetches the archived
 * Wayback Machine HTML to discover original image URLs, matches them against
 * files in static/images/posts/, and replaces placeholders in order.
 *
 * When images aren't found locally, --download fetches them from the archive.
 *
 * Usage:
 *   tsx scripts/relace-wp-images.mts --dry-run              # Preview matches
 *   tsx scripts/relace-wp-images.mts --dry-run --download    # Preview + show downloads
 *   tsx scripts/relace-wp-images.mts --download              # Download missing + replace
 *   tsx scripts/relace-wp-images.mts                         # Local-only matching
 */
import { readdir, readFile, writeFile, mkdir } from 'node:fs/promises';
import { join, basename, extname } from 'node:path';
import type { WpImage, PlaceholderInfo, PostWithPlaceholders, WaybackSnapshot } from './lib/types.mts';

const POSTS_DIR = 'src/posts';
const IMAGES_DIR = 'static/images/posts';
const DRY_RUN = process.argv.includes('--dry-run');
const DOWNLOAD = process.argv.includes('--download');

// Poetic placeholder patterns used for lost WordPress images (italic markdown)
const PLACEHOLDER_RE = /^\*(?:The bits that made up|Gone with the WordPress|This image was a casualty|Another image lost|An image was here|Lost to the void|Digital entropy claimed|The server that hosted|The original image|This image existed once|What was once an image|The original image, once hosted|This visual has drifted|This space once held|Image from the original|The photograph that was|Image no longer available|This image didn't survive|Image unavailable).+\*$/;

// WP theme/sidebar images to skip — these appear on every page
const THEME_IMAGE_PATTERNS = [
	'cropped-cropped-img_',
	'cropped-img_',
	'site-icon',
	'favicon',
	'logo',
	'gravatar',
];

function sleep(ms: number): Promise<void> {
	return new Promise((r) => setTimeout(r, ms));
}

async function loadLocalImages(): Promise<Map<string, string>> {
	const files = await readdir(IMAGES_DIR);
	const map = new Map<string, string>();
	for (const f of files) {
		if (f === 'dimensions.json') continue;
		const ext = extname(f).toLowerCase();
		if (!['.jpg', '.jpeg', '.png', '.gif', '.webp'].includes(ext)) continue;
		if (ext === '.webp') continue; // Prefer original format
		const key = basename(f, extname(f)).toLowerCase();
		map.set(key, f);
	}
	return map;
}

async function getWaybackSnapshot(originalUrl: string): Promise<WaybackSnapshot | null> {
	const cdxUrl = `https://web.archive.org/cdx/search/cdx?url=${encodeURIComponent(originalUrl)}&output=json&limit=1&fl=timestamp,original&filter=statuscode:200&sort=reverse`;
	try {
		const resp = await fetch(cdxUrl);
		if (!resp.ok) return null;
		const rows: string[][] = await resp.json();
		if (rows.length < 2) return null;
		const [timestamp] = rows[1];
		return { timestamp, url: `https://web.archive.org/web/${timestamp}id_/${originalUrl}` };
	} catch {
		return null;
	}
}

function isThemeImage(filename: string): boolean {
	const lower = filename.toLowerCase();
	return THEME_IMAGE_PATTERNS.some((p) => lower.includes(p));
}

async function extractWpImages(archiveUrl: string, timestamp: string): Promise<WpImage[]> {
	try {
		const resp = await fetch(archiveUrl);
		if (!resp.ok) return [];
		const html = await resp.text();

		// Try to isolate the post content area
		let contentHtml = html;
		const contentMatch = html.match(/<div[^>]*class="[^"]*entry-content[^"]*"[^>]*>([\s\S]*?)<\/div>\s*(?:<footer|<nav|<div[^>]*class="[^"]*(?:comments|sidebar|widget))/i)
			|| html.match(/<article[^>]*>([\s\S]*?)<\/article>/i);
		if (contentMatch) {
			contentHtml = contentMatch[1];
		}

		// Match wp-content/uploads image URLs
		const imgRe = /wp-content\/uploads\/(\d{4}\/\d{2}\/[^\s"'<>]*?\.(jpe?g|png|gif))/gi;
		const matches = [...contentHtml.matchAll(imgRe)];

		const seen = new Set<string>();
		const images: WpImage[] = [];
		for (const m of matches) {
			const uploadPath = m[1];
			const fname = uploadPath.split('/').pop()!;
			const key = basename(fname, extname(fname)).toLowerCase();

			// Skip theme images and already-seen
			if (isThemeImage(fname)) continue;

			// Skip WordPress thumbnail variants (-NNNxNNN) if we already have the full-size
			const strippedKey = key.replace(/-\d+x\d+$/, '');
			if (key !== strippedKey && seen.has(strippedKey)) continue;

			if (!seen.has(strippedKey)) {
				seen.add(strippedKey);
				images.push({
					key: strippedKey,
					original: fname,
					uploadPath,
					timestamp,
				});
			}
		}
		return images;
	} catch {
		return [];
	}
}

function fuzzyMatch(key: string, localImages: Map<string, string>): string | null {
	if (localImages.has(key)) return localImages.get(key)!;
	const stripped = key.replace(/-\d+x\d+$/, '');
	if (stripped !== key && localImages.has(stripped)) return localImages.get(stripped)!;
	// Also try without trailing -N suffix (e.g., IMG_9079-1 -> IMG_9079)
	const noSuffix = stripped.replace(/-\d+$/, '');
	if (noSuffix !== stripped && localImages.has(noSuffix)) return localImages.get(noSuffix)!;
	return null;
}

async function downloadImage(uploadPath: string, timestamp: string): Promise<string | null> {
	const fname = uploadPath.split('/').pop()!;
	const ext = extname(fname);
	const base = basename(fname, ext).replace(/-\d+x\d+$/, '');
	const localName = base + ext;
	const localPath = join(IMAGES_DIR, localName);

	const archiveImgUrl = `https://web.archive.org/web/${timestamp}id_/https://transscendsurvival.org/wp-content/uploads/${uploadPath}`;

	try {
		const resp = await fetch(archiveImgUrl);
		if (!resp.ok) {
			// Try with www
			const altUrl = `https://web.archive.org/web/${timestamp}id_/https://www.transscendsurvival.org/wp-content/uploads/${uploadPath}`;
			const resp2 = await fetch(altUrl);
			if (!resp2.ok) return null;
			const buf = Buffer.from(await resp2.arrayBuffer());
			await writeFile(localPath, buf);
		} else {
			const buf = Buffer.from(await resp.arrayBuffer());
			await writeFile(localPath, buf);
		}
		return localName;
	} catch {
		return null;
	}
}

async function findPostsWithPlaceholders(): Promise<PostWithPlaceholders[]> {
	const files = (await readdir(POSTS_DIR)).filter((f) => f.endsWith('.md'));
	const results: PostWithPlaceholders[] = [];

	for (const file of files) {
		const content = await readFile(join(POSTS_DIR, file), 'utf-8');
		const lines = content.split('\n');
		const placeholders: PlaceholderInfo[] = [];
		for (let i = 0; i < lines.length; i++) {
			if (PLACEHOLDER_RE.test(lines[i].trim())) {
				placeholders.push({ lineIndex: i, text: lines[i] });
			}
		}
		if (placeholders.length === 0) continue;

		const urlMatch = content.match(/original_url:\s*['"]?(https?:\/\/[^\s'"]+)/);
		const originalUrl = urlMatch ? urlMatch[1].replace(/\/+$/, '/') : null;

		results.push({ file, content, lines, placeholders, originalUrl });
	}
	return results;
}

async function main(): Promise<void> {
	console.log(DRY_RUN ? '=== DRY RUN ===' : '=== REPLACING PLACEHOLDERS ===');
	if (DOWNLOAD) console.log('Download mode: will fetch missing images from Wayback Machine');

	await mkdir(IMAGES_DIR, { recursive: true });
	let localImages = await loadLocalImages();
	console.log(`Local images: ${localImages.size} files in ${IMAGES_DIR}`);

	const posts = await findPostsWithPlaceholders();
	console.log(`Posts with placeholders: ${posts.length}\n`);

	let totalMatched = 0;
	let totalDownloaded = 0;
	let totalUnmatched = 0;

	for (const post of posts) {
		console.log(`--- ${post.file} (${post.placeholders.length} placeholders) ---`);

		if (!post.originalUrl) {
			console.log('  SKIP: No original_url in frontmatter');
			totalUnmatched += post.placeholders.length;
			continue;
		}

		console.log(`  Original: ${post.originalUrl}`);

		const snapshot = await getWaybackSnapshot(post.originalUrl);
		await sleep(1000);

		if (!snapshot) {
			console.log('  SKIP: No Wayback Machine snapshot found');
			totalUnmatched += post.placeholders.length;
			continue;
		}

		console.log(`  Archive: ${snapshot.url}`);
		const wpImages = await extractWpImages(snapshot.url, snapshot.timestamp);
		await sleep(1000);

		console.log(`  Content images found: ${wpImages.length}`);

		if (wpImages.length === 0) {
			totalUnmatched += post.placeholders.length;
			continue;
		}

		// Match WP images to local files, optionally downloading missing ones
		const matches: WpImage[] = [];
		for (const img of wpImages) {
			let localFile = fuzzyMatch(img.key, localImages);

			if (!localFile && DOWNLOAD) {
				if (!DRY_RUN) {
					console.log(`  Downloading: ${img.original}...`);
					localFile = await downloadImage(img.uploadPath, img.timestamp);
					await sleep(500);
					if (localFile) {
						const key = basename(localFile, extname(localFile)).toLowerCase();
						localImages.set(key, localFile);
						totalDownloaded++;
					}
				} else {
					console.log(`  Would download: ${img.original}`);
					const ext = extname(img.original);
					const base = basename(img.original, ext).replace(/-\d+x\d+$/, '');
					localFile = base + ext;
					totalDownloaded++;
				}
			}

			matches.push({ ...img, localFile });
		}

		// Replace placeholders in order with matched images
		let replaced = 0;
		const newLines = [...post.lines];
		for (let pi = 0; pi < post.placeholders.length; pi++) {
			const ph = post.placeholders[pi];
			const match = matches[pi];

			if (!match || !match.localFile) {
				const wpName = match ? match.original : '(no WP image for this slot)';
				console.log(`  [${pi}] UNMATCHED: ${wpName}`);
				totalUnmatched++;
				continue;
			}

			const imgPath = `/images/posts/${match.localFile}`;
			const replacement = `![${match.key}](${imgPath})`;
			console.log(`  [${pi}] MATCH: ${match.original} -> ${match.localFile}`);

			if (!DRY_RUN) {
				newLines[ph.lineIndex] = replacement;
			}
			replaced++;
			totalMatched++;
		}

		if (!DRY_RUN && replaced > 0) {
			await writeFile(join(POSTS_DIR, post.file), newLines.join('\n'), 'utf-8');
			console.log(`  Wrote ${replaced} replacements`);
		}

		console.log('');
	}

	console.log('=== SUMMARY ===');
	console.log(`Matched/replaced: ${totalMatched}`);
	console.log(`Downloaded: ${totalDownloaded}`);
	console.log(`Unmatched: ${totalUnmatched}`);
	if (DRY_RUN) console.log('(dry run — no files modified)');
}

main().catch((err) => {
	console.error(err);
	process.exit(1);
});
