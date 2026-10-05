import type { Post } from '$lib/posts';
import { mergeBrokerPostsIntoStatic } from '$lib/tinyland/blogBrokerStream';
import { createReaderCollection, type ReaderCollection } from './collection';

/**
 * Homepage article links must have a prerendered local route. The public broker
 * may enrich checked-in posts, but its broker-only slugs are not in the static
 * /blog/[slug] entry list and must not become dead homepage links.
 */
export function createHomeReaderCollection(
	staticPosts: readonly Post[],
	brokerPosts: readonly Post[],
	publicationHolds: ReadonlySet<string>,
): ReaderCollection {
	const routeableSlugs = new Set(
		staticPosts.filter((post) => !publicationHolds.has(post.slug)).map((post) => post.slug),
	);
	const routeablePosts = mergeBrokerPostsIntoStatic(staticPosts, brokerPosts, publicationHolds)
		.filter((post) => routeableSlugs.has(post.slug));
	return createReaderCollection(routeablePosts);
}
