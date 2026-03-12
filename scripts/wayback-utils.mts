/**
 * Wayback Machine Utility Functions
 *
 * Pure utility functions for extracting, normalizing, and mapping
 * WordPress media URLs for Wayback Machine recovery.
 */

import type { ImageRef, CdxRecord } from './lib/types.mts';

export function extractFilename(wpUrl: string): string {
	try {
		const url = new URL(wpUrl);
		const pathname = url.pathname;
		const parts = pathname.split('/');
		let filename = parts[parts.length - 1];

		// Strip WordPress dimension suffixes: -300x200, -150x150, etc.
		filename = filename.replace(/-\d+x\d+(?=\.\w+$)/, '');
		// Strip WordPress edit suffix: -e1527804648975
		filename = filename.replace(/-e\d{10,}(?=\.\w+$)/, '');

		return decodeURIComponent(filename);
	} catch {
		// If URL parsing fails, try to extract filename from string
		const match = wpUrl.match(/\/([^/?]+)(?:\?|$)/);
		return match ? decodeURIComponent(match[1]) : wpUrl;
	}
}

export function buildWaybackUrl(timestamp: string, originalUrl: string): string {
	return `https://web.archive.org/web/${timestamp}im_/${originalUrl}`;
}

export function normalizeWpImageUrl(url: string): string {
	try {
		const parsed = new URL(url);

		// Strip i0-i2.wp.com CDN wrapper
		if (/^i[0-2]\.wp\.com$/.test(parsed.hostname)) {
			// The real URL is in the path: i0.wp.com/example.com/path/to/image.jpg
			const realPath = parsed.pathname.replace(/^\//, '');
			return `https://${realPath}`;
		}

		// Strip query params (resize, ssl, fit, etc.)
		return `${parsed.origin}${parsed.pathname}`;
	} catch {
		return url;
	}
}

export function localImagePath(filename: string, existingFiles: Set<string> = new Set()): string {
	let candidate = filename;
	if (existingFiles.has(candidate)) {
		const ext = candidate.match(/(\.\w+)$/)?.[1] || '';
		const base = candidate.replace(/(\.\w+)$/, '');
		let i = 1;
		while (existingFiles.has(`${base}-${i}${ext}`)) i++;
		candidate = `${base}-${i}${ext}`;
	}
	return `/images/posts/${candidate}`;
}

export function extractImageUrls(content: string): ImageRef[] {
	const images: ImageRef[] = [];

	// Strip frontmatter
	const body = content.replace(/^---\n[\s\S]*?\n---\n?/, '');

	// Markdown images: ![alt](url)
	const mdRe = /!\[([^\]]*)\]\(([^)]+)\)/g;
	let m;
	while ((m = mdRe.exec(body)) !== null) {
		images.push({ url: m[2].trim(), type: 'markdown', alt: m[1] });
	}

	// HTML img tags: <img src="url" ... />
	const htmlRe = /<img\s[^>]*src=["']([^"']+)["']/gi;
	while ((m = htmlRe.exec(body)) !== null) {
		images.push({ url: m[1].trim(), type: 'html', alt: '' });
	}

	return images;
}

export function isExternalWpUrl(url: string): boolean {
	if (!url.startsWith('http')) return false;
	return (
		url.includes('wp-content/uploads') ||
		/i[0-2]\.wp\.com/.test(url) ||
		url.includes('transscendsurvival.org/wp-content')
	);
}

export function parseCdxResponse(rows: string[][] | null): CdxRecord[] {
	if (!rows || rows.length < 2) return [];
	// First row is headers
	return rows.slice(1).map(([, timestamp, original, mimetype, statuscode, digest, length]) => ({
		timestamp,
		original,
		mimetype,
		statuscode,
		digest,
		length,
	}));
}
