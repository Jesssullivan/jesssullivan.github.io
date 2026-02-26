#!/usr/bin/env node

/**
 * add-feature-images.mjs
 *
 * Scans all blog posts and adds feature_image frontmatter:
 * - If the post already has feature_image, skip it
 * - If the post contains an image reference, use the first one
 * - If no image found, assign a bird photo deterministically based on slug hash
 */

import { readFileSync, writeFileSync, readdirSync } from 'fs';
import { join } from 'path';
import { createHash } from 'crypto';

const POSTS_DIR = join(import.meta.dirname, '..', 'src', 'posts');

// Orphaned bird photos available for backfill (landscape-oriented, good for cards)
const BACKFILL_PHOTOS = [
	'/images/posts/IMG_0145-Edit.jpg',
	'/images/posts/IMG_0431.jpg',
	'/images/posts/IMG_0797-Edit.jpg',
	'/images/posts/IMG_0815-Edit.jpg',
	'/images/posts/IMG_0872.jpg',
	'/images/posts/IMG_1221-Edit.jpg',
	'/images/posts/IMG_2363-Edit.jpg',
	'/images/posts/IMG_2967-Edit.jpg',
	'/images/posts/IMG_5415-2.jpg',
	'/images/posts/IMG_6649-Edit.jpg',
	'/images/posts/img_8694.jpg',
	'/images/posts/orange-wood-ducks.jpg',
	'/images/posts/IMG_0871.jpg',
];

// Deterministic hash-based photo assignment
function pickBackfillPhoto(slug) {
	const hash = createHash('md5').update(slug).digest();
	const idx = hash.readUInt32BE(0) % BACKFILL_PHOTOS.length;
	return BACKFILL_PHOTOS[idx];
}

// Extract first image path from markdown body (after frontmatter)
function extractFirstImage(body) {
	// Match markdown images: ![...](path)
	const mdImg = body.match(/!\[[^\]]*\]\(([^)]+)\)/);
	if (mdImg) return mdImg[1];

	// Match HTML img tags: <img src="path"
	const htmlImg = body.match(/<img[^>]+src=["']([^"']+)["']/);
	if (htmlImg) return htmlImg[1];

	return null;
}

// Parse frontmatter boundaries
function parseFrontmatter(content) {
	const match = content.match(/^---\n([\s\S]*?)\n---\n/);
	if (!match) return null;
	return {
		raw: match[1],
		endIndex: match[0].length,
		body: content.slice(match[0].length),
	};
}

const dryRun = process.argv.includes('--dry-run');
const files = readdirSync(POSTS_DIR).filter((f) => f.endsWith('.md')).sort();

let added = 0;
let skipped = 0;
let fromContent = 0;
let fromBackfill = 0;

for (const file of files) {
	const filePath = join(POSTS_DIR, file);
	const content = readFileSync(filePath, 'utf-8');
	const parsed = parseFrontmatter(content);
	if (!parsed) {
		console.log(`SKIP (no frontmatter): ${file}`);
		skipped++;
		continue;
	}

	// Skip if already has feature_image
	if (parsed.raw.includes('feature_image:')) {
		console.log(`SKIP (has feature_image): ${file}`);
		skipped++;
		continue;
	}

	// Skip unpublished posts
	if (parsed.raw.includes('published: false')) {
		console.log(`SKIP (unpublished): ${file}`);
		skipped++;
		continue;
	}

	// Try to extract first LOCAL image from body
	let featureImage = extractFirstImage(parsed.body);
	let source = 'content';

	// Only use local images for feature_image (skip external URLs)
	if (featureImage && featureImage.startsWith('http')) {
		featureImage = null;
	}

	if (!featureImage) {
		// Extract slug from frontmatter or filename
		const slugMatch = parsed.raw.match(/slug:\s*["']?([^\s"'\n]+)/);
		const slug =
			slugMatch?.[1] ||
			file.replace('.md', '').replace(/^\d{4}-\d{2}-\d{2}-/, '');
		featureImage = pickBackfillPhoto(slug);
		source = 'backfill';
	}

	// Clean up the image path (remove any URL encoding, ensure it starts with /)
	if (featureImage && !featureImage.startsWith('http') && !featureImage.startsWith('/')) {
		featureImage = '/' + featureImage;
	}

	if (dryRun) {
		console.log(`WOULD ADD (${source}): ${file} → ${featureImage}`);
	} else {
		// Insert feature_image before the closing ---
		const newFrontmatter = parsed.raw + `\nfeature_image: "${featureImage}"`;
		const newContent = `---\n${newFrontmatter}\n---\n${parsed.body}`;
		writeFileSync(filePath, newContent, 'utf-8');
		console.log(`ADDED (${source}): ${file} → ${featureImage}`);
	}

	added++;
	if (source === 'content') fromContent++;
	else fromBackfill++;
}

console.log(`\n--- Summary ---`);
console.log(`Total files: ${files.length}`);
console.log(`Skipped: ${skipped}`);
console.log(`Added: ${added} (${fromContent} from content, ${fromBackfill} from backfill)`);
if (dryRun) console.log(`(DRY RUN — no files modified)`);
