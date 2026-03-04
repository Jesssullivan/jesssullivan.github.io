#!/usr/bin/env node

/**
 * validate-blog-dates.mts
 *
 * CI check for future-dated blog posts. Implements the "DO NOT MERGE" pattern
 * inspired by Xe Iaso's site.
 *
 * Behavior:
 *  - Scans changed .md files in src/posts/ (via git diff against base branch)
 *  - For each post with a future date:
 *    - If PR body contains "DO NOT MERGE until YYYY-MM-DD UTC" → pass with warning
 *    - Otherwise → fail
 *
 * Environment:
 *   GITHUB_EVENT_PATH — path to GitHub event JSON (set by Actions)
 *   GITHUB_TOKEN      — for posting PR comments (optional)
 *   BASE_BRANCH       — base branch for diff (default: origin/main)
 *
 * Usage:
 *   tsx scripts/validate-blog-dates.mts
 *   tsx scripts/validate-blog-dates.mts --pr-body /path/to/body.txt
 */

import { readFileSync, readdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';
import { parseFrontmatter } from './lib/frontmatter.mts';
import type { PostFrontmatter } from './lib/types.mts';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const POSTS_DIR = join(ROOT, 'src', 'posts');

interface FuturePost {
	file: string;
	title: string;
	date: string;
	published: boolean | undefined;
}

function getDoNotMergeDate(prBody: string | null): Date | null {
	if (!prBody) return null;
	const match = prBody.match(/DO NOT MERGE until (\d{4}-\d{2}-\d{2})\s*UTC/i);
	if (!match) return null;
	const d = new Date(match[1] + 'T00:00:00Z');
	return isNaN(d.getTime()) ? null : d;
}

function getPRBody(): string {
	// CLI flag: --pr-body /path/to/file
	const cliIdx = process.argv.indexOf('--pr-body');
	if (cliIdx !== -1 && process.argv[cliIdx + 1]) {
		return readFileSync(process.argv[cliIdx + 1], 'utf-8');
	}

	// GitHub Actions event
	if (process.env.GITHUB_EVENT_PATH && existsSync(process.env.GITHUB_EVENT_PATH)) {
		try {
			const event = JSON.parse(readFileSync(process.env.GITHUB_EVENT_PATH, 'utf-8'));
			return event.pull_request?.body || '';
		} catch {
			return '';
		}
	}

	return '';
}

function getChangedPosts(): string[] {
	const base = process.env.BASE_BRANCH || 'origin/main';
	try {
		const diff = execSync(`git diff --name-only ${base}...HEAD -- src/posts/`, {
			encoding: 'utf-8',
			cwd: ROOT
		}).trim();
		return diff ? diff.split('\n').filter((f) => f.endsWith('.md')) : [];
	} catch {
		// Fallback: check all posts (git diff may fail outside CI)
		console.log('Warning: git diff failed, checking all posts');
		return readdirSync(POSTS_DIR)
			.filter((f) => f.endsWith('.md'))
			.map((f) => `src/posts/${f}`);
	}
}

const today = new Date();
today.setUTCHours(0, 0, 0, 0);

const prBody = getPRBody();
const doNotMergeDate = getDoNotMergeDate(prBody);
const changedPosts = getChangedPosts();

const futurePosts: FuturePost[] = [];
const errors: string[] = [];

for (const relPath of changedPosts) {
	const absPath = join(ROOT, relPath);
	if (!existsSync(absPath)) continue;

	const content = readFileSync(absPath, 'utf-8');
	const fm = parseFrontmatter(content);
	if (!fm || !fm.date) continue;

	const postDate = new Date(fm.date + 'T00:00:00Z');
	if (isNaN(postDate.getTime())) continue;

	if (postDate > today) {
		futurePosts.push({
			file: relPath,
			title: fm.title || relPath,
			date: fm.date,
			published: fm.published
		});
	}
}

if (futurePosts.length === 0) {
	console.log('No future-dated posts found. All clear.');
	process.exit(0);
}

console.log(`Found ${futurePosts.length} future-dated post(s):\n`);

let hasError = false;

for (const post of futurePosts) {
	const postDate = new Date(post.date + 'T00:00:00Z');

	if (doNotMergeDate && postDate <= doNotMergeDate) {
		console.log(`  OK    ${post.file} (${post.date}) — within DO NOT MERGE window (until ${doNotMergeDate.toISOString().slice(0, 10)})`);
	} else if (post.published === false) {
		console.log(`  OK    ${post.file} (${post.date}) — unpublished draft, safe to merge`);
	} else if (doNotMergeDate) {
		console.log(`  FAIL  ${post.file} (${post.date}) — post date exceeds DO NOT MERGE window`);
		hasError = true;
	} else {
		console.log(`  FAIL  ${post.file} (${post.date}) — future-dated with no DO NOT MERGE directive`);
		hasError = true;
	}
}

if (hasError) {
	console.log('\nTo schedule a future post, add to the PR description:');
	console.log('  DO NOT MERGE until YYYY-MM-DD UTC\n');
	process.exit(1);
} else {
	console.log('\nAll future-dated posts are within the scheduled window or unpublished drafts.');
	process.exit(0);
}
