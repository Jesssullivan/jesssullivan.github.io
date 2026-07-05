import { describe, expect, it } from 'vitest';
import type { Post } from '$lib/types';
import type { PublicPulseItem } from '@blog/pulse-core/schema';
import { blendStream, compareStreamItems, type StreamItem } from './blend';

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

describe('blendStream', () => {
	it('returns an empty timeline for empty inputs', () => {
		expect(blendStream([], [])).toEqual([]);
	});

	it('flattens posts and pulses into the unified shape', () => {
		const items = blendStream([makePost()], [makePulse()]);
		const post = items.find((i) => i.kind === 'post') as StreamItem;
		const pulse = items.find((i) => i.kind === 'pulse') as StreamItem;

		expect(post.url).toBe('/blog/a-post');
		expect(post.id).toBe('post:a-post');
		expect(pulse.url).toBe('/pulse');
		expect(pulse.id).toBe('pulse:pulse_1');
		expect(pulse.pulseKind).toBe('note');
	});

	it('interleaves posts and pulses in reverse-chronological order', () => {
		const posts = [
			makePost({ slug: 'old-post', date: '2026-01-01' }),
			makePost({ slug: 'new-post', date: '2026-06-01' }),
		];
		const pulses = [
			makePulse({ id: 'mid-pulse', occurredAt: '2026-03-01T00:00:00.000Z' }),
			makePulse({ id: 'newest-pulse', occurredAt: '2026-06-30T00:00:00.000Z' }),
		];

		const order = blendStream(posts, pulses).map((i) => i.id);
		expect(order).toEqual(['pulse:newest-pulse', 'post:new-post', 'pulse:mid-pulse', 'post:old-post']);
	});

	it('floats noteworthy first within an equal date (mirrors the #217 comparator)', () => {
		// All share the same instant so only the tier weight can reorder them.
		const at = '2026-04-01T00:00:00.000Z';
		const items = blendStream(
			[
				makePost({ slug: 'plain', date: '2026-04-01' }),
				makePost({ slug: 'featured', date: '2026-04-01', editorial_tier: 'noteworthy' }),
			],
			[makePulse({ id: 'loud', occurredAt: at, salience: 'noteworthy' })],
		);

		// The two noteworthy entries come before the untiered post.
		expect(items[items.length - 1].id).toBe('post:plain');
		const noteworthyIds = items.slice(0, 2).map((i) => i.id);
		expect(noteworthyIds).toContain('post:featured');
		expect(noteworthyIds).toContain('pulse:loud');
	});

	it('treats less-noteworthy and absent tiers as equal (weight 0)', () => {
		const items = blendStream(
			[
				makePost({ slug: 'zzz', date: '2026-04-01', editorial_tier: 'less-noteworthy' }),
				makePost({ slug: 'aaa', date: '2026-04-01' }),
			],
			[],
		);
		// Neither outranks the other on tier, so the deterministic id tie-break wins.
		expect(items.map((i) => i.id)).toEqual(['post:aaa', 'post:zzz']);
	});

	it('is deterministic regardless of input ordering', () => {
		const posts = [
			makePost({ slug: 'a', date: '2026-05-01' }),
			makePost({ slug: 'b', date: '2026-05-01', editorial_tier: 'noteworthy' }),
		];
		const pulses = [
			makePulse({ id: 'p1', occurredAt: '2026-05-01T00:00:00.000Z' }),
			makePulse({ id: 'p2', occurredAt: '2026-05-02T00:00:00.000Z', salience: 'noteworthy' }),
		];

		const forward = blendStream(posts, pulses).map((i) => i.id);
		const reversedPosts = blendStream([...posts].reverse(), [...pulses].reverse()).map((i) => i.id);
		expect(reversedPosts).toEqual(forward);
	});
});

describe('compareStreamItems', () => {
	it('imposes a total order (antisymmetric on the tie-break)', () => {
		const a: StreamItem = { kind: 'post', id: 'post:a', title: 'a', summary: '', date: '2026-01-01', url: '/blog/a' };
		const b: StreamItem = { kind: 'post', id: 'post:b', title: 'b', summary: '', date: '2026-01-01', url: '/blog/b' };
		expect(Math.sign(compareStreamItems(a, b))).toBe(-Math.sign(compareStreamItems(b, a)));
		expect(compareStreamItems(a, a)).toBe(0);
	});
});
