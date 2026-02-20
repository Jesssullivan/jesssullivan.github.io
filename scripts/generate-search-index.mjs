#!/usr/bin/env node
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const POSTS_DIR = 'src/posts';
const OUTPUT = 'static/search-index.json';

/**
 * Minimal frontmatter parser — extracts YAML between --- fences.
 */
function parseFrontmatter(content) {
	const match = content.match(/^---\n([\s\S]*?)\n---/);
	if (!match) return null;
	const lines = match[1].split('\n');
	const meta = {};
	for (const line of lines) {
		const m = line.match(/^(\w[\w_]*):\s*(.+)/);
		if (!m) continue;
		let val = m[2].trim();
		if (
			(val.startsWith('"') && val.endsWith('"')) ||
			(val.startsWith("'") && val.endsWith("'"))
		) {
			val = val.slice(1, -1);
		}
		if (val.startsWith('[')) {
			try {
				val = JSON.parse(val);
			} catch {
				val = [];
			}
		}
		if (val === 'true') val = true;
		if (val === 'false') val = false;
		meta[m[1]] = val;
	}
	return meta;
}

async function main() {
	const files = (await readdir(POSTS_DIR)).filter((f) => f.endsWith('.md'));
	const index = [];

	for (const file of files) {
		const content = await readFile(join(POSTS_DIR, file), 'utf-8');
		const meta = parseFrontmatter(content);
		if (!meta || !meta.published) continue;

		const slug =
			meta.slug ?? file.replace('.md', '').replace(/^\d{4}-\d{2}-\d{2}-/, '');

		index.push({
			id: slug,
			title: String(meta.title ?? slug),
			description: String(meta.description ?? meta.excerpt ?? ''),
			tags: Array.isArray(meta.tags) ? meta.tags.join(' ') : '',
			category: String(meta.category ?? ''),
			slug,
			date: String(meta.date ?? '')
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
