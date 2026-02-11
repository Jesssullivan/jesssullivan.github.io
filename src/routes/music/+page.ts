import { getPosts } from '$lib/posts';
import type { PageLoad } from './$types';

export const load: PageLoad = async () => {
	const allPosts = await getPosts();
	const musicPosts = allPosts.filter((p) =>
		p.tags.some((t) => t.toLowerCase() === 'music')
	);
	return { musicPosts };
};
