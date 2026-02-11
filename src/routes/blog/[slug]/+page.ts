import type { PageLoad, EntryGenerator } from './$types';
import { error } from '@sveltejs/kit';
import { computeReadingTime } from '$lib/posts';

interface PostMeta {
	title: string;
	slug: string;
	date: string;
	published?: boolean;
	description?: string;
	tags?: string[];
	original_url?: string;
	reading_time?: number;
	[key: string]: unknown;
}

function getSlug(path: string, metadata: PostMeta): string {
	const filename = path.split('/').pop()?.replace('.md', '') ?? '';
	return metadata.slug ?? filename.replace(/^\d{4}-\d{2}-\d{2}-/, '');
}

function getEagerModules() {
	return import.meta.glob('/src/posts/*.md', { eager: true }) as Record<
		string,
		{ metadata: PostMeta }
	>;
}

function getRawModules() {
	return import.meta.glob('/src/posts/*.md', {
		eager: true,
		query: '?raw',
		import: 'default'
	}) as Record<string, string>;
}

function getSortedPosts(): { slug: string; title: string; date: string; tags: string[] }[] {
	const modules = getEagerModules();
	const posts: { slug: string; title: string; date: string; tags: string[] }[] = [];

	for (const [path, module] of Object.entries(modules)) {
		const metadata = module.metadata;
		if (!metadata?.published) continue;

		const slug = getSlug(path, metadata);
		posts.push({
			slug,
			title: metadata.title ?? slug,
			date: metadata.date ?? '',
			tags: metadata.tags ?? []
		});
	}

	return posts.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}

function computeRelatedPosts(
	currentSlug: string,
	currentTags: Set<string>,
	posts: { slug: string; title: string; date: string; tags: string[] }[]
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

function slugToPath(): Map<string, string> {
	const modules = getEagerModules();
	const map = new Map<string, string>();
	for (const [path, module] of Object.entries(modules)) {
		const metadata = module.metadata;
		if (!metadata?.published) continue;
		map.set(getSlug(path, metadata), path);
	}
	return map;
}

export const entries: EntryGenerator = async () => {
	return getSortedPosts().map(({ slug }) => ({ slug }));
};

export const load: PageLoad = async ({ params }) => {
	const lazyModules = import.meta.glob('/src/posts/*.md');
	const rawModules = getRawModules();
	const pathMap = slugToPath();
	const matchedPath = pathMap.get(params.slug);

	if (matchedPath && lazyModules[matchedPath]) {
		const post = (await lazyModules[matchedPath]()) as {
			default: import('svelte').Snippet;
			metadata: PostMeta;
		};

		// Compute reading time from raw markdown at build time
		const rawContent = rawModules[matchedPath] ?? '';
		const reading_time =
			post.metadata.reading_time ?? computeReadingTime(rawContent);

		const sorted = getSortedPosts();
		const idx = sorted.findIndex((p) => p.slug === params.slug);
		const prev = idx < sorted.length - 1 ? sorted[idx + 1] : null;
		const next = idx > 0 ? sorted[idx - 1] : null;

		// Compute related posts by tag overlap + recency
		const currentTags = new Set(post.metadata.tags ?? []);
		const relatedPosts = computeRelatedPosts(params.slug, currentTags, sorted);

		return {
			content: post.default,
			metadata: post.metadata,
			reading_time,
			prev,
			next,
			relatedPosts
		};
	}

	error(404, 'Post not found');
};
