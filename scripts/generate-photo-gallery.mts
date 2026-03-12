#!/usr/bin/env node

/**
 * Generate photo-gallery.json for the /photography page.
 *
 * Scans static/images/posts/ for bird/nature photography (DSC*, IMG_*, dsc*, img_*),
 * cross-references with dimensions.json and post markdown files to build a gallery manifest.
 *
 * Run as part of prebuild.
 */

import { readFileSync, readdirSync, writeFileSync, existsSync } from 'fs';
import { join, basename, extname } from 'path';
import type { GalleryEntry, ImageDimensions } from './lib/types.mts';
import { parseFrontmatter } from './lib/frontmatter.mts';

const IMAGES_DIR = 'static/images/posts';
const POSTS_DIR = 'src/posts';
const OUTPUT = 'static/photo-gallery.json';
const DIMENSIONS_FILE = join(IMAGES_DIR, 'dimensions.json');

// Photography image prefixes (case-insensitive)
const PHOTO_PREFIXES = ['img_', 'dsc', 'mg_', 'kq', 'orange-'];

// Exclude these patterns (screenshots, diagrams, etc.)
const EXCLUDE_PATTERNS = [
	'screen-shot-',
	'screenshot-',
	'jesssoes-',
	'codecogs',
	'unnamed',
	'featured_preview',
	'field-labs',
	'fullsizerender',
	'admin-ajax',
	'buttons',
	'boxs',
	'jsprintee',
	'micronklee',
	'v5_a', 'v6_b',
];

function isPhotographyImage(filename: string): boolean {
	const lower = filename.toLowerCase();
	const ext = extname(lower);
	if (!['.jpg', '.jpeg', '.png', '.gif'].includes(ext)) return false;
	if (EXCLUDE_PATTERNS.some((p) => lower.includes(p))) return false;
	return PHOTO_PREFIXES.some((p) => lower.startsWith(p));
}

function buildImageToPostMap(): Map<string, { slug: string; title: string }> {
	const map = new Map<string, { slug: string; title: string }>();

	const files = readdirSync(POSTS_DIR).filter((f) => f.endsWith('.md'));
	for (const file of files) {
		const content = readFileSync(join(POSTS_DIR, file), 'utf-8');

		const fm = parseFrontmatter(content);
		if (!fm || fm.published !== true) continue;

		const title = (fm.title as string) || '';
		const slug = (fm.slug as string)
			|| file.replace('.md', '').replace(/^\d{4}-\d{2}-\d{2}-/, '');

		// Find image references
		const imgRefs = content.matchAll(/!\[[^\]]*\]\(\/images\/posts\/([^)]+)\)/g);
		for (const m of imgRefs) {
			const imgFile = m[1];
			map.set(imgFile.toLowerCase(), { slug, title });
		}
	}
	return map;
}

function main(): void {
	// Load dimensions
	let dimensions: Record<string, ImageDimensions> = {};
	if (existsSync(DIMENSIONS_FILE)) {
		dimensions = JSON.parse(readFileSync(DIMENSIONS_FILE, 'utf-8'));
	}

	// Build post reference map
	const imageToPost = buildImageToPostMap();

	// Scan for photography images
	const allFiles = readdirSync(IMAGES_DIR);
	const photoFiles = allFiles.filter(isPhotographyImage);

	// Also include WebP-only images (from birdphoto.website archive)
	const webpOnly = allFiles.filter((f) => {
		const lower = f.toLowerCase();
		if (!lower.endsWith('.webp')) return false;
		// Check if there's a non-webp original
		const base = basename(f, extname(f));
		const hasOriginal = allFiles.some(
			(o) => o !== f && basename(o, extname(o)).toLowerCase() === base.toLowerCase()
				&& !o.toLowerCase().endsWith('.webp')
		);
		if (hasOriginal) return false;
		// Check if it matches photography prefixes
		return PHOTO_PREFIXES.some((p) => lower.startsWith(p));
	});

	const gallery: GalleryEntry[] = [];

	for (const file of [...photoFiles, ...webpOnly]) {
		const src = `/images/posts/${file}`;
		const ext = extname(file).toLowerCase();
		const base = basename(file, extname(file));

		// Find WebP variant
		const webpFile = ext === '.webp' ? file : `${base}.webp`;
		const hasWebp = allFiles.includes(webpFile);

		// Get dimensions
		const dim = dimensions[src] || dimensions[`/images/posts/${webpFile}`] || {};

		// Find post reference
		const postRef = imageToPost.get(file.toLowerCase());

		gallery.push({
			src,
			webp: hasWebp ? `/images/posts/${webpFile}` : null,
			width: dim.width || 0,
			height: dim.height || 0,
			post_slug: postRef?.slug || null,
			post_title: postRef?.title || null,
		});
	}

	// Sort: images with posts first, then by filename
	gallery.sort((a, b) => {
		if (a.post_slug && !b.post_slug) return -1;
		if (!a.post_slug && b.post_slug) return 1;
		return a.src.localeCompare(b.src);
	});

	writeFileSync(OUTPUT, JSON.stringify(gallery, null, 2));
	console.log(`Generated ${OUTPUT}: ${gallery.length} photos (${gallery.filter((g) => g.post_slug).length} linked to posts)`);
}

main();
