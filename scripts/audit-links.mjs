/**
 * Blog Link & Content Audit Script
 *
 * Reads all .md files in src/posts/, extracts links, checks for broken
 * internal links, missing images, short content, and stale WordPress URLs.
 */

import { readFileSync, readdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const postsDir = join(root, 'src', 'posts');
const staticDir = join(root, 'static');
const routesDir = join(root, 'src', 'routes');

// ── Gather known slugs from posts ────────────────────────────────────
function getPostSlugs() {
	const slugs = new Set();
	const files = readdirSync(postsDir).filter((f) => f.endsWith('.md'));
	for (const file of files) {
		const content = readFileSync(join(postsDir, file), 'utf-8');
		const fmMatch = content.match(/^---\n([\s\S]*?)\n---/);
		if (!fmMatch) continue;
		const fm = fmMatch[1];
		const published = /^published:\s*true$/m.test(fm);
		if (!published) continue;

		const slugMatch = fm.match(/^slug:\s*["']?(.+?)["']?\s*$/m);
		if (slugMatch) {
			slugs.add(slugMatch[1]);
		} else {
			const basename = file.replace('.md', '').replace(/^\d{4}-\d{2}-\d{2}-/, '');
			slugs.add(basename);
		}
	}
	return slugs;
}

// ── Gather known routes ──────────────────────────────────────────────
function getKnownRoutes() {
	const routes = new Set(['/', '/blog', '/about', '/cv', '/feed.json', '/feed.xml', '/sitemap.xml']);
	// Add all blog post slugs
	const slugs = getPostSlugs();
	for (const slug of slugs) {
		routes.add(`/blog/${slug}`);
	}
	// Tag routes are dynamic, accept any /blog/tag/*
	return routes;
}

// ── Gather static files (for image checks) ──────────────────────────
function getStaticFiles() {
	const files = new Set();
	function walk(dir, prefix) {
		if (!existsSync(dir)) return;
		for (const entry of readdirSync(dir, { withFileTypes: true })) {
			const fullPath = join(dir, entry.name);
			const relPath = prefix + '/' + entry.name;
			if (entry.isDirectory()) {
				walk(fullPath, relPath);
			} else {
				files.add(relPath);
			}
		}
	}
	walk(staticDir, '');
	return files;
}

// ── Extract links from markdown ──────────────────────────────────────
function extractLinks(content, filename) {
	const links = [];

	// Strip frontmatter
	const body = content.replace(/^---\n[\s\S]*?\n---\n?/, '');

	// Markdown links: [text](url) and ![alt](url)
	const mdLinkRe = /!?\[([^\]]*)\]\(([^)]+)\)/g;
	let m;
	while ((m = mdLinkRe.exec(body)) !== null) {
		links.push({ text: m[1], url: m[2].trim(), file: filename, line: getLineNumber(body, m.index) });
	}

	// HTML href links: <a href="url">
	const htmlLinkRe = /<a\s[^>]*href=["']([^"']+)["']/gi;
	while ((m = htmlLinkRe.exec(body)) !== null) {
		links.push({ text: '', url: m[1].trim(), file: filename, line: getLineNumber(body, m.index) });
	}

	return links;
}

function getLineNumber(text, index) {
	return text.substring(0, index).split('\n').length;
}

// ── Categorize links ─────────────────────────────────────────────────
function categorize(url) {
	if (url.startsWith('#')) return 'anchor';
	if (url.startsWith('http://') || url.startsWith('https://')) return 'external';
	if (url.startsWith('mailto:')) return 'mailto';
	if (url.startsWith('/') || url.startsWith('./') || !url.includes('://')) return 'internal';
	return 'other';
}

// ── Parse frontmatter ────────────────────────────────────────────────
function parseFrontmatter(content) {
	const fmMatch = content.match(/^---\n([\s\S]*?)\n---/);
	if (!fmMatch) return {};
	const fm = fmMatch[1];
	const result = {};
	result.published = /^published:\s*true$/m.test(fm);
	const titleMatch = fm.match(/^title:\s*["']?(.+?)["']?\s*$/m);
	if (titleMatch) result.title = titleMatch[1];
	const slugMatch = fm.match(/^slug:\s*["']?(.+?)["']?\s*$/m);
	if (slugMatch) result.slug = slugMatch[1];
	const urlMatch = fm.match(/^original_url:\s*["']?(.+?)["']?\s*$/m);
	if (urlMatch) result.original_url = urlMatch[1];
	const dateMatch = fm.match(/^date:\s*["']?(\d{4}-\d{2}-\d{2})["']?\s*$/m);
	if (dateMatch) result.date = dateMatch[1];
	return result;
}

const STALE_YEARS = 3;

function getBodyWordCount(content) {
	const body = content.replace(/^---\n[\s\S]*?\n---\n?/, '');
	// Strip markdown formatting roughly
	const plain = body
		.replace(/```[\s\S]*?```/g, '') // code blocks
		.replace(/`[^`]+`/g, '') // inline code
		.replace(/!\[[^\]]*\]\([^)]+\)/g, '') // images
		.replace(/\[[^\]]*\]\([^)]+\)/g, '') // links
		.replace(/[#*_~>|`\-]/g, '') // md chars
		.replace(/<[^>]+>/g, '') // html tags
		.trim();
	return plain.split(/\s+/).filter((w) => w.length > 0).length;
}

// ── Main audit ───────────────────────────────────────────────────────
const knownRoutes = getKnownRoutes();
const staticFiles = getStaticFiles();
const postSlugs = getPostSlugs();
const redirectMap = JSON.parse(readFileSync(join(staticDir, 'redirect-map.json'), 'utf-8'));
const redirectTargets = new Set(Object.values(redirectMap));

const files = readdirSync(postsDir).filter((f) => f.endsWith('.md'));
const issues = {
	brokenInternalLinks: [],
	brokenImages: [],
	relativeLinks: [],
	wpLinksInContent: [],
	shortPosts: [],
	emptyPosts: [],
	postsWithoutOriginalUrl: [],
	stalePosts: [],
};

let totalLinks = 0;
let internalCount = 0;
let externalCount = 0;
let anchorCount = 0;

for (const file of files) {
	const content = readFileSync(join(postsDir, file), 'utf-8');
	const fm = parseFrontmatter(content);
	const links = extractLinks(content, file);
	const wordCount = getBodyWordCount(content);

	// Check for empty/short posts
	if (wordCount === 0) {
		issues.emptyPosts.push({ file, title: fm.title || '(no title)' });
	} else if (wordCount < 50 && fm.published) {
		issues.shortPosts.push({ file, title: fm.title || '(no title)', wordCount });
	}

	// Check for stale posts (>STALE_YEARS old)
	if (fm.date && fm.published) {
		const postDate = new Date(fm.date);
		const now = new Date();
		const ageYears = (now - postDate) / (365.25 * 24 * 60 * 60 * 1000);
		if (ageYears > STALE_YEARS) {
			issues.stalePosts.push({
				file,
				title: fm.title || '(no title)',
				date: fm.date,
				ageYears: Math.floor(ageYears),
			});
		}
	}

	for (const link of links) {
		totalLinks++;
		const cat = categorize(link.url);

		if (cat === 'anchor') {
			anchorCount++;
			continue;
		}
		if (cat === 'mailto') continue;

		if (cat === 'external') {
			externalCount++;
			// Check for WordPress transscendsurvival.org links in content (not frontmatter)
			if (link.url.includes('transscendsurvival.org')) {
				// Check if this WordPress URL path has a redirect
				try {
					const urlObj = new URL(link.url);
					const path = urlObj.pathname.endsWith('/') ? urlObj.pathname : urlObj.pathname + '/';
					const hasRedirect = Object.keys(redirectMap).includes(path);
					issues.wpLinksInContent.push({
						file,
						line: link.line,
						url: link.url,
						hasRedirect,
						text: link.text,
					});
				} catch {
					issues.wpLinksInContent.push({
						file,
						line: link.line,
						url: link.url,
						hasRedirect: false,
						text: link.text,
					});
				}
			}
			continue;
		}

		// Internal link
		internalCount++;

		// Relative paths (not starting with /) -- these are likely broken
		if (!link.url.startsWith('/')) {
			issues.relativeLinks.push({
				file,
				line: link.line,
				url: link.url,
				text: link.text,
			});
			continue;
		}

		// Check if internal link resolves
		const urlPath = link.url.split('#')[0].split('?')[0]; // strip anchor/query

		// Check as static file
		if (staticFiles.has(urlPath)) continue;

		// Check as route
		if (knownRoutes.has(urlPath)) continue;

		// Check tag routes
		if (urlPath.startsWith('/blog/tag/')) continue;

		// Check if it's a known redirect
		const normalized = urlPath.endsWith('/') ? urlPath : urlPath + '/';
		if (Object.keys(redirectMap).includes(normalized)) continue;

		// It's a broken internal link
		// Distinguish images vs page links
		if (urlPath.match(/\.(jpg|jpeg|png|gif|webp|svg|ico)$/i)) {
			issues.brokenImages.push({
				file,
				line: link.line,
				url: link.url,
				text: link.text,
			});
		} else {
			issues.brokenInternalLinks.push({
				file,
				line: link.line,
				url: link.url,
				text: link.text,
			});
		}
	}
}

// ── Report ───────────────────────────────────────────────────────────

console.log('='.repeat(72));
console.log('  BLOG LINK & CONTENT AUDIT');
console.log('='.repeat(72));
console.log();
console.log(`Scanned ${files.length} post files`);
console.log(`Total links found: ${totalLinks}`);
console.log(`  Internal: ${internalCount}`);
console.log(`  External: ${externalCount}`);
console.log(`  Anchor: ${anchorCount}`);
console.log(`  Published post slugs: ${postSlugs.size}`);
console.log();

function section(title, items) {
	const mark = items.length > 0 ? 'FAIL' : 'PASS';
	console.log(`${mark}: ${title} (${items.length})`);
	console.log('-'.repeat(72));
	if (items.length === 0) {
		console.log('  (none)');
	}
	for (const item of items) {
		if (item.url) {
			console.log(`  ${item.file}:${item.line}`);
			console.log(`    Link: ${item.url}`);
			if (item.text) console.log(`    Text: "${item.text}"`);
			if (item.hasRedirect !== undefined) console.log(`    Has redirect: ${item.hasRedirect}`);
		} else {
			console.log(`  ${item.file} - "${item.title}" (${item.wordCount ?? 0} words)`);
		}
	}
	console.log();
}

section('Broken Internal Links (page not found)', issues.brokenInternalLinks);
section('Broken Image References (file not in static/)', issues.brokenImages);
section('Relative Links (likely broken, not starting with /)', issues.relativeLinks);
section('WordPress URLs Still in Post Content (transscendsurvival.org)', issues.wpLinksInContent);
section('Empty Posts (0 words in body)', issues.emptyPosts);
section('Short Posts (< 50 words, published only)', issues.shortPosts);

// Stale posts are informational, not counted as issues
console.log(`INFO: Stale Posts (> ${STALE_YEARS} years old, published only) (${issues.stalePosts.length})`);
console.log('-'.repeat(72));
if (issues.stalePosts.length === 0) {
	console.log('  (none)');
} else {
	for (const item of issues.stalePosts) {
		console.log(`  ${item.file} - "${item.title}" (${item.date}, ${item.ageYears}y old)`);
	}
}
console.log();

// Summary
const totalIssues =
	issues.brokenInternalLinks.length +
	issues.brokenImages.length +
	issues.relativeLinks.length +
	issues.wpLinksInContent.length +
	issues.emptyPosts.length +
	issues.shortPosts.length;

console.log('='.repeat(72));
if (totalIssues > 0) {
	console.log(`TOTAL ISSUES: ${totalIssues}`);
} else {
	console.log('ALL CLEAR - no issues found.');
}
console.log('='.repeat(72));
