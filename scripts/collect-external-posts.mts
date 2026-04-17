#!/usr/bin/env node

/**
 * collect-external-posts.mts
 *
 * Scans configured source repos for blog post candidates, normalizes
 * frontmatter to the PostFrontmatter schema, and copies them into
 * src/posts/ with published: false for review via Draft PR.
 *
 * Environment:
 *   GH_TOKEN        — GitHub token with repo access (GitHub App or PAT)
 *   DISPATCH_REPO   — single repo from repository_dispatch (optional)
 *   MANUAL_REPOS    — comma-separated repos from workflow_dispatch (optional)
 *
 * Usage: tsx scripts/collect-external-posts.mts [--repos owner/name,...]
 */

import { readFileSync, writeFileSync, readdirSync, existsSync, mkdirSync } from 'fs';
import { join, dirname, basename, extname } from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';
import { parseFrontmatter } from './lib/frontmatter.mts';
import type { PostFrontmatter } from './lib/types.mts';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const POSTS_DIR = join(ROOT, 'src', 'posts');
const IMAGES_DIR = join(ROOT, 'static', 'images', 'posts');
const SOURCES_PATH = join(ROOT, '.github', 'blog-sources.json');
const MANIFEST_PATH = join(ROOT, '.github', 'external-posts.json');

interface BlogSources {
	repos: string[];
	scan_paths: string[];
	frontmatter_value: string;
}

interface RepoFile {
	path: string;
	content: string;
}

interface RepoImage {
	remotePath: string;
	name: string;
	data: Buffer;
}

interface Manifest {
	posts: Record<string, { source_repo: string; source_path: string; collected_at: string }>;
}

function getTargetRepos(): string[] {
	// CLI arg: --repos owner/name,owner/name2
	const cliIdx = process.argv.indexOf('--repos');
	if (cliIdx !== -1 && process.argv[cliIdx + 1]) {
		return process.argv[cliIdx + 1].split(',').map((s) => s.trim());
	}

	// workflow_dispatch manual input
	if (process.env.MANUAL_REPOS) {
		return process.env.MANUAL_REPOS.split(',').map((s) => s.trim());
	}

	// repository_dispatch from a single source repo
	if (process.env.DISPATCH_REPO) {
		return [process.env.DISPATCH_REPO];
	}

	// Default: all repos from blog-sources.json
	const sources: BlogSources = JSON.parse(readFileSync(SOURCES_PATH, 'utf-8'));
	return sources.repos;
}

function fetchRepoFiles(repo: string, paths: string[]): RepoFile[] {
	const files: RepoFile[] = [];
	for (const scanPath of paths) {
		try {
			const listing = execSync(
				`gh api repos/${repo}/contents/${scanPath} --jq '.[].name'`,
				{ encoding: 'utf-8', env: { ...process.env, GH_TOKEN: process.env.GH_TOKEN } }
			).trim();
			for (const name of listing.split('\n').filter((n) => n.endsWith('.md') || n.endsWith('.mdx'))) {
				const content = execSync(
					`gh api repos/${repo}/contents/${scanPath}${name} --jq '.content'`,
					{ encoding: 'utf-8', env: { ...process.env, GH_TOKEN: process.env.GH_TOKEN } }
				).trim();
				files.push({
					path: `${scanPath}${name}`,
					content: Buffer.from(content, 'base64').toString('utf-8')
				});
			}
		} catch {
			// Path doesn't exist in this repo — skip
		}
	}
	return files;
}

const IMAGE_EXTS = new Set(['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg']);

function fetchRepoImages(repo: string, scanPaths: string[]): RepoImage[] {
	const images: RepoImage[] = [];
	const imageDirs = scanPaths.map((p) => p.replace(/\/$/, '') + '/images/');
	// Also check top-level blog/images/ explicitly
	imageDirs.push('blog/images/');

	const seen = new Set<string>();
	for (const dir of imageDirs) {
		if (seen.has(dir)) continue;
		seen.add(dir);
		try {
			const listing = execSync(
				`gh api repos/${repo}/contents/${dir} --jq '.[].name'`,
				{ encoding: 'utf-8' }
			).trim();
			for (const name of listing.split('\n').filter(Boolean)) {
				if (!IMAGE_EXTS.has(extname(name).toLowerCase())) continue;
				try {
					// Download binary via gh api (base64 encoded)
					const b64 = execSync(
						`gh api repos/${repo}/contents/${dir}${name} --jq '.content'`,
						{ encoding: 'utf-8' }
					).trim();
					images.push({
						remotePath: `${dir}${name}`,
						name,
						data: Buffer.from(b64, 'base64')
					});
				} catch {
					console.log(`  warn: failed to download ${dir}${name}`);
				}
			}
		} catch {
			// No images directory — skip
		}
	}
	return images;
}

function slugify(title: string): string {
	return title
		.toLowerCase()
		.replace(/[^\w\s-]/g, '')
		.replace(/\s+/g, '-')
		.replace(/-+/g, '-')
		.trim();
}

const sources: BlogSources = JSON.parse(readFileSync(SOURCES_PATH, 'utf-8'));
const manifest: Manifest = existsSync(MANIFEST_PATH)
	? JSON.parse(readFileSync(MANIFEST_PATH, 'utf-8'))
	: { posts: {} };

const existingSlugs = new Set(
	readdirSync(POSTS_DIR)
		.filter((f) => f.endsWith('.md'))
		.map((f) => f.replace('.md', '').replace(/^\d{4}-\d{2}-\d{2}-/, ''))
);

const repos = getTargetRepos();
let collected = 0;

for (const repo of repos) {
	console.log(`Scanning ${repo}...`);
	const files = fetchRepoFiles(repo, sources.scan_paths);

	// Fetch images from the source repo's blog/images/ directories
	const repoImages = fetchRepoImages(repo, sources.scan_paths);
	const copiedImages = new Map<string, string>(); // remoteName -> local path
	for (const img of repoImages) {
		const localPath = join(IMAGES_DIR, img.name);
		if (!existsSync(localPath)) {
			writeFileSync(localPath, img.data);
			console.log(`  image ${img.remotePath} → static/images/posts/${img.name}`);
		}
		copiedImages.set(img.name, `/images/posts/${img.name}`);
	}

	for (const file of files) {
		const fm = parseFrontmatter(file.content);
		if (!fm) {
			console.log(`  skip ${file.path}: no frontmatter`);
			continue;
		}

		// Check publish_to marker OR presence in a scan_paths directory
		if (fm.publish_to && fm.publish_to !== sources.frontmatter_value) {
			console.log(`  skip ${file.path}: publish_to=${fm.publish_to}`);
			continue;
		}

		// Require at least a title
		if (!fm.title) {
			console.log(`  skip ${file.path}: no title`);
			continue;
		}

		const slug = fm.slug || slugify(fm.title);
		if (existingSlugs.has(slug)) {
			console.log(`  skip ${file.path}: slug "${slug}" already exists`);
			continue;
		}

		// Normalize frontmatter
		const date = fm.date || new Date().toISOString().slice(0, 10);
		const description = fm.description || '';
		const tags = fm.tags || [];
		const category = fm.category || '';
		const linearIssue = typeof fm.linear_issue === 'string' ? fm.linear_issue : '';
		const linearProject = typeof fm.linear_project === 'string' ? fm.linear_project : '';

		// Build post content: strip H1 if title matches frontmatter
		let body = file.content.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n*/, '');
		const h1Match = body.match(/^#\s+(.+)\n*/);
		if (h1Match && h1Match[1].trim() === fm.title) {
			body = body.replace(/^#\s+.+\n*/, '');
		}

		// Rewrite relative image references to /images/posts/ paths
		for (const [name, localImgPath] of copiedImages) {
			// Match markdown images: ![alt](images/name) or ![alt](./images/name)
			const patterns = [
				new RegExp(`\\(!?\\.?/?images/${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\)`, 'g'),
				new RegExp(`\\(!?\\.?/?blog/images/${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\)`, 'g')
			];
			for (const pat of patterns) {
				body = body.replace(pat, `(${localImgPath})`);
			}
		}

		// Substitute unsupported code block languages
		body = body.replace(/```dhall/g, '```haskell');

		// Rewrite inter-post links: (part-1-identity.md) → (/blog/slug)
		body = body.replace(/\(([^)]*\.mdx?)\)/g, (match, mdRef) => {
			// Find matching file in this collection batch
			const refFile = files.find((f) => f.path.endsWith(mdRef) || basename(f.path) === mdRef);
			if (refFile) {
				const refFm = parseFrontmatter(refFile.content);
				if (refFm?.title) {
					const refSlug = refFm.slug || slugify(refFm.title);
					return `(/blog/${refSlug})`;
				}
			}
			return match;
		});

		// Resolve feature_image: use frontmatter value, or first copied image
		let featureImage = fm.feature_image || '';
		if (featureImage) {
			// Rewrite relative feature_image paths
			const imgName = basename(featureImage);
			if (copiedImages.has(imgName)) {
				featureImage = copiedImages.get(imgName)!;
			}
		} else if (copiedImages.size > 0) {
			// Auto-assign first available image as feature image
			featureImage = copiedImages.values().next().value!;
		}

		// Build frontmatter block
		const newFm = [
			'---',
			`title: "${fm.title.replace(/"/g, '\\"')}"`,
			`date: "${date}"`,
			`description: "${(description).replace(/"/g, '\\"')}"`,
			`tags: [${tags.map((t) => `"${t}"`).join(', ')}]`,
			`published: false`,
			`slug: "${slug}"`,
			category ? `category: "${category}"` : null,
			featureImage ? `feature_image: "${featureImage}"` : null,
			`source_repo: "${repo}"`,
			`source_path: "${file.path}"`,
			linearIssue ? `linear_issue: "${linearIssue.replace(/"/g, '\\"')}"` : null,
			linearProject ? `linear_project: "${linearProject.replace(/"/g, '\\"')}"` : null,
			'---'
		]
			.filter(Boolean)
			.join('\n');

		const filename = `${date}-${slug}.md`;
		const outPath = join(POSTS_DIR, filename);
		writeFileSync(outPath, `${newFm}\n\n${body}`, 'utf-8');

		// Update manifest
		manifest.posts[slug] = {
			source_repo: repo,
			source_path: file.path,
			collected_at: new Date().toISOString()
		};

		existingSlugs.add(slug);
		collected++;
		console.log(`  collected ${file.path} → ${filename}`);
	}
}

// Write updated manifest
writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2) + '\n', 'utf-8');
console.log(`\nDone: ${collected} post(s) collected from ${repos.length} repo(s).`);
