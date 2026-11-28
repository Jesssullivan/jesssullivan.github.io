import { describe, expect, it } from 'vitest';
import { NoteHtmlError, feedHtml, mediaElements, pageHtml, type MediaBlock } from './note-html';

// These tests cover the reader's own rules: what it refuses and how it fails.
// Their strings are written by hand in the shape the hub's renderer writes.
// They are not hub output. The hub's own fixtures go through the same
// functions in notes.projection.test.ts.

const ORIGIN = 'https://transscendsurvival.org';
const PAGE = `${ORIGIN}/notes/a`;

const clip: MediaBlock = { type: 'clip', video: { path: '/notes/a/loop.mp4' }, alt: 'Water moves', caption: null };
const CLIP_HTML =
	'<figure class="embed-clip"><video class="clip-video" data-clip muted loop playsinline preload="metadata" aria-label="Water moves">' +
	'<source src="/notes/a/loop.mp4" type="video/mp4" /></video>' +
	'<button type="button" class="clip-toggle" data-clip-toggle hidden="hidden">Play the clip</button></figure>';

describe('a body whose HTML and blocks disagree', () => {
	it('fails when the HTML holds a clip the blocks do not', () => {
		expect(() => pageHtml(CLIP_HTML, [])).toThrow(NoteHtmlError);
		expect(() => feedHtml(CLIP_HTML, [], ORIGIN, PAGE)).toThrow(/more clips than its blocks/);
	});

	it('fails when the blocks hold a clip the HTML does not', () => {
		expect(() => pageHtml('<p>Words.</p>', [clip])).toThrow(/1 clips and the HTML holds 0/);
		expect(() => feedHtml('<p>Words.</p>', [clip], ORIGIN, PAGE)).toThrow(NoteHtmlError);
	});

	it.each([
		[
			'recording',
			{ type: 'recording', audio: { path: '/notes/a/sound.mp3' }, title: 'A sound', description: null } as MediaBlock,
			'<figure class="embed-recording"><audio controls preload="metadata"><source src="/notes/a/sound.mp3" type="audio/mpeg" /></audio></figure>',
			/recordings/,
		],
		[
			'video file',
			{ type: 'video', video: { path: '/notes/a/film.mp4' }, host: 'file', title: 'A film' } as MediaBlock,
			'<figure class="embed-video"><video controls preload="metadata"><source src="/notes/a/film.mp4" type="video/mp4" /></video></figure>',
			/video files/,
		],
	])('counts each %s on the page as the feed does', (_name, block, html, what) => {
		expect(() => pageHtml(html, [block])).not.toThrow();
		expect(() => pageHtml('<p>Words.</p>', [block])).toThrow(what);
		expect(() => pageHtml(html, [])).toThrow(what);
		expect(() => feedHtml('<p>Words.</p>', [block], ORIGIN, PAGE)).toThrow(what);
	});

	it('does not count a clip whose attachment is missing, since the hub renders a notice for it', () => {
		const missing: MediaBlock = { type: 'clip', video: null, alt: 'Water moves', caption: null };
		const notice = '<p class="embed-missing" data-embed="clip">Missing attachment <code>loop</code></p>';
		expect(pageHtml(notice, [missing])).toBe(notice);
		expect(feedHtml(notice, [missing], ORIGIN, PAGE)).toBe(notice);
	});
});

describe('HTML that is not the hub serializer output', () => {
	it.each([
		['an unquoted attribute value', '<p class=x>Words.</p>'],
		['a tag the input ends inside', '<p>Words.</p><img src="/notes/a/x.png"'],
		['a comment', '<p>Words.</p><!-- note -->'],
		['a bare less-than sign', '<p>1 < 2</p>'],
		['an element that never closes', '<figure class="embed-clip"><video data-clip aria-label="x"></video>'],
	])('fails on %s', (_name, html) => {
		expect(() => feedHtml(html, [clip], ORIGIN, PAGE)).toThrow(NoteHtmlError);
	});
});

describe('a diagram with no picture yet', () => {
	// The contract fixtures hold no such diagram. The hub renders it as its
	// source in a code block, and this string follows that renderer.
	const pending: MediaBlock = { type: 'diagram', picture: null, alt: 'A draft goes to review', description: 'Draft, then review.' };
	const html = '<figure class="embed-diagram embed-pending"><pre><code>flowchart LR\n  Draft --&gt; Review</code></pre></figure>';

	it('is its alt text and description in a feed, never its source', () => {
		const out = feedHtml(html, [pending], ORIGIN, PAGE);
		expect(out).toBe('<p>A draft goes to review</p><p>Draft, then review.</p>');
		expect(out).not.toContain('flowchart');
	});

	it('is indexed by its alt text on the page, and its source is skipped', () => {
		expect(pageHtml(html, [pending])).toBe(
			'<figure class="embed-diagram embed-pending" aria-label="A draft goes to review" data-pagefind-index-attrs="aria-label">' +
				'<pre data-pagefind-ignore><code>flowchart LR\n  Draft --&gt; Review</code></pre></figure>',
		);
	});
});

describe('text and addresses', () => {
	it('escapes a text alternative that holds markup characters', () => {
		const block: MediaBlock = { type: 'clip', video: { path: '/notes/a/loop.mp4' }, alt: 'A <b> & "c"', caption: 'One\n\nTwo' };
		expect(feedHtml(CLIP_HTML, [block], ORIGIN, PAGE)).toBe(
			`<p><a href="${ORIGIN}/notes/a/loop.mp4">A &lt;b&gt; &amp; &quot;c&quot;</a> (silent video clip)</p><p>One</p><p>Two</p>`,
		);
	});

	it('writes site paths and fragments as full addresses and leaves other addresses alone', () => {
		const html =
			'<p><a href="#fig-a">Figure 1</a> <a href="/notes/b">b</a> <a href="https://example.org/x">x</a> <a href="//example.org/y">y</a></p>' +
			'<img src="/notes/a/x.png" alt="x" />';
		expect(feedHtml(html, [], ORIGIN, PAGE)).toBe(
			`<p><a href="${PAGE}#fig-a">Figure 1</a> <a href="${ORIGIN}/notes/b">b</a> <a href="https://example.org/x">x</a> <a href="//example.org/y">y</a></p>` +
				`<img src="${ORIGIN}/notes/a/x.png" alt="x" />`,
		);
	});

	it('leaves prose alone on the page', () => {
		const html = '<p>Plain <em>words</em> &amp; <code>code</code>.</p>\n<ul><li>One</li></ul>';
		expect(pageHtml(html, [])).toBe(html);
		expect(feedHtml(html, [], ORIGIN, PAGE)).toBe(html);
		expect(mediaElements(html)).toEqual([]);
	});
});
