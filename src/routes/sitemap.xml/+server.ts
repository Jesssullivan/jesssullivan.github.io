import { getPosts } from '$lib/posts';

export const prerender = true;

export async function GET() {
	const posts = await getPosts();
	const site = 'https://transscendsurvival.org';

	const staticPages = ['', '/blog', '/cv', '/about'];

	const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  ${staticPages
		.map(
			(path) => `<url>
    <loc>${site}${path}</loc>
    <changefreq>${path === '' ? 'weekly' : 'monthly'}</changefreq>
    <priority>${path === '' ? '1.0' : '0.8'}</priority>
  </url>`
		)
		.join('\n  ')}
  ${posts
		.filter((p) => p.published)
		.map(
			(post) => `<url>
    <loc>${site}/blog/${post.slug}</loc>
    <lastmod>${new Date(post.date).toISOString().split('T')[0]}</lastmod>
    <changefreq>yearly</changefreq>
    <priority>0.6</priority>
  </url>`
		)
		.join('\n  ')}
</urlset>`;

	return new Response(xml.trim(), {
		headers: {
			'Content-Type': 'application/xml',
			'Cache-Control': 'max-age=0, s-maxage=3600'
		}
	});
}
