/**
 * Wayback Machine Utility Functions
 *
 * Pure utility functions for extracting, normalizing, and mapping
 * WordPress media URLs for Wayback Machine recovery.
 */

/**
 * Extract filename from a WordPress CDN URL.
 * Strips dimension suffixes like -300x200, -150x150, etc.
 * @param {string} wpUrl - WordPress CDN URL
 * @returns {string} Clean filename
 */
export function extractFilename(wpUrl) {
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

/**
 * Build a Wayback Machine URL for raw media retrieval.
 * Uses the `im_` flag to get the original image without Wayback toolbar.
 * @param {string} timestamp - Wayback timestamp (e.g., "20180101120000")
 * @param {string} originalUrl - The original URL to retrieve
 * @returns {string} Full Wayback Machine URL
 */
export function buildWaybackUrl(timestamp, originalUrl) {
	return `https://web.archive.org/web/${timestamp}im_/${originalUrl}`;
}

/**
 * Normalize a WordPress image URL by stripping i0-i2.wp.com wrappers
 * and query parameters.
 * @param {string} url - WordPress CDN URL
 * @returns {string} Clean original URL
 */
export function normalizeWpImageUrl(url) {
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

/**
 * Generate a deduplicated local image path.
 * @param {string} filename - Image filename
 * @param {Set<string>} existingFiles - Set of existing local filenames
 * @returns {string} Local path under /images/posts/
 */
export function localImagePath(filename, existingFiles = new Set()) {
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

/**
 * Extract image URLs from markdown and HTML content.
 * @param {string} content - Markdown/HTML content string
 * @returns {Array<{url: string, type: 'markdown'|'html', alt: string}>}
 */
export function extractImageUrls(content) {
	const images = [];

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

/**
 * Check if a URL is an external WordPress/CDN URL that should be localized.
 * @param {string} url - URL to check
 * @returns {boolean}
 */
export function isExternalWpUrl(url) {
	if (!url.startsWith('http')) return false;
	return (
		url.includes('wp-content/uploads') ||
		/i[0-2]\.wp\.com/.test(url) ||
		url.includes('transscendsurvival.org/wp-content')
	);
}

/**
 * Parse the CDX API response (JSON array format).
 * CDX returns: [urlkey, timestamp, original, mimetype, statuscode, digest, length]
 * @param {Array<Array<string>>} rows - CDX response rows (first row is headers)
 * @returns {Array<{timestamp: string, original: string, mimetype: string, statuscode: string, digest: string, length: string}>}
 */
export function parseCdxResponse(rows) {
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
