import { describe, expect, it } from 'vitest';
import {
	cdata,
	escapeXml,
	mergeNotesIntoPosts,
	noteJsonFeedItem,
	noteRssItem,
	notesFromEntries,
	placementOf,
	type ProjectionEntry,
} from './notes';

// A post that exists in src/posts today. A projection entry at its /blog path
// must never become a page here.
const EXISTING_POST_SLUG = 'from-bricked-to-recovered-the-story-of-hacking-an-nvme-ssd-back-to-life';

function entry(overrides: Partial<ProjectionEntry>): ProjectionEntry {
	return {
		id: 'first-light',
		kind: 'note',
		slug: 'first-light',
		path: '/notes/first-light',
		date: '2026-11-20',
		updated: null,
		title: 'First light',
		summary: 'A summary.',
		tags: ['hub'],
		attachments: [],
		html: '<p>Body.</p>',
		...overrides,
	};
}

describe('placementOf', () => {
	it('places an entry at /notes/<its slug> as a note', () => {
		expect(placementOf(entry({}))).toBe('note');
	});

	it('ignores every /blog path, including the path of an existing post', () => {
		expect(placementOf(entry({ slug: EXISTING_POST_SLUG, path: `/blog/${EXISTING_POST_SLUG}` }))).toBe('blog');
		expect(placementOf(entry({ slug: 'blog', path: '/blog' }))).toBe('blog');
	});

	it('ignores other paths and a /notes path that does not match the slug', () => {
		expect(placementOf(entry({ path: '/announcements/first-light' }))).toBe('other');
		expect(placementOf(entry({ path: '/notes/another-slug' }))).toBe('other');
		expect(placementOf(entry({ path: '/notes/first-light/deeper' }))).toBe('other');
	});
});

describe('notesFromEntries', () => {
	it('keeps notes only, newest first, and counts what it ignores', () => {
		const result = notesFromEntries([
			entry({ id: 'a', slug: 'a', path: '/notes/a', date: '2026-11-01' }),
			entry({ id: 'post', slug: EXISTING_POST_SLUG, path: `/blog/${EXISTING_POST_SLUG}` }),
			entry({ id: 'c', slug: 'c', path: '/notes/c', date: '2026-11-03' }),
			entry({ id: 'b', slug: 'b', path: '/notes/b', date: '2026-11-03' }),
			entry({ id: 'office', slug: 'office', path: '/announcements/office' }),
		]);
		expect(result.notes.map((note) => note.path)).toEqual(['/notes/b', '/notes/c', '/notes/a']);
		expect(result.notes[0].url).toBe('https://transscendsurvival.org/notes/b');
		expect(result.ignoredBlog).toBe(1);
		expect(result.ignoredOther).toBe(1);
	});

	it('is empty for no entries', () => {
		expect(notesFromEntries([])).toEqual({ notes: [], ignoredBlog: 0, ignoredOther: 0 });
	});
});

describe('mergeNotesIntoPosts', () => {
	const posts = [
		{ slug: 'p3', date: '2026-11-10' },
		{ slug: 'p2', date: '2026-11-05' },
		{ slug: 'p1', date: '2026-11-01' },
	];

	it('returns the posts unchanged and in order when there are no notes', () => {
		expect(mergeNotesIntoPosts(posts, [])).toEqual(posts.map((item) => ({ kind: 'post', item })));
	});

	it('places each note before the first strictly older post, posts winning a tie', () => {
		const notes = [
			{ date: '2026-11-12', path: '/notes/newest' },
			{ date: '2026-11-05', path: '/notes/tie' },
			{ date: '2026-10-01', path: '/notes/oldest' },
		];
		expect(mergeNotesIntoPosts(posts, notes).map(({ item }) => ('slug' in item ? item.slug : item.path))).toEqual([
			'/notes/newest',
			'p3',
			'p2',
			'/notes/tie',
			'p1',
			'/notes/oldest',
		]);
	});
});

describe('feed items', () => {
	const [note] = notesFromEntries([
		entry({ title: 'A ]]> title', summary: 'x & y', tags: ['a&b'], html: '<p>a ]]> b</p>', updated: '2026-11-21' }),
	]).notes;

	it('uses the canonical URL as the RSS guid and keeps CDATA closed', () => {
		const item = noteRssItem(note);
		expect(item).toContain('<guid isPermaLink="true">https://transscendsurvival.org/notes/first-light</guid>');
		expect(item).toContain('<title><![CDATA[A ]]]]><![CDATA[> title]]></title>');
		expect(item).toContain('<category>a&amp;b</category>');
		expect(item).toContain('<pubDate>Fri, 20 Nov 2026 00:00:00 GMT</pubDate>');
	});

	it('uses the canonical URL as the JSON Feed id and reads no clock', () => {
		expect(noteJsonFeedItem(note)).toEqual({
			id: 'https://transscendsurvival.org/notes/first-light',
			url: 'https://transscendsurvival.org/notes/first-light',
			title: 'A ]]> title',
			summary: 'x & y',
			content_html: '<p>a ]]> b</p>',
			date_published: '2026-11-20T00:00:00.000Z',
			date_modified: '2026-11-21T00:00:00.000Z',
			tags: ['a&b'],
		});
	});

	it('escapes XML text and splits CDATA ends', () => {
		expect(escapeXml(`<a href="x">'&'</a>`)).toBe('&lt;a href=&quot;x&quot;&gt;&apos;&amp;&apos;&lt;/a&gt;');
		expect(cdata(']]>')).toBe('<![CDATA[]]]]><![CDATA[>]]>');
	});
});
