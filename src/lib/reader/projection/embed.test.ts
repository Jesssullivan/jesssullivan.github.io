import { describe, expect, it } from 'vitest';
import {
	alignToPrevious,
	canonicalCorpus,
	canonicalJson,
	corpusSha256,
	embedPosts,
	serializeProjection,
	similarities,
	similarityEdges,
	type PostSource,
} from './embed';
import { bodyTerms, tokens } from './text';

const TOPICS: Record<string, { words: string[]; tags: string[]; category: string }> = {
	birds: { words: ['warbler', 'sparrow', 'migration', 'feeder', 'binoculars', 'plumage'], tags: ['birding', 'ecology'], category: 'ecology' },
	radio: { words: ['antenna', 'transceiver', 'baofeng', 'repeater', 'frequency', 'callsign'], tags: ['ham-radio', 'hardware'], category: 'hardware' },
	nix: { words: ['flake', 'derivation', 'nixpkgs', 'closure', 'overlay', 'darwin'], tags: ['nix', 'devops'], category: 'devops' },
};

function fixture(perTopic = 6): PostSource[] {
	const posts: PostSource[] = [];
	for (const [topic, { words, tags, category }] of Object.entries(TOPICS)) {
		for (let i = 0; i < perTopic; i += 1) {
			const body = words.map((word, w) => `${word} `.repeat(1 + ((i + w) % 3))).join('\n');
			posts.push({ slug: `${topic}-${i}`, title: `${topic} notes ${words[i % words.length]}`, description: `About ${words[(i + 1) % words.length]}`, tags, category, body });
		}
	}
	return posts;
}

describe('text reduction', () => {
	it('drops code, markup, links, URLs, numbers and stopwords', () => {
		const terms = bodyTerms(
			'---\ntitle: x\n---\nThe warbler sang.\n```js\nconst secretToken = 1;\n```\n<script>let hidden = 1;</script>\n[warbler link](https://example.test/path) https://bare.test/x v1.2.345 sha1234567',
		);
		expect(terms).toEqual({ link: 1, sang: 1, warbler: 2 });
		expect(tokens('The Nix-Darwin flake')).toEqual(['nix-darwin', 'flake']);
	});

	it('keeps only the top terms, ordered by code point', () => {
		const terms = bodyTerms('alpha alpha beta gamma gamma gamma', 2);
		expect(Object.keys(terms)).toEqual(['alpha', 'gamma']);
	});
});

describe('canonical corpus', () => {
	it('is independent of input order and rejects duplicate slugs', () => {
		const posts = fixture(2);
		expect(corpusSha256(canonicalCorpus(posts))).toBe(corpusSha256(canonicalCorpus([...posts].reverse())));
		expect(() => canonicalCorpus([posts[0], posts[0]])).toThrow(/duplicate/);
	});

	it('weights title, description and tags and folds category into tags', () => {
		const [row] = canonicalCorpus([{ slug: 'a', title: 'Warbler', description: '', tags: ['Ham-Radio'], category: 'Hardware', body: 'warbler' }]);
		expect(row.terms).toEqual({ ham: 3, radio: 3, warbler: 4 });
		expect(row.tags).toEqual(['ham-radio', 'hardware']);
	});

	it('serializes JSON with sorted keys', () => {
		expect(canonicalJson({ b: 1, a: [{ d: 2, c: 'x' }] })).toBe('{"a":[{"c":"x","d":2}],"b":1}');
	});
});

describe('similarity', () => {
	it('scores shared wording and tags above unrelated posts; missing evidence is not agreement', () => {
		const rows = canonicalCorpus([
			{ slug: 'a', title: '', description: '', tags: ['birding'], body: 'warbler sparrow' },
			{ slug: 'b', title: '', description: '', tags: ['birding'], body: 'warbler sparrow' },
			{ slug: 'c', title: '', description: '', tags: ['nix'], body: 'flake overlay' },
			{ slug: 'd', title: '', description: '', tags: [], body: '' },
			{ slug: 'e', title: '', description: '', tags: [], body: '' },
		]);
		const { similarity, distance } = similarities(rows);
		const n = rows.length;
		expect(similarity[0 * n + 1]).toBeCloseTo(1, 12);
		expect(similarity[0 * n + 2]).toBe(0);
		expect(similarity[3 * n + 4]).toBe(0);
		expect(distance[0 * n + 2]).toBe(1);
		const edges = similarityEdges(rows.map((row) => row.id), similarity);
		expect(edges).toEqual([[0, 1, 1]]);
	});
});

describe('Procrustes alignment', () => {
	it('recovers rotation, reflection, scale and translation', () => {
		const previous = new Map<string, [number, number]>([
			['a', [0, 0]],
			['b', [2, 0]],
			['c', [0, 1]],
			['d', [3, 3]],
		]);
		// Reflect across y, scale by 3, shift: the inverse should be recovered exactly.
		const moved = new Map([...previous].map(([id, [x, y]]) => [id, [-3 * x + 5, 3 * y - 2] as [number, number]]));
		const { aligned, info } = alignToPrevious(moved, previous);
		expect(info.applied).toBe(true);
		expect(info.reflection).toBe(true);
		expect(info.scale).toBeCloseTo(1 / 3, 9);
		for (const [id, [x, y]] of previous) {
			expect(aligned.get(id)?.[0]).toBeCloseTo(x, 9);
			expect(aligned.get(id)?.[1]).toBeCloseTo(y, 9);
		}
	});
});

describe('embedPosts', () => {
	it('is byte-identical for the same inputs and keeps points in the unit square', () => {
		const first = serializeProjection(embedPosts(fixture(), null));
		const second = serializeProjection(embedPosts([...fixture()].reverse(), null));
		expect(second).toBe(first);
		const projection = JSON.parse(first);
		expect(projection.embedding.initialization).toBe('seeded-random');
		for (const post of projection.posts) {
			expect(post.x).toBeGreaterThanOrEqual(0);
			expect(post.x).toBeLessThanOrEqual(1);
			expect(post.y).toBeGreaterThanOrEqual(0);
			expect(post.y).toBeLessThanOrEqual(1);
		}
		expect(projection.posts.map((post: { slug: string }) => post.slug)).toEqual(
			[...projection.posts.map((post: { slug: string }) => post.slug)].sort(),
		);
	});

	it('places topical neighbours next to each other', () => {
		const projection = embedPosts(fixture(), null);
		expect(projection.metrics.neighbor_overlap).toBeGreaterThan(0.5);
		for (const [a, b] of projection.edges) {
			expect(projection.posts[a].slug.split('-')[0]).toBe(projection.posts[b].slug.split('-')[0]);
		}
	});

	it('reuses an unchanged projection and warm-starts when one post is added', () => {
		const posts = fixture();
		const added = posts.pop() as PostSource;
		const previous = embedPosts(posts, null);
		expect(embedPosts(posts, previous)).toEqual(previous);
		const warm = embedPosts([...posts, added], previous);
		expect(warm.embedding.initialization).toBe('previous-projection');
		expect(warm.alignment.applied).toBe(true);
		expect(warm.metrics.common_points).toBe(posts.length);
		expect(warm.metrics.display_displacement_mean).toBeLessThan(0.1);
		expect(warm.posts.some((post) => post.slug === added.slug)).toBe(true);
		const cold = embedPosts([...posts, added], previous, { cold: true });
		expect(cold.embedding.initialization).toBe('seeded-random');
	});

	it('flags an input with no relative evidence instead of inventing clusters', () => {
		const projection = embedPosts(
			[1, 2, 3].map((i) => ({ slug: `same-${i}`, title: '', description: '', tags: [], body: '' })),
			null,
		);
		expect(projection.embedding.algorithm).toBe('degenerate');
		expect(new Set(projection.posts.map((post) => `${post.x},${post.y}`)).size).toBe(1);
	});
});
