import { getPosts } from '$lib/posts';
import type { PageLoad } from './$types';

interface GalleryPhoto {
	src: string;
	webp: string | null;
	width: number;
	height: number;
	post_slug: string | null;
	post_title: string | null;
}

export const load: PageLoad = async ({ fetch }) => {
	const allPosts = await getPosts();
	const photographyPosts = allPosts.filter((p) =>
		p.tags.some((t) => ['photography', 'birding'].includes(t.toLowerCase()))
	);

	const resp = await fetch('/photo-gallery.json');
	const gallery: GalleryPhoto[] = resp.ok ? await resp.json() : [];

	return { photographyPosts, gallery };
};
