import { describe, it, expect } from 'vitest';
import { POST_CATEGORIES } from './types';
import { searchIndexEntriesToPosts, type SearchIndexEntry } from './posts';

// ---- helpers extracted from the module under test ----
// Since getPosts() uses import.meta.glob (Vite API), we re-implement the
// pure transformation logic here and test it directly, then also test
// getPosts via a module-level mock of import.meta.glob.

/** Derive slug from path + metadata (mirrors src/lib/posts.ts lines 16-23) */
function deriveSlug(path: string, metadata: Record<string, unknown>): string {
	return (
		(metadata.slug as string) ??
		path
			.split('/')
			.pop()
			?.replace('.md', '')
			.replace(/^\d{4}-\d{2}-\d{2}-/, '') ??
		''
	);
}

/** Sort posts newest-first by date (mirrors src/lib/posts.ts line 43) */
function sortByDateDesc<T extends { date: string }>(posts: T[]): T[] {
	return [...posts].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}

/** Filter to published posts only (mirrors src/lib/posts.ts line 14) */
function isPublished(metadata: Record<string, unknown>): boolean {
	return !!metadata?.published;
}

// ---- unit tests for pure logic ----

describe('deriveSlug', () => {
	it('uses metadata.slug when provided', () => {
		expect(deriveSlug('/src/posts/2024-01-01-foo.md', { slug: 'custom-slug' })).toBe('custom-slug');
	});

	it('strips date prefix from filename when no slug in metadata', () => {
		expect(deriveSlug('/src/posts/2024-01-15-hello-world.md', {})).toBe('hello-world');
	});

	it('uses full filename when no date prefix', () => {
		expect(deriveSlug('/src/posts/about-me.md', {})).toBe('about-me');
	});

	it('handles nested paths correctly', () => {
		expect(deriveSlug('/src/posts/drafts/2023-06-01-draft.md', {})).toBe('draft');
	});

	it('returns empty string for degenerate paths', () => {
		expect(deriveSlug('', {})).toBe('');
	});
});

describe('sortByDateDesc', () => {
	it('sorts posts newest first', () => {
		const posts = [
			{ date: '2023-01-01', title: 'old' },
			{ date: '2024-06-15', title: 'newest' },
			{ date: '2023-07-20', title: 'middle' },
		];
		const sorted = sortByDateDesc(posts);
		expect(sorted.map((p) => p.title)).toEqual(['newest', 'middle', 'old']);
	});

	it('does not mutate original array', () => {
		const posts = [
			{ date: '2023-01-01', title: 'a' },
			{ date: '2024-01-01', title: 'b' },
		];
		const original = [...posts];
		sortByDateDesc(posts);
		expect(posts).toEqual(original);
	});

	it('handles empty array', () => {
		expect(sortByDateDesc([])).toEqual([]);
	});

	it('handles single element', () => {
		const posts = [{ date: '2024-01-01', title: 'only' }];
		expect(sortByDateDesc(posts)).toEqual(posts);
	});

	it('handles posts with the same date', () => {
		const posts = [
			{ date: '2024-01-01', title: 'a' },
			{ date: '2024-01-01', title: 'b' },
		];
		const sorted = sortByDateDesc(posts);
		expect(sorted).toHaveLength(2);
	});
});

describe('isPublished', () => {
	it('returns true for published: true', () => {
		expect(isPublished({ published: true })).toBe(true);
	});

	it('returns false for published: false', () => {
		expect(isPublished({ published: false })).toBe(false);
	});

	it('returns false when published is missing', () => {
		expect(isPublished({})).toBe(false);
	});

	it('returns false for null metadata', () => {
		expect(isPublished(null as unknown as Record<string, unknown>)).toBe(false);
	});
});

// ---- direct tests for the real search-index mapping path ----

describe('searchIndexEntriesToPosts', () => {
	const sampleEntries: SearchIndexEntry[] = [
		{
			title: 'Published Post',
			slug: 'published-post',
			date: '2024-06-01',
			description: 'A published post',
			tag_list: ['test', 'blog'],
			published: true,
		},
		{
			title: 'Another Post',
			slug: 'another-post',
			date: '2024-07-15',
			description: 'Another published post',
			tags: 'code performance',
			published: true,
		},
		{
			title: 'Draft Post',
			slug: 'draft-post',
			date: '2024-08-01',
			description: 'A draft',
			tag_list: ['draft'],
			published: false,
		},
		{
			title: 'Old Post',
			slug: 'old-post',
			date: '2023-01-01',
			description: 'An old post',
			tag_list: ['archive'],
			published: true,
			excerpt: 'Old excerpt',
			featured: true,
		},
	];

	it('filters out unpublished posts', () => {
		const posts = searchIndexEntriesToPosts(sampleEntries);
		expect(posts.every((p) => p.published)).toBe(true);
		expect(posts.find((p) => p.title === 'Draft Post')).toBeUndefined();
	});

	it('returns only published posts', () => {
		const posts = searchIndexEntriesToPosts(sampleEntries);
		expect(posts).toHaveLength(3);
	});

	it('sorts by date descending (newest first)', () => {
		const posts = searchIndexEntriesToPosts(sampleEntries);
		expect(posts[0].title).toBe('Another Post'); // 2024-07-15
		expect(posts[1].title).toBe('Published Post'); // 2024-06-01
		expect(posts[2].title).toBe('Old Post'); // 2023-01-01
	});

	it('preserves the explicit search-index slug', () => {
		const posts = searchIndexEntriesToPosts(sampleEntries);
		const published = posts.find((p) => p.title === 'Published Post');
		expect(published?.slug).toBe('published-post');
	});

	it('falls back to splitting string tags when tag_list is absent', () => {
		const posts = searchIndexEntriesToPosts(sampleEntries);
		const another = posts.find((p) => p.title === 'Another Post');
		expect(another?.tags).toEqual(['code', 'performance']);
	});

	it('includes all required Post fields', () => {
		const posts = searchIndexEntriesToPosts(sampleEntries);
		for (const post of posts) {
			expect(post).toHaveProperty('title');
			expect(post).toHaveProperty('slug');
			expect(post).toHaveProperty('date');
			expect(post).toHaveProperty('description');
			expect(post).toHaveProperty('tags');
			expect(post).toHaveProperty('published');
			expect(typeof post.title).toBe('string');
			expect(typeof post.slug).toBe('string');
			expect(typeof post.date).toBe('string');
			expect(Array.isArray(post.tags)).toBe(true);
		}
	});

	it('preserves optional fields from metadata', () => {
		const posts = searchIndexEntriesToPosts(sampleEntries);
		const old = posts.find((p) => p.title === 'Old Post');
		expect(old?.excerpt).toBe('Old excerpt');
		expect(old?.featured).toBe(true);
	});

	it('falls back description to excerpt when description is missing', () => {
		const posts = searchIndexEntriesToPosts([
			{
				title: 'Excerpt Only',
				slug: 'excerpt-only',
				date: '2024-01-01',
				published: true,
				excerpt: 'Fallback excerpt',
				description: '',
			},
		]);
		expect(posts[0].description).toBe('Fallback excerpt');
	});

	it('defaults to empty string for missing description and excerpt', () => {
		const posts = searchIndexEntriesToPosts([
			{
				title: 'No Description',
				slug: 'no-description',
				date: '2024-01-01',
				published: true,
				description: '',
			},
		]);
		expect(posts[0].description).toBe('');
	});

	it('defaults title to slug when title is missing', () => {
		const posts = searchIndexEntriesToPosts([
			{
				slug: 'no-title',
				date: '2024-01-01',
				published: true,
				description: '',
			} as SearchIndexEntry,
		]);
		expect(posts[0].title).toBe('no-title');
		expect(posts[0].slug).toBe('no-title');
	});

	it('defaults tags to empty array when missing', () => {
		const posts = searchIndexEntriesToPosts([
			{
				title: 'No Tags',
				slug: 'no-tags',
				date: '2024-01-01',
				published: true,
				description: '',
			},
		]);
		expect(posts[0].tags).toEqual([]);
	});

	it('handles empty modules (no posts)', () => {
		const posts = searchIndexEntriesToPosts([]);
		expect(posts).toEqual([]);
	});

	it('handles all drafts (nothing published)', () => {
		const posts = searchIndexEntriesToPosts([
			{ title: 'Draft 1', slug: 'draft-1', date: '2024-01-01', description: '', published: false },
			{ title: 'Draft 2', slug: 'draft-2', date: '2024-01-02', description: '', published: false },
		]);
		expect(posts).toEqual([]);
	});

	// ---- category field tests ----

	it('preserves a valid category value', () => {
		const posts = searchIndexEntriesToPosts([
			{
				title: 'Category Post',
				slug: 'category-post',
				date: '2024-01-01',
				description: 'Has category',
				published: true,
				category: 'software',
			},
		]);
		expect(posts[0].category).toBe('software');
	});

	it('rejects invalid category values (sets to undefined)', () => {
		const posts = searchIndexEntriesToPosts([
			{
				title: 'Bad Category',
				slug: 'bad-category',
				date: '2024-01-01',
				description: 'Invalid category',
				published: true,
				category: 'not-a-real-category',
			},
		]);
		expect(posts[0].category).toBeUndefined();
	});

	it('leaves category undefined when not specified', () => {
		const posts = searchIndexEntriesToPosts([
			{
				title: 'No Category',
				slug: 'no-category',
				date: '2024-01-01',
				description: 'No category',
				published: true,
			},
		]);
		expect(posts[0].category).toBeUndefined();
	});

	it('accepts all valid category values', () => {
		for (const cat of POST_CATEGORIES) {
			const posts = searchIndexEntriesToPosts([
				{
					title: `Cat: ${cat}`,
					slug: `cat-${cat}`,
					date: '2024-01-01',
					description: 'test',
					published: true,
					category: cat,
				},
			]);
			expect(posts[0].category).toBe(cat);
		}
	});

	// ---- excerpt / description priority tests ----

	it('uses excerpt over description when both are present', () => {
		const posts = searchIndexEntriesToPosts([
			{
				title: 'Both Fields',
				slug: 'both-fields',
				date: '2024-01-01',
				description: 'The description',
				published: true,
				excerpt: 'The excerpt',
			},
		]);
		expect(posts[0].description).toBe('The excerpt');
		expect(posts[0].excerpt).toBe('The excerpt');
	});

	it('uses description when excerpt is absent', () => {
		const posts = searchIndexEntriesToPosts([
			{
				title: 'Desc Only',
				slug: 'desc-only',
				date: '2024-01-01',
				description: 'Just description',
				published: true,
			},
		]);
		expect(posts[0].description).toBe('Just description');
		expect(posts[0].excerpt).toBeUndefined();
	});

	// ---- author_slug defaulting tests ----

	it('defaults author_slug to jesssullivan when not specified', () => {
		const posts = searchIndexEntriesToPosts([
			{
				title: 'No Author',
				slug: 'no-author',
				date: '2024-01-01',
				description: 'test',
				published: true,
			},
		]);
		expect(posts[0].author_slug).toBe('jesssullivan');
	});

	it('uses explicit author_slug when specified', () => {
		const posts = searchIndexEntriesToPosts([
			{
				title: 'Guest Post',
				slug: 'guest-post',
				date: '2024-01-01',
				description: 'test',
				published: true,
				author_slug: 'guest-author',
			},
		]);
		expect(posts[0].author_slug).toBe('guest-author');
	});
});

// ---- tag filtering logic (mirrors blog/tag/[tag]/+page.ts) ----

describe('tag filtering', () => {
	function filterByTag(posts: Array<{ tags: string[]; title: string }>, tag: string) {
		return posts.filter((p) => p.tags.some((t) => t.toLowerCase() === tag.toLowerCase()));
	}

	const posts = [
		{ title: 'Post A', tags: ['JavaScript', 'Web'] },
		{ title: 'Post B', tags: ['Python', 'Data'] },
		{ title: 'Post C', tags: ['javascript', 'Node'] },
		{ title: 'Post D', tags: [] },
	];

	it('filters posts by tag (case-insensitive)', () => {
		const result = filterByTag(posts, 'javascript');
		expect(result).toHaveLength(2);
		expect(result.map((p) => p.title)).toContain('Post A');
		expect(result.map((p) => p.title)).toContain('Post C');
	});

	it('returns empty for non-existent tag', () => {
		expect(filterByTag(posts, 'rust')).toEqual([]);
	});

	it('handles tag with different casing', () => {
		const result = filterByTag(posts, 'PYTHON');
		expect(result).toHaveLength(1);
		expect(result[0].title).toBe('Post B');
	});

	it('skips posts with empty tags array', () => {
		const result = filterByTag(posts, 'any');
		expect(result.find((p) => p.title === 'Post D')).toBeUndefined();
	});
});
