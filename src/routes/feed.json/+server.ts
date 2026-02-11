import { getPosts } from '$lib/posts';

export const prerender = true;

export async function GET() {
	const posts = await getPosts();
	const site = 'https://transscendsurvival.org';

	const feed = {
		version: 'https://jsonfeed.org/version/1.1',
		title: 'transscendsurvival.org',
		home_page_url: site,
		feed_url: `${site}/feed.json`,
		description: 'Blog by Jess Sullivan',
		language: 'en-US',
		authors: [{ name: 'Jess Sullivan', url: 'https://github.com/Jesssullivan' }],
		items: posts
			.filter((p) => p.published)
			.map((post) => ({
				id: `${site}/blog/${post.slug}`,
				url: `${site}/blog/${post.slug}`,
				title: post.title,
				summary: post.description,
				date_published: new Date(post.date).toISOString(),
				tags: post.tags
			}))
	};

	return new Response(JSON.stringify(feed, null, 2), {
		headers: {
			'Content-Type': 'application/feed+json',
			'Cache-Control': 'max-age=0, s-maxage=3600'
		}
	});
}
