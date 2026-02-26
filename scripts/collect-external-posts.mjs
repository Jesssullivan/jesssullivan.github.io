#!/usr/bin/env node

/**
 * collect-external-posts.mjs
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
 * Usage: node scripts/collect-external-posts.mjs [--repos owner/name,...]
 */

import { readFileSync, writeFileSync, readdirSync, existsSync } from 'fs';
import { join, dirname, basename } from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const POSTS_DIR = join(ROOT, 'src', 'posts');
const SOURCES_PATH = join(ROOT, '.github', 'blog-sources.json');
const MANIFEST_PATH = join(ROOT, '.github', 'external-posts.json');

// ---------------------------------------------------------------------------
// Determine which repos to scan
// ---------------------------------------------------------------------------

function getTargetRepos() {
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
	const sources = JSON.parse(readFileSync(SOURCES_PATH, 'utf-8'));
	return sources.repos;
}

// ---------------------------------------------------------------------------
// Fetch files from a repo via gh CLI
// ---------------------------------------------------------------------------

function fetchRepoFiles(repo, paths) {
	const files = [];
	for (const scanPath of paths) {
		try {
			const listing = execSync(
				`gh api repos/${repo}/contents/${scanPath} --jq '.[].name'`,
				{ encoding: 'utf-8', env: { ...process.env, GH_TOKEN: process.env.GH_TOKEN } }
			).trim();
			for (const name of listing.split('\n').filter((n) => n.endsWith('.md'))) {
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

// ---------------------------------------------------------------------------
// Frontmatter parsing (same minimal parser as validate-frontmatter.mjs)
// ---------------------------------------------------------------------------

function parseFrontmatter(raw) {
	const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---/);
	if (!match) return null;
	const yaml = match[1];
	const result = {};
	for (const line of yaml.split('\n')) {
		const trimmed = line.trim();
		if (!trimmed || trimmed.startsWith('#')) continue;
		const kvMatch = trimmed.match(/^(\w[\w_]*):\s*(.*)/);
		if (!kvMatch) continue;
		const [, key, rawVal] = kvMatch;
		result[key] = parseValue(rawVal.trim());
	}
	return result;
}

function parseValue(val) {
	if (val === 'true') return true;
	if (val === 'false') return false;
	if (val === '' || val === 'null' || val === '~') return null;
	if (/^-?\d+(\.\d+)?$/.test(val)) return Number(val);
	if (val.startsWith('[') && val.endsWith(']')) {
		const inner = val.slice(1, -1);
		if (inner.trim() === '') return [];
		return inner.split(',').map((s) => stripQuotes(s.trim()));
	}
	return stripQuotes(val);
}

function stripQuotes(s) {
	if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
		return s.slice(1, -1);
	}
	return s;
}

// ---------------------------------------------------------------------------
// Slug generation
// ---------------------------------------------------------------------------

function slugify(title) {
	return title
		.toLowerCase()
		.replace(/[^\w\s-]/g, '')
		.replace(/\s+/g, '-')
		.replace(/-+/g, '-')
		.trim();
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

const sources = JSON.parse(readFileSync(SOURCES_PATH, 'utf-8'));
const manifest = existsSync(MANIFEST_PATH)
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

		// Build post content: strip H1 if title matches frontmatter
		let body = file.content.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n*/, '');
		const h1Match = body.match(/^#\s+(.+)\n*/);
		if (h1Match && h1Match[1].trim() === fm.title) {
			body = body.replace(/^#\s+.+\n*/, '');
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
			`source_repo: "${repo}"`,
			`source_path: "${file.path}"`,
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
