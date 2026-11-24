import { getPosts, type Post } from '$lib/posts';
import { getRawPostContent } from '$lib/feed-utils';
import { mergeNotesIntoPosts, noteRssItem } from '$lib/notes';
import { NOTES } from '$lib/server/notes';

export const prerender = true;

export async function GET() {
	const posts = await getPosts();
	const rawContent = getRawPostContent();
	const site = 'https://transscendsurvival.org';

	const postItem = (post: Post) => `<item>
      <title><![CDATA[${post.title}]]></title>
      <link>${site}/blog/${post.slug}</link>
      <guid isPermaLink="true">${site}/blog/${post.slug}</guid>
      <pubDate>${new Date(post.date).toUTCString()}</pubDate>
      <description><![CDATA[${post.description}]]></description>
      <content:encoded><![CDATA[${rawContent.get(post.slug) ?? post.description}]]></content:encoded>
      ${(post.tags ?? []).map((tag) => `<category>${tag}</category>`).join('\n      ')}
    </item>`;

	// Notes merge in by date. Posts keep their order and their bytes, so with
	// no notes this feed is the same as before notes existed.
	const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:content="http://purl.org/rss/1.0/modules/content/">
  <channel>
    <title>transscendsurvival.org</title>
    <description>Blog by Jess Sullivan — full stack engineer, musician, and birdwatcher.</description>
    <link>${site}</link>
    <atom:link href="${site}/feed.xml" rel="self" type="application/rss+xml"/>
    <language>en-us</language>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
    ${mergeNotesIntoPosts(
			posts.filter((p) => p.published),
			NOTES,
		)
			.map((entry) => (entry.kind === 'note' ? noteRssItem(entry.item) : postItem(entry.item)))
			.join('\n    ')}
  </channel>
</rss>`;

	return new Response(xml.trim(), {
		headers: {
			'Content-Type': 'application/xml',
			'Cache-Control': 'max-age=0, s-maxage=3600',
		},
	});
}
