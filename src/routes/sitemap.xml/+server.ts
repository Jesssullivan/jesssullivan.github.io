import { getPosts } from '$lib/posts';
import { noteSitemapUrl } from '$lib/notes';
import { NOTES } from '$lib/server/notes';

export const prerender = true;

export async function GET() {
	const posts = await getPosts();
	const site = 'https://transscendsurvival.org';

	const staticPages = ['/about', '/blog', '/cv', '/music'];

	const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  ${staticPages
		.map(
			(path) => `<url>
    <loc>${site}${path}</loc>
    <changefreq>${path === '/blog' ? 'weekly' : 'monthly'}</changefreq>
    <priority>${path === '/blog' ? '1.0' : '0.8'}</priority>
  </url>`
		)
		.join('\n  ')}
  ${[
		...posts
			.filter((p) => p.published)
			.map(
				(post) => `<url>
    <loc>${site}/blog/${post.slug}</loc>
    <lastmod>${new Date(post.date).toISOString().split('T')[0]}</lastmod>
    <changefreq>yearly</changefreq>
    <priority>0.6</priority>
  </url>`
			),
		// The notes list and each note come after the posts, newest first.
		// With no notes nothing is added, so the sitemap stays as it was.
		...(NOTES.length
			? [
					`<url>
    <loc>${site}/notes</loc>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>`,
					...NOTES.map(noteSitemapUrl)
				]
			: [])
	].join('\n  ')}
</urlset>`;

	return new Response(xml.trim(), {
		headers: {
			'Content-Type': 'application/xml',
			'Cache-Control': 'max-age=0, s-maxage=3600'
		}
	});
}
