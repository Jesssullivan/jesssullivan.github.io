import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import committed from '$lib/data/posts-projection.v1.json';
import committedLayout from '$lib/data/constellation.v1.json';
import committedSilhouette from '$lib/data/constellation-silhouette.v1.json';
import { readPublishedPosts } from '../../../../scripts/lib/posts-projection-sources.mjs';
import { canonicalCorpus, configurationSha256, corpusSha256, METHOD_REVISION, SCHEMA } from './embed';
import { layoutConstellation, serializeLayout, silhouetteOf, type ProjectionInput } from './layout';
import { isConstellationData } from './scene';

// Front matter scalar read, matching scripts/lib/frontmatter.mts for `published` and `slug`.
function frontmatterValue(source: string, key: string): string | undefined {
	const block = source.match(/^---\r?\n([\s\S]*?)\r?\n---/)?.[1];
	const raw = block?.match(new RegExp(`^\\s*${key}:\\s*(.*)$`, 'm'))?.[1]?.trim();
	if (raw === undefined) return undefined;
	return /^(["']).*\1$/.test(raw) ? raw.slice(1, -1) : raw;
}

// The same publication rule and slug derivation as scripts/generate-search-index.mts.
function postSlugs(): { published: Set<string>; withheld: Set<string> } {
	const published = new Set<string>();
	const withheld = new Set<string>();
	const dir = join(process.cwd(), 'src/posts');
	for (const file of readdirSync(dir).filter((name) => /\.(?:md|svx)$/.test(name))) {
		const source = readFileSync(join(dir, file), 'utf-8');
		if (!/^---\r?\n/.test(source)) continue;
		const slug = frontmatterValue(source, 'slug') || file.replace(/\.(?:md|svx)$/, '').replace(/^\d{4}-\d{2}-\d{2}-/, '');
		(frontmatterValue(source, 'published') === 'true' ? published : withheld).add(slug);
	}
	return { published, withheld };
}

describe('committed posts projection (src/lib/data/posts-projection.v1.json)', () => {
	it('matches the current producer method and configuration; otherwise run just posts-projection-cold', () => {
		expect(committed.schema).toBe(SCHEMA);
		expect(committed.method).toBe(METHOD_REVISION);
		expect(committed.configuration_sha256).toBe(configurationSha256());
	});

	// TIN-8628: a new, edited or removed published post changes the corpus, so CI fails until the map is refit.
	it('is fresh against the published posts; otherwise run just posts-projection and commit the result', () => {
		const posts = readPublishedPosts(join(process.cwd(), 'src/posts'));
		const current = posts.map((post) => post.slug).sort();
		const placed = committed.posts.map((post) => post.slug);
		expect({ missing: current.filter((slug) => !placed.includes(slug)), extra: placed.filter((slug) => !current.includes(slug)) }).toEqual({ missing: [], extra: [] });
		expect(committed.corpus_sha256).toBe(corpusSha256(canonicalCorpus(posts)));
	});

	// TIN-8628: the map layout and its silhouette are built from the projection and the posts. A post whose
	// date, tags, category or length changed needs the same refit, even when the fit itself does not move.
	it('has a current constellation layout and silhouette; otherwise run just posts-projection and commit the result', () => {
		const layout = layoutConstellation(committed as unknown as ProjectionInput, readPublishedPosts(join(process.cwd(), 'src/posts')));
		expect(isConstellationData(committedLayout)).toBe(true);
		expect(serializeLayout(committedLayout as never)).toBe(serializeLayout(layout));
		expect(serializeLayout(committedSilhouette as never)).toBe(serializeLayout(silhouetteOf(layout)));
		expect(committedLayout.corpus_sha256).toBe(committed.corpus_sha256);
		expect(committedLayout.stars.map((star) => star[0])).toEqual(committed.posts.map((post) => post.slug));
		// The layout carries no title, text, date or tag: only slugs, positions and small integers.
		for (const star of committedLayout.stars) expect(star.map((value) => typeof value)).toEqual(['string', 'number', 'number', 'number', 'number', 'number', 'number']);
		expect(Object.keys(committedLayout).sort()).toEqual(['aspect', 'categories', 'corpus_sha256', 'figure', 'groups', 'labels', 'near', 'schema', 'stars', 'titles']);
		// Titles are carried as a width and a placement code per star, never as text.
		for (const list of Object.values(committedLayout.titles)) expect(list.every((value) => Number.isInteger(value))).toBe(true);
		// Most posts get a title on both frames, and every figure line joins two stars of one named group.
		expect(committedLayout.titles.wide.filter(Boolean).length).toBeGreaterThan(committedLayout.stars.length * 0.8);
		expect(committedLayout.titles.tall.filter(Boolean).length).toBeGreaterThan(committedLayout.stars.length * 0.8);
		for (const [a, b] of committedLayout.figure) expect(Number(committedLayout.stars[a][4]) >= 0 && committedLayout.stars[a][4] === committedLayout.stars[b][4]).toBe(true);
	});

	it('contains only published posts and never a held or unpublished slug', () => {
		const { published, withheld } = postSlugs();
		expect(published.size).toBeGreaterThanOrEqual(committed.posts.length);
		expect(withheld.has('hello-world')).toBe(true);
		const slugs = committed.posts.map((post) => post.slug);
		expect(new Set(slugs).size).toBe(slugs.length);
		expect(slugs).toEqual([...slugs].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0)));
		expect(slugs.filter((slug) => withheld.has(slug) && !published.has(slug))).toEqual([]);
		expect(slugs.filter((slug) => !published.has(slug))).toEqual([]);
	});

	it('carries only coordinates, edges and method provenance', () => {
		expect(Object.keys(committed).sort()).toEqual(
			['alignment', 'configuration_sha256', 'corpus_sha256', 'edges', 'embedding', 'frame', 'method', 'metrics', 'note', 'posts', 'schema'].sort(),
		);
		for (const post of committed.posts) expect(Object.keys(post).sort()).toEqual(['slug', 'x', 'y']);
		expect(committed.note).toMatch(/not measurements/);
	});
});
