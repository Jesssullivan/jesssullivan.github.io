import { describe, expect, it } from 'vitest';
import type { Post } from '$lib/posts';
import { createHomeReaderCollection } from './homeProjection';

const staticPost: Post = {
	title: 'Checked-in article',
	slug: 'checked-in-article',
	date: '2026-09-22',
	description: '',
	tags: [],
	published: true,
};

const heldPost: Post = {
	...staticPost,
	title: 'Held article',
	slug: 'held-article',
};

describe('createHomeReaderCollection', () => {
	it('keeps only routeable static slugs, even when a valid broker stream includes a newer post', () => {
		const collection = createHomeReaderCollection(
			[staticPost, heldPost],
			[
				{ ...staticPost, feature_image: 'https://hub.tinyland.dev/images/checked-in.preview.webp' },
				{ ...staticPost, slug: 'broker-only', title: 'Broker-only article', date: '2026-09-24' },
				{ ...heldPost, feature_image: 'https://hub.tinyland.dev/images/held.preview.webp' },
			],
			new Set(['held-article']),
		);

		expect(collection.latest.map((post) => post.slug)).toEqual(['checked-in-article']);
		expect(collection.archive.flatMap((group) => group.posts.map((post) => post.slug))).toEqual([
			'checked-in-article',
		]);
		expect(collection.latest[0]?.feature_image).toBe('https://hub.tinyland.dev/images/checked-in.preview.webp');
	});

	it('retains the checked-in first-paint collection when broker data is unavailable', () => {
		const collection = createHomeReaderCollection([staticPost, heldPost], [], new Set(['held-article']));
		expect(collection.latest.map((post) => post.slug)).toEqual(['checked-in-article']);
	});
});
