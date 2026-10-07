import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import committed from '$lib/data/posts-projection.v1.json';
import { configurationSha256, METHOD_REVISION, SCHEMA } from './embed';
import { isProjectionDocument } from './scene';

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
		expect(isProjectionDocument(committed)).toBe(true);
		expect(committed.schema).toBe(SCHEMA);
		expect(committed.method).toBe(METHOD_REVISION);
		expect(committed.configuration_sha256).toBe(configurationSha256());
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
