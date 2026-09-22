import type { Post } from '$lib/posts';

export interface ReaderCollection {
	latest: Post[];
	archive: ReadonlyArray<{ year: string; posts: Post[] }>;
}

export function createReaderCollection(posts: Post[], latestLimit = 6): ReaderCollection {
	const orderedPosts = [...posts].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
	const byYear = new Map<string, Post[]>();

	for (const post of orderedPosts) {
		const year = post.date.slice(0, 4) || 'Undated';
		const group = byYear.get(year) ?? [];
		group.push(post);
		byYear.set(year, group);
	}

	return {
		latest: orderedPosts.slice(0, latestLimit),
		archive: Array.from(byYear, ([year, groupedPosts]) => ({ year, posts: groupedPosts })),
	};
}
