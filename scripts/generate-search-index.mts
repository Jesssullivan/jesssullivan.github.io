#!/usr/bin/env node
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { SearchIndexEntry } from './lib/types.mts';
import { parseFrontmatter } from './lib/frontmatter.mts';

const POSTS_DIR = 'src/posts';
const OUTPUT = 'static/search-index.json';
const WORDS_PER_MINUTE = 230;

function computeReadingTime(text: string): number {
	const words = text.split(/\s+/).filter((w) => w.length > 0).length;
	return Math.max(1, Math.round(words / WORDS_PER_MINUTE));
}

async function main(): Promise<void> {
	const files = (await readdir(POSTS_DIR)).filter((f) => f.endsWith('.md'));
	const index: SearchIndexEntry[] = [];

	for (const file of files) {
		const content = await readFile(join(POSTS_DIR, file), 'utf-8');
		const meta = parseFrontmatter(content);
		if (!meta || !meta.published) continue;

		const slug =
			(meta.slug as string) ?? file.replace('.md', '').replace(/^\d{4}-\d{2}-\d{2}-/, '');

		// Extract body excerpt (~150 chars of plain text)
		const body = content.replace(/^---[\s\S]*?---/, '');
		const plain = body
			.replace(/```[\s\S]*?```/g, '')
			.replace(/`[^`]*`/g, '')
			.replace(/<[^>]+>/g, '')
			.replace(/!\[[^\]]*\]\([^)]*\)/g, '')
			.replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
			.replace(/[#*_~>|\\-]/g, '')
			.replace(/\s+/g, ' ')
			.trim();
		let body_excerpt = plain.slice(0, 150);
		if (plain.length > 150) {
			const lastSpace = body_excerpt.lastIndexOf(' ');
			body_excerpt = (lastSpace > 0 ? body_excerpt.slice(0, lastSpace) : body_excerpt) + '...';
		}

		const tagList = Array.isArray(meta.tags) ? (meta.tags as string[]) : [];

		index.push({
			id: slug,
			title: String(meta.title ?? slug),
			description: String(meta.description ?? meta.excerpt ?? ''),
			tags: tagList.join(' '),
			tag_list: tagList,
			category: String(meta.category ?? ''),
			slug,
			date: String(meta.date ?? ''),
			source_file: `/src/posts/${file}`,
			body_excerpt,
			published: Boolean(meta.published),
			reading_time:
				typeof meta.reading_time === 'number'
					? meta.reading_time
					: computeReadingTime(plain),
			feature_image:
				typeof meta.feature_image === 'string' ? meta.feature_image : undefined,
			thumbnail_image:
				typeof meta.thumbnail_image === 'string' ? meta.thumbnail_image : undefined,
			featured:
				typeof meta.featured === 'boolean' ? meta.featured : undefined,
			author_slug:
				typeof meta.author_slug === 'string' ? meta.author_slug : undefined,
			original_url:
				typeof meta.original_url === 'string' ? meta.original_url : undefined,
			excerpt: typeof meta.excerpt === 'string' ? meta.excerpt : undefined
		});
	}

	// Sort by date descending
	index.sort((a, b) => b.date.localeCompare(a.date));

	await writeFile(OUTPUT, JSON.stringify(index), 'utf-8');
	console.log(`Search index: ${index.length} posts -> ${OUTPUT}`);
}

main().catch((err) => {
	console.error(err);
	process.exit(1);
});
