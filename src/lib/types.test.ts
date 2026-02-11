import { describe, it, expect } from 'vitest';
import type { Post, PostFrontmatter, PostCategory } from './types';
import { POST_CATEGORIES } from './types';

// Type-level tests: these verify that the interfaces enforce the expected shape
// at compile time. If the types change, these tests will fail to compile.

describe('PostFrontmatter type', () => {
	it('accepts a minimal valid frontmatter object', () => {
		const fm: PostFrontmatter = {
			title: 'Test Post',
			date: '2024-01-01',
			description: 'A test',
			tags: ['test'],
			published: true
		};
		expect(fm.title).toBe('Test Post');
		expect(fm.published).toBe(true);
	});

	it('accepts all optional fields', () => {
		const fm: PostFrontmatter = {
			title: 'Full Post',
			date: '2024-06-15',
			description: 'Full description',
			tags: ['a', 'b'],
			published: true,
			slug: 'full-post',
			original_url: 'https://example.com/full-post',
			excerpt: 'Short excerpt',
			category: 'software',
			categories: ['cat1'],
			reading_time: 5,
			feature_image: '/images/hero.jpg',
			thumbnail_image: '/images/thumb.jpg',
			featured: true,
			author_slug: 'jess'
		};
		expect(fm.slug).toBe('full-post');
		expect(fm.category).toBe('software');
		expect(fm.reading_time).toBe(5);
		expect(fm.featured).toBe(true);
		expect(fm.author_slug).toBe('jess');
	});

	it('allows optional fields to be undefined', () => {
		const fm: PostFrontmatter = {
			title: 'Sparse',
			date: '2024-01-01',
			description: '',
			tags: [],
			published: false
		};
		expect(fm.slug).toBeUndefined();
		expect(fm.original_url).toBeUndefined();
		expect(fm.excerpt).toBeUndefined();
		expect(fm.category).toBeUndefined();
		expect(fm.categories).toBeUndefined();
		expect(fm.reading_time).toBeUndefined();
		expect(fm.feature_image).toBeUndefined();
		expect(fm.thumbnail_image).toBeUndefined();
		expect(fm.featured).toBeUndefined();
		expect(fm.author_slug).toBeUndefined();
	});
});

describe('Post type', () => {
	it('extends PostFrontmatter with a required slug', () => {
		const post: Post = {
			title: 'My Post',
			date: '2024-01-01',
			description: 'Desc',
			tags: [],
			published: true,
			slug: 'my-post'
		};
		expect(post.slug).toBe('my-post');
	});

	it('accepts optional content field', () => {
		const post: Post = {
			title: 'With Content',
			date: '2024-01-01',
			description: 'Has content',
			tags: [],
			published: true,
			slug: 'with-content',
			content: '<p>Hello world</p>'
		};
		expect(post.content).toBe('<p>Hello world</p>');
	});

	it('validates date format is a string (ISO date)', () => {
		const post: Post = {
			title: 'Date Test',
			date: '2024-12-31',
			description: '',
			tags: [],
			published: true,
			slug: 'date-test'
		};
		// Verify the date string can be parsed to a valid Date
		const parsed = new Date(post.date);
		expect(parsed.getTime()).not.toBeNaN();
		// Use UTC methods to avoid timezone-dependent failures
		expect(parsed.getUTCFullYear()).toBe(2024);
		expect(parsed.getUTCMonth()).toBe(11); // 0-indexed
		expect(parsed.getUTCDate()).toBe(31);
	});

	it('tags is an array of strings', () => {
		const post: Post = {
			title: 'Tags Test',
			date: '2024-01-01',
			description: '',
			tags: ['svelte', 'typescript', 'blog'],
			published: true,
			slug: 'tags-test'
		};
		expect(post.tags).toHaveLength(3);
		expect(post.tags.every((t) => typeof t === 'string')).toBe(true);
	});
});

describe('PostCategory type', () => {
	it('POST_CATEGORIES contains all expected values', () => {
		expect(POST_CATEGORIES).toEqual([
			'hardware',
			'software',
			'ecology',
			'music',
			'photography',
			'personal',
			'tutorial',
			'devops'
		]);
	});

	it('POST_CATEGORIES is readonly (frozen at type level)', () => {
		// The const assertion means the array is readonly at the type level.
		// At runtime, verify the values are the expected set.
		expect(POST_CATEGORIES).toHaveLength(8);
	});

	it('accepts valid category values in PostFrontmatter', () => {
		for (const cat of POST_CATEGORIES) {
			const fm: PostFrontmatter = {
				title: 'Test',
				date: '2024-01-01',
				description: 'Desc',
				tags: [],
				published: true,
				category: cat
			};
			expect(fm.category).toBe(cat);
		}
	});

	it('can validate a string against POST_CATEGORIES at runtime', () => {
		const isValidCategory = (s: string): s is PostCategory =>
			(POST_CATEGORIES as readonly string[]).includes(s);

		expect(isValidCategory('software')).toBe(true);
		expect(isValidCategory('ecology')).toBe(true);
		expect(isValidCategory('invalid-category')).toBe(false);
		expect(isValidCategory('')).toBe(false);
	});
});

// Runtime type guard tests — useful if type guards are added later
describe('runtime type validation helpers', () => {
	/** Simple runtime check that an object satisfies minimal Post shape */
	function isValidPost(obj: unknown): obj is Post {
		if (typeof obj !== 'object' || obj === null) return false;
		const o = obj as Record<string, unknown>;
		return (
			typeof o.title === 'string' &&
			typeof o.slug === 'string' &&
			typeof o.date === 'string' &&
			typeof o.description === 'string' &&
			Array.isArray(o.tags) &&
			typeof o.published === 'boolean'
		);
	}

	it('validates a correct Post object', () => {
		expect(
			isValidPost({
				title: 'Test',
				slug: 'test',
				date: '2024-01-01',
				description: 'Desc',
				tags: [],
				published: true
			})
		).toBe(true);
	});

	it('rejects object missing title', () => {
		expect(
			isValidPost({
				slug: 'test',
				date: '2024-01-01',
				description: 'Desc',
				tags: [],
				published: true
			})
		).toBe(false);
	});

	it('rejects object with wrong tag type', () => {
		expect(
			isValidPost({
				title: 'Test',
				slug: 'test',
				date: '2024-01-01',
				description: 'Desc',
				tags: 'not-an-array',
				published: true
			})
		).toBe(false);
	});

	it('rejects null', () => {
		expect(isValidPost(null)).toBe(false);
	});

	it('rejects undefined', () => {
		expect(isValidPost(undefined)).toBe(false);
	});

	it('rejects a string', () => {
		expect(isValidPost('not a post')).toBe(false);
	});
});
