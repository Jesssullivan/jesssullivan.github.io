import type { PageLoad, EntryGenerator } from './$types';
import { error } from '@sveltejs/kit';
import { publishedPostLoaders } from '$lib/data/blog-post-loaders.generated';
import searchIndexData from '../../../../static/search-index.json';
import publicationHoldsData from '../../../../static/blog-publication-holds.json';

interface PostMeta {
	title: string;
	date: string;
	slug: string;
	published?: boolean;
	description?: string;
	tags?: string[];
	original_url?: string;
	reading_time?: number;
	[key: string]: unknown;
}

interface SearchIndexEntry {
	title: string;
	slug: string;
	date: string;
	source_file?: string;
	tag_list?: string[];
	reading_time?: number;
	published?: boolean;
}

const searchIndex = (searchIndexData as SearchIndexEntry[]).filter((entry) => entry.published !== false);
const publicationHolds = new Set(publicationHoldsData as string[]);

function getSortedPosts(): { slug: string; title: string; date: string; tags: string[] }[] {
	return [...searchIndex]
		.map((entry) => ({
			slug: entry.slug,
			title: entry.title ?? entry.slug,
			date: entry.date ?? '',
			tags: entry.tag_list ?? [],
		}))
		.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}

function computeRelatedPosts(
	currentSlug: string,
	currentTags: Set<string>,
	posts: { slug: string; title: string; date: string; tags: string[] }[],
): { slug: string; title: string; date: string }[] {
	if (currentTags.size === 0) {
		// No tags — return 3 most recent posts (excluding current)
		return posts.filter((p) => p.slug !== currentSlug).slice(0, 3);
	}

	const scored = posts
		.filter((p) => p.slug !== currentSlug)
		.map((p) => {
			const overlap = p.tags.filter((t) => currentTags.has(t)).length;
			return { ...p, score: overlap };
		})
		.sort((a, b) => {
			// Primary: tag overlap descending
			if (b.score !== a.score) return b.score - a.score;
			// Secondary: recency descending
			return new Date(b.date).getTime() - new Date(a.date).getTime();
		});

	return scored.slice(0, 3);
}

export const entries: EntryGenerator = async () => {
	return searchIndex.map(({ slug }) => ({ slug }));
};

export const load: PageLoad = async ({ params }) => {
	if (publicationHolds.has(params.slug)) {
		throw error(404, 'Post not found');
	}

	const searchEntry = searchIndex.find((entry) => entry.slug === params.slug);
	const matchedPath = searchEntry?.source_file;
	const postLoader = matchedPath
		? (publishedPostLoaders as Record<string, () => Promise<unknown>>)[matchedPath]
		: undefined;

	if (matchedPath && postLoader) {
		const post = (await postLoader()) as {
			default: import('svelte').Snippet;
			metadata: PostMeta;
		};

		const reading_time = searchEntry?.reading_time ?? post.metadata.reading_time ?? 1;

		const sorted = getSortedPosts();
		const idx = sorted.findIndex((p) => p.slug === params.slug);
		const prev = idx < sorted.length - 1 ? sorted[idx + 1] : null;
		const next = idx > 0 ? sorted[idx - 1] : null;

		// Compute related posts by tag overlap + recency
		const currentTags = new Set(searchEntry?.tag_list ?? post.metadata.tags ?? []);
		const relatedPosts = computeRelatedPosts(params.slug, currentTags, sorted);

		return {
			content: post.default,
			metadata: { ...post.metadata, slug: params.slug },
			reading_time,
			prev,
			next,
			relatedPosts,
			brokerSlug: params.slug,
			brokerOnly: false,
		};
	}

	return {
		content: null,
		metadata: {
			title: 'Post unavailable',
			slug: params.slug,
			date: '',
			description: '',
			tags: [],
			published: true,
		},
		reading_time: null,
		prev: null,
		next: null,
		relatedPosts: [],
		brokerSlug: params.slug,
		brokerOnly: true,
	};
};
