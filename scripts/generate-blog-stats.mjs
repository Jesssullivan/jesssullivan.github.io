#!/usr/bin/env node
/**
 * Generate blog statistics JSON for CI and sidebar display.
 * Outputs: static/blog-stats.json
 *
 * Stats include:
 * - Total posts, tags, categories
 * - Posts per year/month/quarter
 * - Tag frequency and co-occurrence matrix
 * - Code block language distribution (with per-year breakdown)
 * - Reading time distribution histogram
 * - Word count trends per year
 * - Post frequency trends
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
		if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
			val = val.slice(1, -1);
		}
		if (val.startsWith('[')) {
			try {
				val = JSON.parse(val);
			} catch {
				val = val.slice(1, -1).split(',').map(s => s.trim().replace(/^["']|["']$/g, ''));
			}
		}
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

function getQuarter(dateStr) {
	const m = parseInt(dateStr.slice(5, 7), 10);
	const q = Math.ceil(m / 3);
	return `${dateStr.slice(0, 4)}-Q${q}`;
}

async function main() {
	const files = await readdir(POSTS_DIR);
	const mdFiles = files.filter(f => f.endsWith('.md'));

	const posts = [];
	const tagCounts = {};
	const categoryCounts = {};
	const yearCounts = {};
	const monthCounts = {};
	const quarterCounts = {};
	const codeLangCounts = {};
	const codeLangByYear = {};
	const wordsByYear = {};
	const tagCooccurrence = {};
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
		const quarter = getQuarter(date);

		yearCounts[year] = (yearCounts[year] || 0) + 1;
		monthCounts[month] = (monthCounts[month] || 0) + 1;
		quarterCounts[quarter] = (quarterCounts[quarter] || 0) + 1;

		// Track words per year for trend analysis
		if (!wordsByYear[year]) wordsByYear[year] = { total: 0, count: 0 };
		wordsByYear[year].total += words;
		wordsByYear[year].count += 1;

		const tags = Array.isArray(fm.tags) ? fm.tags : [];
		for (const tag of tags) {
			tagCounts[tag] = (tagCounts[tag] || 0) + 1;
		}

		// Tag co-occurrence: count pairs of tags appearing in same post
		for (let i = 0; i < tags.length; i++) {
			for (let j = i + 1; j < tags.length; j++) {
				const pair = [tags[i], tags[j]].sort().join(' <> ');
				tagCooccurrence[pair] = (tagCooccurrence[pair] || 0) + 1;
			}
		}

		const category = fm.category || 'uncategorized';
		categoryCounts[category] = (categoryCounts[category] || 0) + 1;

		const codeLangs = extractCodeLanguages(content);
		for (const [lang, count] of Object.entries(codeLangs)) {
			codeLangCounts[lang] = (codeLangCounts[lang] || 0) + count;
			if (!codeLangByYear[year]) codeLangByYear[year] = {};
			codeLangByYear[year][lang] = (codeLangByYear[year][lang] || 0) + count;
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

	// Reading time distribution buckets
	const readingTimeBuckets = { '< 2 min': 0, '2-5 min': 0, '5-10 min': 0, '10-20 min': 0, '20+ min': 0 };
	for (const p of posts) {
		if (p.readingTime < 2) readingTimeBuckets['< 2 min']++;
		else if (p.readingTime < 5) readingTimeBuckets['2-5 min']++;
		else if (p.readingTime < 10) readingTimeBuckets['5-10 min']++;
		else if (p.readingTime < 20) readingTimeBuckets['10-20 min']++;
		else readingTimeBuckets['20+ min']++;
	}

	// Word count trends per year
	const wordCountTrends = {};
	for (const [year, data] of Object.entries(wordsByYear)) {
		wordCountTrends[year] = {
			avgWords: Math.round(data.total / data.count),
			totalWords: data.total,
			posts: data.count,
		};
	}

	// Rolling 12-month post frequency (for trend direction)
	const sortedMonthEntries = Object.entries(monthCounts).sort((a, b) => a[0].localeCompare(b[0]));
	const monthKeys = sortedMonthEntries.map(e => e[0]);
	const rolling12 = {};
	for (let i = 0; i < monthKeys.length; i++) {
		const windowStart = Math.max(0, i - 11);
		let sum = 0;
		for (let j = windowStart; j <= i; j++) {
			sum += sortedMonthEntries[j][1];
		}
		rolling12[monthKeys[i]] = sum;
	}

	// Tag co-occurrence: top pairs
	const sortedCooccurrence = Object.entries(tagCooccurrence)
		.sort((a, b) => b[1] - a[1])
		.slice(0, 30);

	// Tag co-occurrence edges for graph generation
	const tagEdges = sortedCooccurrence.map(([pair, weight]) => {
		const [a, b] = pair.split(' <> ');
		return { source: a, target: b, weight };
	});

	const sortedMonths = Object.entries(monthCounts).sort((a, b) => b[1] - a[1]);
	const sortedTags = Object.entries(tagCounts).sort((a, b) => b[1] - a[1]);
	const sortedCodeLangs = Object.entries(codeLangCounts).sort((a, b) => b[1] - a[1]);
	const sortedYears = Object.entries(yearCounts).sort((a, b) => a[0].localeCompare(b[0]));
	const sortedQuarters = Object.entries(quarterCounts).sort((a, b) => a[0].localeCompare(b[0]));

	const stats = {
		generated: new Date().toISOString(),
		totals: {
			posts: posts.length,
			words: totalWords,
			avgWordsPerPost: Math.round(totalWords / posts.length),
			avgReadingTime: Math.round(totalWords / posts.length / WORDS_PER_MINUTE),
			tags: Object.keys(tagCounts).length,
			categories: Object.keys(categoryCounts).length,
		},
		postsPerYear: Object.fromEntries(sortedYears),
		postsPerQuarter: Object.fromEntries(sortedQuarters),
		readingTimeDistribution: readingTimeBuckets,
		wordCountTrends,
		topTags: Object.fromEntries(sortedTags.slice(0, 20)),
		tagCooccurrence: tagEdges,
		categories: categoryCounts,
		codeLanguages: Object.fromEntries(sortedCodeLangs),
		codeLanguagesByYear: codeLangByYear,
		rolling12MonthPosts: rolling12,
		mostActiveMonth: sortedMonths[0] ? { month: sortedMonths[0][0], posts: sortedMonths[0][1] } : null,
		recentPosts: posts.slice(0, 5).map(p => ({ slug: p.slug, title: p.title, date: p.date })),
	};

	await writeFile(OUTPUT, JSON.stringify(stats, null, 2));

	console.log(`Blog stats: ${stats.totals.posts} posts, ${stats.totals.words} words, ${stats.totals.tags} tags, ${Object.keys(codeLangCounts).length} code languages`);
	console.log(`  Reading time: ${Object.entries(readingTimeBuckets).map(([k,v]) => `${k}: ${v}`).join(', ')}`);
	console.log(`  Tag pairs: ${tagEdges.length} co-occurrence edges`);
	console.log(`  Quarters tracked: ${sortedQuarters.length}`);
}

main().catch(err => {
	console.error(err);
	process.exit(1);
});
