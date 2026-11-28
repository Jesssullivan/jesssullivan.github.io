import { render } from 'svelte/server';
import { describe, expect, it } from 'vitest';
import NoteBody from './components/NoteBody.svelte';
import {
	HEADER_RULE_LIMIT,
	attachmentHeaderRules,
	cdata,
	escapeXml,
	headingNotes,
	mergeNotesIntoPosts,
	noteJsonFeedItem,
	noteRssItem,
	noteSitemapUrl,
	notesFromEntries,
	parseEntry,
	placementOf,
	showsInHeading,
	type AttachmentRef,
	type ProjectionEntry,
} from './notes';
import { notesInHeading } from './server/notes';

// These tests cover the rules this site adds: placement, order, merging, the
// heading day and the headers file. Their entries are small stand-ins with a
// one-paragraph body. What the hub really sends is tested on the contract
// fixtures in notes.projection.test.ts.

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
		cover: null,
		heading: null,
		attachments: [],
		blocks: [{ type: 'prose', prose: 'Body.' }],
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

describe('parseEntry', () => {
	it('reads a v3 post file', () => {
		expect(parseEntry(entry({}), 'posts/first-light.json').slug).toBe('first-light');
	});

	it('refuses a post file an xoxd-projection/v2 build left, which has no cover, heading or blocks', () => {
		const v2: Record<string, unknown> = { ...entry({}) };
		for (const key of ['cover', 'heading', 'blocks']) delete v2[key];
		expect(() => parseEntry(v2, 'posts/first-light.json')).toThrow(/not an xoxd-projection\/v3 post file/);
	});

	it('refuses a block type this site does not know and an attachment that names no verified blob', () => {
		expect(() => parseEntry({ ...entry({}), blocks: [{ type: 'hologram' }] }, 'x')).toThrow(/v3 post file/);
		expect(() => parseEntry({ ...entry({}), attachments: [{ ...ref('/notes/first-light/a.png'), file: 'attachments/../x' }] }, 'x')).toThrow(
			/v3 post file/,
		);
	});
});

function ref(path: string, mediaType = 'image/png'): AttachmentRef {
	const sha256 = 'a'.repeat(64);
	return { id: 'a', kind: 'image', mediaType, path, file: `attachments/${sha256}`, sha256, bytes: 1, alt: '', width: null, height: null };
}

describe('the heading placement', () => {
	const [never, always, until] = notesFromEntries([
		entry({ id: 'a', slug: 'a', path: '/notes/a', date: '2026-11-03' }),
		entry({ id: 'b', slug: 'b', path: '/notes/b', date: '2026-11-02', heading: { until: null } }),
		entry({ id: 'c', slug: 'c', path: '/notes/c', date: '2026-11-01', heading: { until: '2026-12-31' } }),
	]).notes;

	it('shows a note with a last day up to and on that day, and one with none on every day', () => {
		expect(showsInHeading(never, '2026-11-27')).toBe(false);
		expect(showsInHeading(always, '2099-01-01')).toBe(true);
		expect(showsInHeading(until, '2026-12-31')).toBe(true);
		expect(showsInHeading(until, '2027-01-01')).toBe(false);
	});

	it('refuses a day that is not YYYY-MM-DD', () => {
		expect(() => showsInHeading(always, '12/31/2026')).toThrow(TypeError);
		expect(() => headingNotes([always], 'today')).toThrow(TypeError);
	});

	it('lists the notes of a day newest first, each with its last day', () => {
		expect(headingNotes([never, always, until], '2026-12-31').map((note) => [note.path, note.until])).toEqual([
			['/notes/b', null],
			['/notes/c', '2026-12-31'],
		]);
		expect(headingNotes([never, always, until], '2027-01-01').map((note) => note.path)).toEqual(['/notes/b']);
	});

	it('is empty from the loader in a build with no projection', () => {
		// The one function the home page calls. This test build holds no
		// verified projection, so the collection is empty.
		expect(notesInHeading('2026-11-27')).toEqual([]);
	});
});

describe('the cover image size', () => {
	const cover = (width: number | null, height: number | null, decorative: boolean) => ({
		image: { ...ref('/notes/a/cover.png'), width, height },
		alt: decorative ? '' : 'A field',
		decorative,
	});
	const img = (props: ReturnType<typeof cover>): string => /<img [^>]*>/.exec(render(NoteBody, { props: { cover: props, html: '' } }).body)?.[0] ?? '';

	it('puts the integer width and height the hub sends on the img', () => {
		for (const decorative of [true, false]) {
			const tag = img(cover(640, 480, decorative));
			expect(tag).toContain('width="640"');
			expect(tag).toContain('height="480"');
		}
	});

	it('writes no size when the ref has none', () => {
		const tag = img(cover(null, null, false));
		expect(tag).not.toContain('width=');
		expect(tag).not.toContain('height=');
	});
});

describe('the attachment headers file', () => {
	it('writes one rule per attachment path, sorted, with the three headers', () => {
		const text = attachmentHeaderRules([
			{ attachments: [ref('/notes/b/sound.mp3', 'audio/mpeg'), ref('/notes/a/diagram-0123456789abcdef01234567.svg', 'image/svg+xml')] },
		]);
		expect(text).toBe(
			[
				'/notes/a/diagram-0123456789abcdef01234567.svg',
				'  Content-Type: image/svg+xml',
				'  X-Content-Type-Options: nosniff',
				"  Content-Security-Policy: default-src 'none'; sandbox",
				'',
				'/notes/a/diagram-0123456789abcdef01234567.svg.br',
				'  Content-Type: application/octet-stream',
				'  X-Content-Type-Options: nosniff',
				"  Content-Security-Policy: default-src 'none'; sandbox",
				'',
				'/notes/a/diagram-0123456789abcdef01234567.svg.gz',
				'  Content-Type: application/octet-stream',
				'  X-Content-Type-Options: nosniff',
				"  Content-Security-Policy: default-src 'none'; sandbox",
				'',
				'/notes/b/sound.mp3',
				'  Content-Type: audio/mpeg',
				'  X-Content-Type-Options: nosniff',
				"  Content-Security-Policy: default-src 'none'; sandbox",
				'',
			].join('\n'),
		);
	});

	it('covers the .br and .gz copies the precompress step writes of a diagram, and only those', () => {
		const text = attachmentHeaderRules([
			{ attachments: [ref('/notes/a/diagram-0123456789abcdef01234567.svg', 'image/svg+xml'), ref('/notes/a/photo.png')] },
		]);
		const paths = text.split('\n').filter((line) => line.startsWith('/'));
		expect(paths).toEqual([
			'/notes/a/diagram-0123456789abcdef01234567.svg',
			'/notes/a/diagram-0123456789abcdef01234567.svg.br',
			'/notes/a/diagram-0123456789abcdef01234567.svg.gz',
			'/notes/a/photo.png',
		]);
		for (const block of text.split('\n\n')) {
			expect(block).toContain('X-Content-Type-Options: nosniff');
			expect(block).toContain("Content-Security-Policy: default-src 'none'; sandbox");
		}
	});

	it('counts the compressed copies against the rule limit', () => {
		const diagrams = Array.from({ length: Math.ceil(HEADER_RULE_LIMIT / 3) + 1 }, (_, index) =>
			ref(`/notes/a/diagram-${index}.svg`, 'image/svg+xml'),
		);
		expect(() => attachmentHeaderRules([{ attachments: diagrams }])).toThrow(/served without their headers/);
	});

	it('fails the build on a path or a value that could break the file', () => {
		for (const path of ['/notes/a/*', '/notes/a/b c.png', '/notes/:slug/x.png', '/notes/a/x.png\n/*']) {
			expect(() => attachmentHeaderRules([{ attachments: [ref(path)] }])).toThrow(/cannot be a header rule/);
		}
		expect(() => attachmentHeaderRules([{ attachments: [ref('/notes/a/x.png', 'image/png\nX-Evil: 1')] }])).toThrow(/header value/);
	});

	it('fails the build when there are more attachments than the host reads rules', () => {
		const many = Array.from({ length: HEADER_RULE_LIMIT + 1 }, (_, index) => ref(`/notes/a/photo-${index}.png`));
		expect(() => attachmentHeaderRules([{ attachments: many.slice(0, HEADER_RULE_LIMIT) }])).not.toThrow();
		expect(() => attachmentHeaderRules([{ attachments: many }])).toThrow(/served without their headers/);
	});
});

describe('the sitemap entry', () => {
	it('holds the address and the day, and nothing of the body', () => {
		const [note] = notesFromEntries([entry({ updated: '2026-11-21' })]).notes;
		expect(noteSitemapUrl(note)).toBe(`<url>
    <loc>https://transscendsurvival.org/notes/first-light</loc>
    <lastmod>2026-11-21</lastmod>
    <changefreq>yearly</changefreq>
    <priority>0.6</priority>
  </url>`);
	});
});
