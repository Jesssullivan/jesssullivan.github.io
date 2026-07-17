import { getPosts } from '$lib/posts';
import type { PageLoad } from './$types';
import publicationHoldsData from '../../../static/blog-publication-holds.json';

export const load: PageLoad = async () => {
	const posts = await getPosts();
	return { posts, publicationHolds: publicationHoldsData as string[] };
};
