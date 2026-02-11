import { getPosts } from '$lib/posts';
import { getRawPostContent } from '$lib/feed-utils';
import type { RequestHandler } from './$types';

export const prerender = true;

export const entries = async () => {
	const posts = await getPosts();
	const tags = new Set<string>();
	for (const post of posts) {
		for (const tag of post.tags ?? []) {
			tags.add(tag);
		}
	}
	return [...tags].map((tag) => ({ tag }));
};

export const GET: RequestHandler = async ({ params }) => {
	const posts = await getPosts();
	const rawContent = getRawPostContent();
	const site = 'https://transscendsurvival.org';
	const tag = decodeURIComponent(params.tag);

	const filtered = posts.filter((p) => p.published && (p.tags ?? []).includes(tag));

	const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:content="http://purl.org/rss/1.0/modules/content/">
  <channel>
    <title>transscendsurvival.org — ${tag}</title>
    <description>Posts tagged "${tag}" by Jess Sullivan</description>
    <link>${site}/blog/tag/${encodeURIComponent(tag)}</link>
    <atom:link href="${site}/blog/tag/${encodeURIComponent(tag)}/feed.xml" rel="self" type="application/rss+xml"/>
    <language>en-us</language>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
    ${filtered
			.map(
				(post) => `<item>
      <title><![CDATA[${post.title}]]></title>
      <link>${site}/blog/${post.slug}</link>
      <guid isPermaLink="true">${site}/blog/${post.slug}</guid>
      <pubDate>${new Date(post.date).toUTCString()}</pubDate>
      <description><![CDATA[${post.description}]]></description>
      <content:encoded><![CDATA[${rawContent.get(post.slug) ?? post.description}]]></content:encoded>
      ${(post.tags ?? []).map((t) => `<category>${t}</category>`).join('\n      ')}
    </item>`
			)
			.join('\n    ')}
  </channel>
</rss>`;

	return new Response(xml.trim(), {
		headers: {
			'Content-Type': 'application/xml',
			'Cache-Control': 'max-age=0, s-maxage=3600'
		}
	});
};
