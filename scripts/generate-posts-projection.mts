#!/usr/bin/env node
/**
 * Producer for the reader constellation similarity map (TIN-5680, child of TIN-2413).
 *
 *   tsx scripts/generate-posts-projection.mts          warm refit from the committed projection
 *   tsx scripts/generate-posts-projection.mts --cold   explicit cold refit (seeded random start)
 *   tsx scripts/generate-posts-projection.mts --check  exit 1 when the committed file is stale
 *
 * Inputs are only published posts (`published: true`) under src/posts: title,
 * description, tags, category and body text. No network access, no numerical
 * packages. The output is committed at src/lib/data/posts-projection.v1.json and
 * imported at build time by ReaderConstellation, so the browser never fetches it.
 */
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseFrontmatter, parseFrontmatterRaw } from './lib/frontmatter.mts';
import { embedPosts, serializeProjection, type PostSource } from '../src/lib/reader/projection/embed.ts';

const POSTS_DIR = 'src/posts';
const OUTPUT = 'src/lib/data/posts-projection.v1.json';

function readPublishedPosts(dir = POSTS_DIR): PostSource[] {
	const posts: PostSource[] = [];
	for (const file of readdirSync(dir).filter((name) => /\.(?:md|svx)$/.test(name)).sort()) {
		const content = readFileSync(join(dir, file), 'utf-8');
		const meta = parseFrontmatter(content);
		// Same publication rule as scripts/generate-search-index.mts: only an explicit true.
		if (!meta || meta.published !== true) continue;
		const slug = (meta.slug as string) ?? file.replace(/\.(?:md|svx)$/, '').replace(/^\d{4}-\d{2}-\d{2}-/, '');
		posts.push({
			slug,
			title: String(meta.title ?? slug),
			description: String(meta.description ?? meta.excerpt ?? ''),
			tags: Array.isArray(meta.tags) ? (meta.tags as unknown[]).map(String) : [],
			category: typeof meta.category === 'string' ? meta.category : undefined,
			body: parseFrontmatterRaw(content)?.body ?? '',
		});
	}
	return posts;
}

function main(argv: string[]): number {
	const cold = argv.includes('--cold');
	const check = argv.includes('--check');
	const previousText = existsSync(OUTPUT) ? readFileSync(OUTPUT, 'utf-8') : null;
	const previous = previousText ? JSON.parse(previousText) : null;
	const started = performance.now();
	const projection = embedPosts(readPublishedPosts(), previous, { cold });
	const text = serializeProjection(projection);
	const summary =
		`${projection.posts.length} posts, ${projection.edges.length} edges, ` +
		`${projection.embedding.initialization}, ${projection.embedding.iterations} iterations, ` +
		`KL ${projection.embedding.kl_divergence}, neighbour overlap ${projection.metrics.neighbor_overlap}, ` +
		`displacement max ${projection.metrics.display_displacement_max} (${Math.round(performance.now() - started)} ms)`;
	if (check) {
		if (text === previousText) {
			console.log(`Posts projection is current: ${OUTPUT}`);
			return 0;
		}
		const before = new Set<string>((previous?.posts ?? []).map((post: { slug: string }) => post.slug));
		const after = new Set(projection.posts.map((post) => post.slug));
		const added = [...after].filter((slug) => !before.has(slug)).length;
		const removed = [...before].filter((slug) => !after.has(slug)).length;
		console.error(`Posts projection is stale (${added} added, ${removed} removed). Run: just posts-projection`);
		return 1;
	}
	if (text === previousText) {
		console.log(`Posts projection unchanged: ${summary}`);
		return 0;
	}
	writeFileSync(OUTPUT, text, 'utf-8');
	console.log(`Posts projection -> ${OUTPUT}: ${summary}`);
	return 0;
}

process.exitCode = main(process.argv.slice(2));
