import { describe, expect, it } from 'vitest';
import { createReaderCollection } from './collection';

describe('createReaderCollection', () => {
	const posts = [
		{ title: 'Older', slug: 'older', date: '2024-01-02', description: '', tags: [], published: true },
		{ title: 'Newest', slug: 'newest', date: '2025-03-01', description: '', tags: [], published: true },
		{ title: 'Middle', slug: 'middle', date: '2024-06-03', description: '', tags: [], published: true },
	];

	it('uses the real post order for latest and archive links without mutating input', () => {
		const original = [...posts];
		const collection = createReaderCollection(posts, 2);

		expect(collection.latest.map((post) => post.slug)).toEqual(['newest', 'middle']);
		expect(collection.archive.map((group) => [group.year, group.posts.map((post) => post.slug)])).toEqual([
			['2025', ['newest']],
			['2024', ['middle', 'older']],
		]);
		expect(posts).toEqual(original);
	});
});
