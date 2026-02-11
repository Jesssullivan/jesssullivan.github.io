import { readFileSync, existsSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const buildDir = join(root, 'build');
const mapPath = join(root, 'static', 'redirect-map.json');

const redirectMap = JSON.parse(readFileSync(mapPath, 'utf-8'));
const errors = [];

// 1. Every redirect-map entry has a generated HTML file
for (const [oldPath] of Object.entries(redirectMap)) {
	const htmlPath = join(buildDir, oldPath, 'index.html');
	if (!existsSync(htmlPath)) {
		errors.push(`Missing redirect file: ${htmlPath} (for ${oldPath})`);
	}
}

// 2. Every redirect target resolves to an actual build output
// SvelteKit adapter-static outputs: /blog -> build/blog.html, /blog/slug -> build/blog/slug.html
const checkedTargets = new Set();
for (const [oldPath, newPath] of Object.entries(redirectMap)) {
	if (checkedTargets.has(newPath)) continue;
	checkedTargets.add(newPath);

	const asHtml = join(buildDir, newPath + '.html');
	const asIndex = join(buildDir, newPath, 'index.html');
	if (!existsSync(asHtml) && !existsSync(asIndex)) {
		errors.push(`Redirect target missing in build: ${newPath} (checked ${asHtml} and ${asIndex})`);
	}
}

// 3. Every published post with original_url should have a redirect-map entry
//    Check by matching the original_url's path against redirect-map keys
const postsDir = join(root, 'src', 'posts');
const redirectKeys = new Set(Object.keys(redirectMap));
const postFiles = readdirSync(postsDir).filter((f) => f.endsWith('.md'));

for (const file of postFiles) {
	const content = readFileSync(join(postsDir, file), 'utf-8');
	const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
	if (!frontmatterMatch) continue;

	const fm = frontmatterMatch[1];
	const published = /^published:\s*true$/m.test(fm);
	if (!published) continue;

	const urlMatch = fm.match(/^original_url:\s*(.+)$/m);
	if (!urlMatch) continue;

	const originalUrl = urlMatch[1].trim().replace(/^['"]|['"]$/g, '');
	try {
		const urlPath = new URL(originalUrl).pathname;
		// Normalize: ensure trailing slash to match redirect-map key format
		const normalized = urlPath.endsWith('/') ? urlPath : urlPath + '/';
		if (!redirectKeys.has(normalized)) {
			const slugMatch = fm.match(/^slug:\s*(.+)$/m);
			const slug = slugMatch ? slugMatch[1].trim() : file;
			errors.push(`Published post "${slug}" has original_url (${normalized}) but no redirect-map key for it`);
		}
	} catch {
		// Skip invalid URLs
	}
}

if (errors.length > 0) {
	console.error(`Redirect validation failed with ${errors.length} error(s):\n`);
	for (const e of errors) console.error(`  - ${e}`);
	process.exit(1);
} else {
	console.log(`Redirect validation passed. ${Object.keys(redirectMap).length} entries verified.`);
}
