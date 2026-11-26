/**
 * Inputs for the reader similarity map (TIN-5680, TIN-8628).
 *
 * Shared by scripts/generate-posts-projection.mts and the freshness test in
 * src/lib/reader/projection/committed-projection.test.ts, so both read the
 * same posts the same way.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseFrontmatter, parseFrontmatterRaw } from './frontmatter.mjs';
import type { PostSource } from '../../src/lib/reader/projection/embed.ts';
import type { LayoutSource } from '../../src/lib/reader/projection/layout.ts';

export const POSTS_DIR = 'src/posts';
export const PROJECTION_OUTPUT = 'src/lib/data/posts-projection.v1.json';
/** The map layout and its first-paint silhouette, both derived from the projection (TIN-8628). */
export const CONSTELLATION_OUTPUT = 'src/lib/data/constellation.v1.json';
export const SILHOUETTE_OUTPUT = 'src/lib/data/constellation-silhouette.v1.json';

/**
 * Only posts with an explicit `published: true`, the rule scripts/generate-search-index.mts uses.
 * The date never reaches the fit. The layout uses it for the glow of a star.
 */
export function readPublishedPosts(dir = POSTS_DIR): Array<PostSource & LayoutSource> {
	const posts: Array<PostSource & LayoutSource> = [];
	for (const file of readdirSync(dir).filter((name) => /\.(?:md|svx)$/.test(name)).sort()) {
		const content = readFileSync(join(dir, file), 'utf-8');
		const meta = parseFrontmatter(content);
		if (!meta || meta.published !== true) continue;
		const slug = (meta.slug as string) ?? file.replace(/\.(?:md|svx)$/, '').replace(/^\d{4}-\d{2}-\d{2}-/, '');
		posts.push({
			slug,
			date: String(meta.date ?? ''),
			title: String(meta.title ?? slug),
			description: String(meta.description ?? meta.excerpt ?? ''),
			tags: Array.isArray(meta.tags) ? (meta.tags as unknown[]).map(String) : [],
			category: typeof meta.category === 'string' ? meta.category : undefined,
			body: parseFrontmatterRaw(content)?.body ?? '',
		});
	}
	return posts;
}
