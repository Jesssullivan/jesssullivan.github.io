#!/usr/bin/env node
/**
 * Generate blog statistics JSON for CI and sidebar display.
 * Outputs: static/blog-stats.json
 *
 * Stats include:
 * - Total posts, tags, categories
 * - Posts per year/month
 * - Tag frequency distribution
 * - Category distribution
 * - Code block language distribution (from fenced blocks)
 * - Average reading time
 * - Most active periods
 */
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const POSTS_DIR = 'src/posts';
const OUTPUT = 'static/blog-stats.json';
const WORDS_PER_MINUTE = 200;

function parseFrontmatter(content) {
	const match = content.match(/^---\n([\s\S]*?)\n---/);
	if (!match) return null;
	const fm = {};
	for (const line of match[1].split('\n')) {
		const idx = line.indexOf(':');
		if (idx === -1) continue;
		const key = line.slice(0, idx).trim();
		let val = line.slice(idx + 1).trim();
		// Remove quotes
		if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
			val = val.slice(1, -1);
		}
		// Parse arrays
		if (val.startsWith('[')) {
			try {
				val = JSON.parse(val);
			} catch {
				val = val.slice(1, -1).split(',').map(s => s.trim().replace(/^["']|["']$/g, ''));
			}
		}
		// Parse booleans
		if (val === 'true') val = true;
		if (val === 'false') val = false;
		fm[key] = val;
	}
	return fm;
}

function extractCodeLanguages(content) {
	const body = content.replace(/^---\n[\s\S]*?\n---/, '');
	const langs = {};
	const regex = /```(\w+)/g;
	let match;
	while ((match = regex.exec(body)) !== null) {
		const lang = match[1].toLowerCase();
		langs[lang] = (langs[lang] || 0) + 1;
	}
	return langs;
}

function wordCount(content) {
	const body = content.replace(/^---\n[\s\S]*?\n---/, '').trim();
	return body.split(/\s+/).filter(w => w.length > 0).length;
}

async function main() {
	const files = await readdir(POSTS_DIR);
	const mdFiles = files.filter(f => f.endsWith('.md'));

	const posts = [];
	const tagCounts = {};
	const categoryCounts = {};
	const yearCounts = {};
	const monthCounts = {};
	const codeLangCounts = {};
	let totalWords = 0;

	for (const file of mdFiles) {
		const content = await readFile(join(POSTS_DIR, file), 'utf-8');
		const fm = parseFrontmatter(content);
		if (!fm || fm.published === false) continue;

		const words = wordCount(content);
		totalWords += words;
		const readingTime = Math.ceil(words / WORDS_PER_MINUTE);

		const date = fm.date || '';
		const year = date.slice(0, 4);
		const month = date.slice(0, 7);

		yearCounts[year] = (yearCounts[year] || 0) + 1;
		monthCounts[month] = (monthCounts[month] || 0) + 1;

		const tags = Array.isArray(fm.tags) ? fm.tags : [];
		for (const tag of tags) {
			tagCounts[tag] = (tagCounts[tag] || 0) + 1;
		}

		const category = fm.category || 'uncategorized';
		categoryCounts[category] = (categoryCounts[category] || 0) + 1;

		const codeLangs = extractCodeLanguages(content);
		for (const [lang, count] of Object.entries(codeLangs)) {
			codeLangCounts[lang] = (codeLangCounts[lang] || 0) + count;
		}

		posts.push({
			slug: fm.slug || file.replace(/\.md$/, ''),
			title: fm.title || '',
			date,
			words,
			readingTime,
			tags,
			category,
		});
	}

	posts.sort((a, b) => b.date.localeCompare(a.date));

	// Find most active month
	const sortedMonths = Object.entries(monthCounts).sort((a, b) => b[1] - a[1]);
	const sortedTags = Object.entries(tagCounts).sort((a, b) => b[1] - a[1]);
	const sortedCodeLangs = Object.entries(codeLangCounts).sort((a, b) => b[1] - a[1]);
	const sortedYears = Object.entries(yearCounts).sort((a, b) => a[0].localeCompare(b[0]));

	const stats = {
		generated: new Date().toISOString(),
		totals: {
			posts: posts.length,
			words: totalWords,
			avgReadingTime: Math.round(totalWords / posts.length / WORDS_PER_MINUTE),
			tags: Object.keys(tagCounts).length,
			categories: Object.keys(categoryCounts).length,
		},
		postsPerYear: Object.fromEntries(sortedYears),
		topTags: Object.fromEntries(sortedTags.slice(0, 20)),
		categories: categoryCounts,
		codeLanguages: Object.fromEntries(sortedCodeLangs),
		mostActiveMonth: sortedMonths[0] ? { month: sortedMonths[0][0], posts: sortedMonths[0][1] } : null,
		recentPosts: posts.slice(0, 5).map(p => ({ slug: p.slug, title: p.title, date: p.date })),
	};

	await writeFile(OUTPUT, JSON.stringify(stats, null, 2));
	console.log(`Blog stats: ${stats.totals.posts} posts, ${stats.totals.words} words, ${stats.totals.tags} tags, ${Object.keys(codeLangCounts).length} code languages`);
}

main().catch(err => {
	console.error(err);
	process.exit(1);
});
