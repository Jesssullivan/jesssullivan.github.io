import { describe, expect, it } from 'vitest';
import { render } from 'svelte/server';
import type { Post } from '$lib/posts';
import ReaderConstellation from './ReaderConstellation.svelte';
import ConstellationSky from './ConstellationSky.svelte';
import constellation from '$lib/data/constellation.v1.json';
import silhouette from '$lib/data/constellation-silhouette.v1.json';

const post: Post = {
	title: 'A real post',
	slug: 'a-real-post',
	date: '2026-09-22',
	description: 'One line about it.',
	tags: [],
	published: true,
};

const slugOf = (index: number) => constellation.stars[index][0] as string;
const sky = { data: constellation, field: null, tallQuery: '(max-width: 880px)' };
/** The page as a reader sees it: tags, hidden attributes and comments out, with what only a screen reader gets left out. */
const visible = (html: string) =>
	html
		.replace(/<!--[\s\S]*?-->/g, '')
		.replace(/<h2[^>]*class="sr-only[^>]*>[\s\S]*?<\/h2>/g, '')
		.replace(/<div class="pop[^>]*hidden[\s\S]*?<\/div>/g, '')
		.replace(/<svg[\s\S]*?<\/svg>/g, '')
		.replace(/<[^>]+>/g, ' ')
		.replace(/\s+/g, ' ')
		.trim();

describe('ReaderConstellation', () => {
	it('prints nothing above the sky and explains nothing a reader can see', () => {
		const { html } = render(ReaderConstellation, { props: {} });
		// The landmark keeps its name for a screen reader, and nothing is printed for it.
		expect(html).toMatch(/<section[^>]*aria-labelledby="constellation-heading"/);
		expect(html).toMatch(/<h2 id="constellation-heading" class="sr-only">The constellation<\/h2>/);
		// What a reader sees printed before the map loads: the eight category words. No heading, no sentence, no counts, no button words.
		expect(visible(html)).toBe(silhouette.categories.map((category) => category.label).join(' '));
		// The card grid, the year tree, the motion toggle and the Pulse block are gone (RM27, round five).
		for (const cut of ['Year tree', 'Pause motion', 'constellation-field', 'role="tab"', 'Reviewed public Pulse', '<details']) expect(html).not.toContain(cut);
	});

	it('paints the stars as a silhouette before any script or data loads', () => {
		const { html } = render(ReaderConstellation, { props: {} });
		expect(html).toContain('data-testid="constellation-silhouette-wide"');
		expect(html).toContain('data-testid="constellation-silhouette-tall"');
		// Every star once per frame, and nothing interactive yet.
		expect((html.match(/M\d+ \d+h\.01/g) ?? []).length).toBe(silhouette.count * 2);
		expect(html).not.toContain('data-star=');
		expect(html).not.toContain('<canvas');
	});

	it('offers five icon controls, each with a name, and the list first in the tab order (RM27)', () => {
		const { html } = render(ReaderConstellation, { props: {} });
		const controls = html.slice(html.lastIndexOf('<', html.indexOf('class="controls')), html.lastIndexOf('<', html.indexOf('class="pop')));
		expect([...controls.matchAll(/<button[^>]*aria-label="([^"]+)"/g)].map((match) => match[1])).toEqual(['Show as a list', 'Zoom in', 'Zoom out', 'Reset', 'How it works']);
		// One tab stop for the group, on the list control, which is the first focusable thing in the section.
		expect([...controls.matchAll(/<button[^>]*tabindex="(-?\d)"/g)].map((match) => match[1])).toEqual(['0', '-1', '-1', '-1', '-1']);
		expect(html.search(/<(button|a)\b/)).toBe(html.indexOf('<button', html.indexOf('class="controls')));
		// Until the map is live the zoom controls say they cannot act, and stay focusable.
		expect((controls.match(/aria-disabled="true"/g) ?? []).length).toBe(3);
		expect(controls).not.toMatch(/\sdisabled(=|\s|>)/);
		// No control prints a word: every one is a drawn icon.
		expect(visible(controls)).toBe('');
		expect((controls.match(/<svg/g) ?? []).length).toBe(5);
	});

	it('keeps the how-to and the method note in the help, closed', () => {
		const { html } = render(ReaderConstellation, { props: {} });
		expect(html).toMatch(/aria-label="How it works"[^>]*aria-expanded="false"[^>]*aria-controls="constellation-help"/);
		expect(html).toMatch(/id="constellation-help"[^>]*hidden/);
		expect(html).toContain('Each star is a post. Posts that share words or tags sit together.');
		expect(html).toContain('Positions come from a t-SNE fit over post text and tags. Axes, distances and density are not measurements.');
	});

	it('names every category in a legend that filters: a dot and one word, with the count kept for a screen reader', () => {
		const { html } = render(ReaderConstellation, { props: {} });
		for (const category of silhouette.categories) {
			expect(html).toContain(`</span>${category.label}`);
			expect(html).toMatch(new RegExp(`aria-label="${category.label}, ${category.count} posts?"[^>]*data-tip="${category.count} posts?"`));
		}
		expect((html.match(/aria-pressed="false"/g) ?? []).length).toBe(silhouette.categories.length);
		expect(silhouette.categories.reduce((sum, category) => sum + category.count, 0)).toBe(silhouette.count);
		// The names on the sky are the same words: one system (round five).
		const named = constellation.groups.map((group) => group.name).filter(Boolean);
		expect(new Set(named).size).toBe(named.length);
		for (const name of named) expect(silhouette.categories.map((category) => category.label)).toContain(name);
	});
});

describe('ConstellationSky', () => {
	it('gives every routeable placed post one link, with one tab stop for the map', () => {
		const posts = [
			{ ...post, slug: slugOf(0), title: 'First placed post' },
			{ ...post, slug: slugOf(1), title: 'Second placed post' },
			{ ...post, slug: 'not-on-the-map-yet', title: 'Brand new post' },
		];
		const { html } = render(ConstellationSky, { props: { ...sky, posts } });
		expect(html).toContain('aria-label="Map of posts"');
		expect(html).toContain(`data-slug="${slugOf(0)}"`);
		expect(html).toContain(`href="/blog/${slugOf(1)}"`);
		expect(html).not.toContain('data-slug="not-on-the-map-yet"');
		expect((html.match(/data-star=/g) ?? []).length).toBe(2);
		expect((html.match(/data-star="\d+"[^>]*tabindex="0"/g) ?? []).length).toBe(1);
		// The name of a star is what its tooltip shows: the title, then the date and the category. Colour is never the only signal.
		expect(html).toMatch(/aria-label="First placed post\. Sep 22, 2026, [A-Za-z]+"/);
		expect(html).toContain('1 newer post is not on the map yet. Latest has it.');
		// Every constellation name is a control that goes there, and says how many posts it holds.
		for (const group of constellation.groups.filter((entry) => entry.name)) expect(html).toMatch(new RegExp(`aria-label="${group.name}, (\\d+ of )?\\d+ posts?"[^>]*data-tip="(\\d+ of )?\\d+ posts?"`));
		expect((html.match(/data-tip=/g) ?? []).length).toBe(constellation.groups.filter((entry) => entry.name).length);
	});

	it('draws on two canvases, one of them the glow layer, and prints no caption on the map', () => {
		const posts = [{ ...post, slug: slugOf(0), title: 'First placed post' }];
		const { html } = render(ConstellationSky, { props: { ...sky, posts } });
		expect((html.match(/<canvas/g) ?? []).length).toBe(2);
		expect(html).toMatch(/<canvas class="glow[^"]*"/);
		// Nothing is pinned or pointed at yet: no card, no tooltip, no hint and no label.
		for (const cut of ['class="card', 'role="tooltip"', 'Tap a star', 'Nearby', 'Reset']) expect(html).not.toContain(cut);
	});

	it('offers the same posts as a list with their nearest posts', () => {
		const from = constellation.near.findIndex((list) => list.length > 0);
		const to = constellation.near[from][0];
		const posts = [
			{ ...post, slug: slugOf(from), title: 'Left post' },
			{ ...post, slug: slugOf(to), title: 'Right post', date: '2020-01-01' },
		];
		const { html } = render(ConstellationSky, { props: { ...sky, posts, view: 'list' } });
		expect(html).toContain('data-testid="constellation-list"');
		expect(html.indexOf('Left post')).toBeLessThan(html.indexOf('Right post'));
		expect(html).toMatch(new RegExp(`Nearby:[^a-z]*<a href="/blog/${slugOf(to)}"[^>]*>Right post</a>`));
		expect(html).not.toContain('<canvas');
		// The filter narrows the list to one category.
		const other = (constellation.stars[from][3] as number) === 0 ? 1 : 0;
		expect(render(ConstellationSky, { props: { ...sky, posts: [posts[0]], view: 'list', filter: other } }).html).not.toContain('Left post');
	});

	it('shows titles with quotes as text, without escape backslashes', () => {
		const posts = [{ ...post, slug: slugOf(0), title: 'Gallery of "Warblers in the Hand"' }];
		const { html } = render(ConstellationSky, { props: { ...sky, posts, view: 'list' } });
		expect(html).toMatch(/Gallery of (?:"|&quot;)Warblers in the Hand(?:"|&quot;)/);
		expect(html).not.toContain('\\');
	});

	it('says where to read when no routeable post is on the map', () => {
		const { html } = render(ConstellationSky, { props: { ...sky, posts: [] } });
		expect(html).not.toContain('data-star=');
		expect(html).toContain('No public post is on the map yet.');
	});
});
