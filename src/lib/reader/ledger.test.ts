import { describe, expect, it } from 'vitest';
import type { Post } from '$lib/types';
import type { PublicPulseItem } from '@blog/pulse-core/schema';
import { buildConstellationGroups, partitionLedger } from './ledger';

function makePost(overrides: Partial<Post> = {}): Post {
	return {
		title: 'A Post',
		slug: 'a-post',
		date: '2026-03-04',
		description: 'desc',
		tags: [],
		published: true,
		...overrides,
	};
}

function makePulse(overrides: Partial<PublicPulseItem> = {}): PublicPulseItem {
	return {
		id: 'pulse_1',
		kind: 'note',
		occurredAt: '2026-03-04T12:00:00.000Z',
		summary: 'a pulse',
		content: 'a pulse body',
		tags: [],
		...overrides,
	} as PublicPulseItem;
}

describe('partitionLedger', () => {
	it('partitions strictly on the explicit editorial_tier', () => {
		const { noteworthy, lessNoteworthy, unclassified } = partitionLedger([
			makePost({ slug: 'n', editorial_tier: 'noteworthy' }),
			makePost({ slug: 'l', editorial_tier: 'less-noteworthy' }),
			makePost({ slug: 'u' }),
		]);
		expect(noteworthy.map((p) => p.slug)).toEqual(['n']);
		expect(lessNoteworthy.map((p) => p.slug)).toEqual(['l']);
		expect(unclassified.map((p) => p.slug)).toEqual(['u']);
	});

	it('never infers a tier from featured/category/tags/length/recency', () => {
		// Every signal that could tempt inference is present, but no tier is set.
		const { noteworthy, lessNoteworthy, unclassified } = partitionLedger([
			makePost({
				slug: 'loud-but-untiered',
				featured: true,
				category: 'hardware',
				tags: ['a', 'b', 'c'],
				date: '2030-01-01',
				description: 'x'.repeat(5000),
			}),
		]);
		expect(noteworthy).toHaveLength(0);
		expect(lessNoteworthy).toHaveLength(0);
		expect(unclassified.map((p) => p.slug)).toEqual(['loud-but-untiered']);
	});

	it('is deterministic under input reordering (date-desc, slug tie-break)', () => {
		const posts = [
			makePost({ slug: 'b', date: '2026-05-01', editorial_tier: 'noteworthy' }),
			makePost({ slug: 'a', date: '2026-05-01', editorial_tier: 'noteworthy' }),
			makePost({ slug: 'c', date: '2026-06-01', editorial_tier: 'noteworthy' }),
		];
		const forward = partitionLedger(posts).noteworthy.map((p) => p.slug);
		const reversed = partitionLedger([...posts].reverse()).noteworthy.map((p) => p.slug);
		// c is newest; a before b on the slug tie-break within the shared 05-01.
		expect(forward).toEqual(['c', 'a', 'b']);
		expect(reversed).toEqual(forward);
	});

	it('does not silently cap: N in -> N out across the three buckets', () => {
		const posts = Array.from({ length: 137 }, (_, i) =>
			makePost({
				slug: `p${i}`,
				date: '2026-01-01',
				editorial_tier: i % 3 === 0 ? 'noteworthy' : i % 3 === 1 ? 'less-noteworthy' : undefined,
			}),
		);
		const { noteworthy, lessNoteworthy, unclassified } = partitionLedger(posts);
		expect(noteworthy.length + lessNoteworthy.length + unclassified.length).toBe(137);
	});
});

describe('buildConstellationGroups', () => {
	it('groups posts by category then tag, honest basis on each group', () => {
		const groups = buildConstellationGroups(
			[
				makePost({ slug: 'hw', category: 'hardware', tags: ['soldering'] }),
				makePost({ slug: 'tagged', tags: ['Birding'] }),
				makePost({ slug: 'bare', tags: [] }),
			],
			[],
		);
		const byKey = Object.fromEntries(groups.map((g) => [g.key, g]));
		expect(byKey.hardware.basis).toBe('category');
		expect(byKey.birding.basis).toBe('tag');
		expect(byKey.birding.label).toBe('Birding');
		expect(byKey.uncategorized.basis).toBe('category');
	});

	it('is deterministic under post reordering', () => {
		const posts = [
			makePost({ slug: 'a', category: 'music', date: '2026-01-01' }),
			makePost({ slug: 'b', category: 'hardware', date: '2026-02-01' }),
			makePost({ slug: 'c', category: 'hardware', date: '2026-03-01' }),
		];
		const shape = (ps: Post[]) =>
			buildConstellationGroups(ps, []).map((g) => `${g.key}:${g.nodes.map((n) => n.id).join(',')}`);
		expect(shape([...posts].reverse())).toEqual(shape(posts));
		// hardware sorts before music by key; within hardware, c (newer) before b.
		expect(shape(posts)).toEqual(['hardware:post:c,post:b', 'music:post:a']);
	});

	it('preserves pulse producer order and appends the pulse group last', () => {
		const groups = buildConstellationGroups(
			[makePost({ slug: 'p', category: 'hardware' })],
			[makePulse({ id: 'first' }), makePulse({ id: 'second' }), makePulse({ id: 'third' })],
		);
		const pulseGroup = groups[groups.length - 1];
		expect(pulseGroup.key).toBe('pulse');
		expect(pulseGroup.nodes.map((n) => n.id)).toEqual(['pulse:first', 'pulse:second', 'pulse:third']);
	});

	it('does not silently cap: every post and pulse becomes exactly one node', () => {
		const posts = Array.from({ length: 40 }, (_, i) =>
			makePost({ slug: `p${i}`, category: i % 2 ? 'music' : 'hardware' }),
		);
		const pulses = Array.from({ length: 6 }, (_, i) => makePulse({ id: `q${i}` }));
		const groups = buildConstellationGroups(posts, pulses);
		const postNodes = groups.flatMap((g) => g.nodes.filter((n) => n.kind === 'post'));
		const pulseNodes = groups.flatMap((g) => g.nodes.filter((n) => n.kind === 'pulse'));
		expect(postNodes).toHaveLength(40);
		expect(pulseNodes).toHaveLength(6);
	});

	it('omits the pulse group entirely when there are no pulse items', () => {
		const groups = buildConstellationGroups([makePost({ category: 'hardware' })], []);
		expect(groups.some((g) => g.basis === 'pulse')).toBe(false);
	});
});
