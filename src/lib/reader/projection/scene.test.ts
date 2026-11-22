import { describe, expect, it } from 'vitest';
import type { Post } from '$lib/posts';
import { buildScene, firstInReadingOrder, isProjectionDocument, nearestNode, neighborInDirection, neighboursOf } from './scene';

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

	it('selects the nearest node in a dense cluster, never a farther one', () => {
		// Five posts packed into a 0.03-wide cluster, closer than a phone touch target.
		const dense = {
			schema: 'posts-projection.v1',
			note: 'Not a measurement.',
			posts: [
				{ slug: 'p0', x: 0.5, y: 0.5 },
				{ slug: 'p1', x: 0.51, y: 0.5 },
				{ slug: 'p2', x: 0.52, y: 0.505 },
				{ slug: 'p3', x: 0.5, y: 0.52 },
				{ slug: 'p4', x: 0.53, y: 0.53 },
				{ slug: 'far', x: 0.9, y: 0.9 },
			],
			edges: [],
		};
		const scene = buildScene(dense, dense.posts.map((p) => post(p.slug)))!;
		const radius = 0.05;
		// A tap exactly on a node selects it, even with its neighbours inside the radius.
		for (const node of scene.nodes) expect(nearestNode(scene, node.x, node.y, radius)).toBe(node.index);
		// Between p0 and p1 but closer to p1.
		expect(nearestNode(scene, 0.506, 0.5, radius)).toBe(1);
		// Every tap in a grid over the cluster picks a node no farther than any other node.
		for (let gx = 0.47; gx <= 0.56; gx += 0.0025) {
			for (let gy = 0.47; gy <= 0.56; gy += 0.0025) {
				const picked = nearestNode(scene, gx, gy, radius);
				const distances = scene.nodes.map((node) => Math.hypot(node.x - gx, node.y - gy));
				const closest = Math.min(...distances);
				if (closest > radius) expect(picked).toBe(-1);
				else expect(distances[picked]).toBe(closest);
			}
		}
		// Out of reach selects nothing.
		expect(nearestNode(scene, 0.7, 0.7, radius)).toBe(-1);
		expect(nearestNode({ ...scene, nodes: [] }, 0.5, 0.5, radius)).toBe(-1);
		// An exact tie goes to the lower index, so the pick is stable.
		const tie = buildScene({ ...dense, posts: [{ slug: 'l', x: 0.25, y: 0.5 }, { slug: 'r', x: 0.75, y: 0.5 }] }, [post('l'), post('r')])!;
		expect(nearestNode(tie, 0.5, 0.5, 0.25)).toBe(0);
	});

	it('rejects malformed documents', () => {
		expect(isProjectionDocument(projection)).toBe(true);
		expect(buildScene({ ...projection, schema: 'other' }, [post('a')])).toBeNull();
		expect(isProjectionDocument({ ...projection, posts: [{ slug: 'a', x: 2, y: 0 }] })).toBe(false);
		expect(isProjectionDocument({ ...projection, edges: [[1, 0, 0.5]] })).toBe(false);
		expect(isProjectionDocument({ ...projection, edges: [[0, 9, 0.5]] })).toBe(false);
	});
});
