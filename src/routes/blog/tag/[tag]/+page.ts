import { getPosts } from '$lib/posts';
import type { PageLoad } from './$types';

export const load: PageLoad = async ({ params }) => {
	const allPosts = await getPosts();
	const tag = decodeURIComponent(params.tag);
	const posts = allPosts.filter((p) => p.tags.some((t) => t.toLowerCase() === tag.toLowerCase()));
	return { posts, tag };
};
