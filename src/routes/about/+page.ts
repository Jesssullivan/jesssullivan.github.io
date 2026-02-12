import { getPosts } from '$lib/posts';
import type { PageLoad } from './$types';

export const load: PageLoad = async () => {
	const posts = await getPosts();
	const featured = posts.filter((p) => p.featured);
	const recent = posts.filter((p) => !p.featured).slice(0, 5);
	return { featured, posts: recent };
};
