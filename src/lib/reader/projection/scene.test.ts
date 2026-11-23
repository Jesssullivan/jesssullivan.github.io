import { describe, expect, it } from 'vitest';
import type { Post } from '$lib/posts';
import type { ConstellationData } from './layout';
import { buildSky, isConstellationData, nearOf, neighborInDirection, readingOrder } from './scene';

const post = (slug: string, date = '2026-01-01'): Post => ({ slug, title: slug.toUpperCase(), date, description: `About ${slug}`, tags: [], published: true });

// Stars: [slug, x, y, category, group, size, glow] on the 0 to 1000 grid.
const data: ConstellationData = {
	schema: 'constellation.v1',
	corpus_sha256: 'test',
	aspect: 1.5,
	categories: ['ecology', 'hardware'],
	labels: ['Ecology', 'Hardware'],
	groups: [
		{ name: 'Birding', wide: [300, 50], tall: [50, 300], glow: [300, 100, 200, 60], category: 0 },
		{ name: 'Making', wide: [700, 800], tall: [800, 700], glow: [700, 750, 150, 150], category: 1 },
	],
	stars: [
		['a', 100, 100, 0, 0, 0, 0],
		['b', 500, 100, 0, 0, 1, 2],
		['c', 500, 600, 1, 1, 2, 1],
		['held', 900, 900, 1, 1, 3, 0],
		['d', 900, 100, 0, 0, 0, 0],
	],
	figure: [
		[0, 1],
		[1, 4],
		[2, 3],
	],
	near: [[1], [2, 0, 4], [1, 3], [2], [1]],
	titles: { width: [10, 20, 30, 40, 50], wide: [0, 81, 82, 83, 120], tall: [0, 0, 100, 0, 0] },
};

describe('constellation sky', () => {
	it('draws only routeable posts and reports routeable posts the layout has not placed', () => {
		const sky = buildSky(data, [post('a'), post('b'), post('c'), post('d'), post('new')])!;
		expect(sky.stars.map((star) => star.slug)).toEqual(['a', 'b', 'c', 'd']);
		expect(sky.stars.every((star) => star.href === `/blog/${star.slug}`)).toBe(true);
		expect(sky.stars[1]).toMatchObject({ x: 0.5, y: 0.1, category: 0, group: 0, size: 1, glow: 2, description: 'About b' });
		// Each star carries where its title goes on the frame in use. The held post takes its entry with it.
		expect(sky.stars.map((star) => [star.label, star.labelWidth])).toEqual([[0, 10], [81, 20], [82, 30], [120, 50]]);
		expect(sky.unplaced.map((p) => p.slug)).toEqual(['new']);
		// A figure line and a neighbour into the post that is not routeable go with it.
		expect(sky.figure).toEqual([
			[0, 1],
			[1, 3],
		]);
		expect(nearOf(sky, 1).map((star) => star.slug)).toEqual(['c', 'a', 'd']);
		expect(nearOf(sky, 2).map((star) => star.slug)).toEqual(['b']);
		expect(sky.groups.map((group) => [group.name, group.members])).toEqual([
			['Birding', [0, 1, 3]],
			['Making', [2]],
		]);
		expect(sky.categories).toEqual([
			{ id: 'ecology', label: 'Ecology', count: 3 },
			{ id: 'hardware', label: 'Hardware', count: 1 },
		]);
		expect(sky.bySlug.get('d')).toBe(3);
	});

	it('transposes the frame for a tall panel', () => {
		const sky = buildSky(data, [post('a'), post('c')], true)!;
		expect(sky.stars.map((star) => [star.x, star.y])).toEqual([
			[0.1, 0.1],
			[0.6, 0.5],
		]);
		expect(sky.groups[0]).toMatchObject({ x: 0.05, y: 0.3, glow: [0.1, 0.3, 0.06, 0.2] });
		expect(sky.stars.map((star) => star.label)).toEqual([0, 100]);
	});

	it('moves by arrow direction, preferring the nearest posts', () => {
		const sky = buildSky(data, [post('a'), post('b'), post('c'), post('d')])!;
		expect(readingOrder(sky)).toEqual([0, 1, 3, 2]);
		expect(neighborInDirection(sky, 0, 'right')).toBe(1);
		expect(neighborInDirection(sky, 1, 'down')).toBe(2);
		expect(neighborInDirection(sky, 1, 'right')).toBe(3);
		expect(neighborInDirection(sky, 0, 'left')).toBe(-1);
		expect(neighborInDirection(sky, 99, 'left')).toBe(-1);
		// A filtered-out star is skipped.
		expect(neighborInDirection(sky, 0, 'right', 1, (index) => index !== 1)).toBe(3);
	});

	it('rejects malformed documents', () => {
		expect(isConstellationData(data)).toBe(true);
		expect(buildSky({ ...data, schema: 'other' }, [post('a')])).toBeNull();
		expect(isConstellationData({ ...data, stars: [['a', 2000, 0, 0, 0, 0, 0]] })).toBe(false);
		expect(isConstellationData({ ...data, stars: [['a', 10, 10, 5, 0, 0, 0]] })).toBe(false);
		expect(isConstellationData({ ...data, figure: [[0, 9]] })).toBe(false);
		expect(isConstellationData({ ...data, near: [[0]] })).toBe(false);
		expect(isConstellationData({ ...data, titles: { ...data.titles, wide: [0] } })).toBe(false);
		expect(isConstellationData({ ...data, titles: undefined })).toBe(false);
		expect(isConstellationData(null)).toBe(false);
	});
});
