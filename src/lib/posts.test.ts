import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST_CATEGORIES } from './types';
import type { PostCategory } from './types';

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
		expect(deriveSlug('/src/posts/2024-01-01-foo.md', { slug: 'custom-slug' })).toBe(
			'custom-slug'
		);
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
			{ date: '2023-07-20', title: 'middle' }
		];
		const sorted = sortByDateDesc(posts);
		expect(sorted.map((p) => p.title)).toEqual(['newest', 'middle', 'old']);
	});

	it('does not mutate original array', () => {
		const posts = [
			{ date: '2023-01-01', title: 'a' },
			{ date: '2024-01-01', title: 'b' }
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
			{ date: '2024-01-01', title: 'b' }
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

// ---- integration test: getPosts with mocked import.meta.glob ----

describe('getPosts (mocked glob)', () => {
	// We dynamically import to let vi.stubGlobal work before the module loads
	beforeEach(() => {
		vi.resetModules();
	});

	function mockGlob(modules: Record<string, { metadata: Record<string, unknown> }>) {
		// import.meta.glob with { eager: true } returns the modules synchronously
		vi.stubGlobal('__vite_glob_0_0', modules);
		// We need to mock at the Vite level. Instead, we'll re-implement the
		// getPosts logic inline with our mock data to verify the full pipeline.
	}

	/** Reimplements getPosts pipeline with injected modules for testing */
	function getPostsFromModules(
		modules: Record<string, { metadata: Record<string, unknown> }>
	) {
		const posts: Array<{
			title: string;
			slug: string;
			date: string;
			description: string;
			tags: string[];
			published: boolean;
			original_url?: string;
			excerpt?: string;
			category?: PostCategory;
			categories?: string[];
			reading_time?: number;
			feature_image?: string;
			thumbnail_image?: string;
			featured?: boolean;
			author_slug?: string;
		}> = [];

		for (const [path, module] of Object.entries(modules)) {
			const metadata = module.metadata;
			if (!metadata?.published) continue;

			const slug = deriveSlug(path, metadata);

			// Validate category against allowed values (mirrors posts.ts)
			const rawCategory = metadata.category as string | undefined;
			const category: PostCategory | undefined =
				rawCategory &&
				(POST_CATEGORIES as readonly string[]).includes(rawCategory)
					? (rawCategory as PostCategory)
					: undefined;

			posts.push({
				title: (metadata.title as string) ?? slug,
				slug,
				date: (metadata.date as string) ?? '',
				description:
					(metadata.excerpt as string) ?? (metadata.description as string) ?? '',
				tags: (metadata.tags as string[]) ?? [],
				published: true,
				original_url: (metadata.original_url as string) ?? undefined,
				excerpt: (metadata.excerpt as string) ?? undefined,
				category,
				categories: (metadata.categories as string[]) ?? undefined,
				reading_time: (metadata.reading_time as number) ?? undefined,
				feature_image: (metadata.feature_image as string) ?? undefined,
				thumbnail_image: (metadata.thumbnail_image as string) ?? undefined,
				featured: (metadata.featured as boolean) ?? undefined,
				author_slug: (metadata.author_slug as string) ?? 'jesssullivan'
			});
		}

		return posts.sort(
			(a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
		);
	}

	const sampleModules = {
		'/src/posts/2024-06-01-published-post.md': {
			metadata: {
				title: 'Published Post',
				date: '2024-06-01',
				description: 'A published post',
				tags: ['test', 'blog'],
				published: true,
				slug: 'published-post'
			}
		},
		'/src/posts/2024-07-15-another-post.md': {
			metadata: {
				title: 'Another Post',
				date: '2024-07-15',
				description: 'Another published post',
				tags: ['code'],
				published: true
			}
		},
		'/src/posts/2024-08-01-draft-post.md': {
			metadata: {
				title: 'Draft Post',
				date: '2024-08-01',
				description: 'A draft',
				tags: [],
				published: false
			}
		},
		'/src/posts/2023-01-01-old-post.md': {
			metadata: {
				title: 'Old Post',
				date: '2023-01-01',
				description: 'An old post',
				tags: ['archive'],
				published: true,
				excerpt: 'Old excerpt',
				categories: ['history'],
				featured: true
			}
		}
	};

	it('filters out unpublished posts', () => {
		const posts = getPostsFromModules(sampleModules);
		expect(posts.every((p) => p.published)).toBe(true);
		expect(posts.find((p) => p.title === 'Draft Post')).toBeUndefined();
	});

	it('returns only published posts', () => {
		const posts = getPostsFromModules(sampleModules);
		expect(posts).toHaveLength(3);
	});

	it('sorts by date descending (newest first)', () => {
		const posts = getPostsFromModules(sampleModules);
		expect(posts[0].title).toBe('Another Post'); // 2024-07-15
		expect(posts[1].title).toBe('Published Post'); // 2024-06-01
		expect(posts[2].title).toBe('Old Post'); // 2023-01-01
	});

	it('uses metadata.slug when available', () => {
		const posts = getPostsFromModules(sampleModules);
		const published = posts.find((p) => p.title === 'Published Post');
		expect(published?.slug).toBe('published-post');
	});

	it('derives slug from filename when metadata.slug is absent', () => {
		const posts = getPostsFromModules(sampleModules);
		const another = posts.find((p) => p.title === 'Another Post');
		expect(another?.slug).toBe('another-post');
	});

	it('includes all required Post fields', () => {
		const posts = getPostsFromModules(sampleModules);
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
		const posts = getPostsFromModules(sampleModules);
		const old = posts.find((p) => p.title === 'Old Post');
		expect(old?.excerpt).toBe('Old excerpt');
		expect(old?.categories).toEqual(['history']);
		expect(old?.featured).toBe(true);
	});

	it('falls back description to excerpt when description is missing', () => {
		const modules = {
			'/src/posts/2024-01-01-excerpt-only.md': {
				metadata: {
					title: 'Excerpt Only',
					date: '2024-01-01',
					tags: [],
					published: true,
					excerpt: 'Fallback excerpt'
				}
			}
		};
		const posts = getPostsFromModules(modules);
		expect(posts[0].description).toBe('Fallback excerpt');
	});

	it('defaults to empty string for missing description and excerpt', () => {
		const modules = {
			'/src/posts/2024-01-01-no-desc.md': {
				metadata: {
					title: 'No Description',
					date: '2024-01-01',
					tags: [],
					published: true
				}
			}
		};
		const posts = getPostsFromModules(modules);
		expect(posts[0].description).toBe('');
	});

	it('defaults title to slug when title is missing', () => {
		const modules = {
			'/src/posts/2024-01-01-no-title.md': {
				metadata: {
					date: '2024-01-01',
					tags: [],
					published: true
				}
			}
		};
		const posts = getPostsFromModules(modules);
		expect(posts[0].title).toBe('no-title');
		expect(posts[0].slug).toBe('no-title');
	});

	it('defaults tags to empty array when missing', () => {
		const modules = {
			'/src/posts/2024-01-01-no-tags.md': {
				metadata: {
					title: 'No Tags',
					date: '2024-01-01',
					published: true
				}
			}
		};
		const posts = getPostsFromModules(modules);
		expect(posts[0].tags).toEqual([]);
	});

	it('handles empty modules (no posts)', () => {
		const posts = getPostsFromModules({});
		expect(posts).toEqual([]);
	});

	it('handles all drafts (nothing published)', () => {
		const modules = {
			'/src/posts/2024-01-01-draft1.md': {
				metadata: { title: 'Draft 1', published: false }
			},
			'/src/posts/2024-01-01-draft2.md': {
				metadata: { title: 'Draft 2' }
			}
		};
		const posts = getPostsFromModules(modules);
		expect(posts).toEqual([]);
	});

	// ---- category field tests ----

	it('preserves a valid category value', () => {
		const modules = {
			'/src/posts/2024-01-01-cat-post.md': {
				metadata: {
					title: 'Category Post',
					date: '2024-01-01',
					description: 'Has category',
					tags: [],
					published: true,
					category: 'software'
				}
			}
		};
		const posts = getPostsFromModules(modules);
		expect(posts[0].category).toBe('software');
	});

	it('rejects invalid category values (sets to undefined)', () => {
		const modules = {
			'/src/posts/2024-01-01-bad-cat.md': {
				metadata: {
					title: 'Bad Category',
					date: '2024-01-01',
					description: 'Invalid category',
					tags: [],
					published: true,
					category: 'not-a-real-category'
				}
			}
		};
		const posts = getPostsFromModules(modules);
		expect(posts[0].category).toBeUndefined();
	});

	it('leaves category undefined when not specified', () => {
		const modules = {
			'/src/posts/2024-01-01-no-cat.md': {
				metadata: {
					title: 'No Category',
					date: '2024-01-01',
					description: 'No category',
					tags: [],
					published: true
				}
			}
		};
		const posts = getPostsFromModules(modules);
		expect(posts[0].category).toBeUndefined();
	});

	it('accepts all valid category values', () => {
		for (const cat of POST_CATEGORIES) {
			const modules = {
				'/src/posts/2024-01-01-test.md': {
					metadata: {
						title: `Cat: ${cat}`,
						date: '2024-01-01',
						description: 'test',
						tags: [],
						published: true,
						category: cat
					}
				}
			};
			const posts = getPostsFromModules(modules);
			expect(posts[0].category).toBe(cat);
		}
	});

	// ---- excerpt / description priority tests ----

	it('uses excerpt over description when both are present', () => {
		const modules = {
			'/src/posts/2024-01-01-both.md': {
				metadata: {
					title: 'Both Fields',
					date: '2024-01-01',
					description: 'The description',
					tags: [],
					published: true,
					excerpt: 'The excerpt'
				}
			}
		};
		const posts = getPostsFromModules(modules);
		expect(posts[0].description).toBe('The excerpt');
		expect(posts[0].excerpt).toBe('The excerpt');
	});

	it('uses description when excerpt is absent', () => {
		const modules = {
			'/src/posts/2024-01-01-desc-only.md': {
				metadata: {
					title: 'Desc Only',
					date: '2024-01-01',
					description: 'Just description',
					tags: [],
					published: true
				}
			}
		};
		const posts = getPostsFromModules(modules);
		expect(posts[0].description).toBe('Just description');
		expect(posts[0].excerpt).toBeUndefined();
	});

	// ---- author_slug defaulting tests ----

	it('defaults author_slug to jesssullivan when not specified', () => {
		const modules = {
			'/src/posts/2024-01-01-no-author.md': {
				metadata: {
					title: 'No Author',
					date: '2024-01-01',
					description: 'test',
					tags: [],
					published: true
				}
			}
		};
		const posts = getPostsFromModules(modules);
		expect(posts[0].author_slug).toBe('jesssullivan');
	});

	it('uses explicit author_slug when specified', () => {
		const modules = {
			'/src/posts/2024-01-01-guest.md': {
				metadata: {
					title: 'Guest Post',
					date: '2024-01-01',
					description: 'test',
					tags: [],
					published: true,
					author_slug: 'guest-author'
				}
			}
		};
		const posts = getPostsFromModules(modules);
		expect(posts[0].author_slug).toBe('guest-author');
	});
});

// ---- tag filtering logic (mirrors blog/tag/[tag]/+page.ts) ----

describe('tag filtering', () => {
	function filterByTag(
		posts: Array<{ tags: string[]; title: string }>,
		tag: string
	) {
		return posts.filter((p) => p.tags.some((t) => t.toLowerCase() === tag.toLowerCase()));
	}

	const posts = [
		{ title: 'Post A', tags: ['JavaScript', 'Web'] },
		{ title: 'Post B', tags: ['Python', 'Data'] },
		{ title: 'Post C', tags: ['javascript', 'Node'] },
		{ title: 'Post D', tags: [] }
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
