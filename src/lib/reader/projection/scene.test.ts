import { describe, expect, it } from 'vitest';
import type { Post } from '$lib/posts';
import { buildScene, firstInReadingOrder, isProjectionDocument, neighborInDirection, neighboursOf } from './scene';

const post = (slug: string, date = '2026-01-01'): Post => ({ slug, title: slug.toUpperCase(), date, description: '', tags: [], published: true });

const projection = {
	schema: 'posts-projection.v1',
	note: 'Not a measurement.',
	posts: [
		{ slug: 'a', x: 0.1, y: 0.1 },
		{ slug: 'b', x: 0.5, y: 0.1 },
		{ slug: 'c', x: 0.5, y: 0.6 },
		{ slug: 'held', x: 0.9, y: 0.9 },
		{ slug: 'd', x: 0.9, y: 0.1 },
	],
	edges: [
		[0, 1, 0.4],
		[1, 2, 0.9],
		[2, 3, 0.8],
		[1, 4, 0.2],
	],
};

describe('posts projection scene', () => {
	it('draws only routeable posts and reports routeable posts the projection has not placed', () => {
		const scene = buildScene(projection, [post('a'), post('b'), post('c'), post('d'), post('new')]);
		expect(scene?.nodes.map((node) => node.slug)).toEqual(['a', 'b', 'c', 'd']);
		expect(scene?.nodes.every((node) => node.href === `/blog/${node.slug}`)).toBe(true);
		expect(scene?.unplaced.map((p) => p.slug)).toEqual(['new']);
		// The edge into the non-routeable post disappears with it.
		expect(scene?.edges).toEqual([
			[0, 1],
			[1, 2],
			[1, 3],
		]);
		expect(neighboursOf(scene!, 1).map((node) => node.slug)).toEqual(['c', 'a', 'd']);
	});

	it('moves by arrow direction, preferring similarity neighbours', () => {
		const scene = buildScene(projection, [post('a'), post('b'), post('c'), post('d')])!;
		expect(firstInReadingOrder(scene)).toBe(0);
		expect(neighborInDirection(scene, 0, 'right')).toBe(1);
		expect(neighborInDirection(scene, 1, 'down')).toBe(2);
		expect(neighborInDirection(scene, 1, 'right')).toBe(3);
		expect(neighborInDirection(scene, 0, 'left')).toBe(-1);
		expect(neighborInDirection(scene, 99, 'left')).toBe(-1);
	});

	it('rejects malformed documents', () => {
		expect(isProjectionDocument(projection)).toBe(true);
		expect(buildScene({ ...projection, schema: 'other' }, [post('a')])).toBeNull();
		expect(isProjectionDocument({ ...projection, posts: [{ slug: 'a', x: 2, y: 0 }] })).toBe(false);
		expect(isProjectionDocument({ ...projection, edges: [[1, 0, 0.5]] })).toBe(false);
		expect(isProjectionDocument({ ...projection, edges: [[0, 9, 0.5]] })).toBe(false);
	});
});
