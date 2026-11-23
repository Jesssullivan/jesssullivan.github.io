import { describe, expect, it } from 'vitest';
import { render } from 'svelte/server';
import type { Post } from '$lib/posts';
import type { PublicPulseSnapshotAny } from '$lib/pulse/snapshot';
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

const snapshot: PublicPulseSnapshotAny = {
	schemaVersion: 'tinyland.pulse.v2.PublicPulseSnapshot',
	generatedAt: '2026-09-22T12:00:00.000Z',
	items: [{
		id: 'public-note',
		kind: 'note',
		occurredAt: '2026-09-22T11:00:00.000Z',
		summary: 'A real note',
		content: 'The full note lives in Pulse.',
		tags: [],
	}],
	manifest: {
		schemaVersion: 'tinyland.pulse.v2.PublicPulseSnapshot',
		generatedAt: '2026-09-22T12:00:00.000Z',
		sourceSnapshotId: 'test',
		contentHash: `sha256:${'a'.repeat(64)}`,
		itemCount: 1,
		policyVersion: 'test',
	},
};

const slugOf = (index: number) => constellation.stars[index][0] as string;
const sky = { data: constellation, field: null, tallQuery: '(max-width: 720px)', tallScale: 0.85 };

describe('ReaderConstellation', () => {
	it('opens on the map with the list one tab stop away (RM27)', () => {
		const { html } = render(ReaderConstellation, { props: { snapshot } });
		expect(html).toContain('The constellation');
		expect(html).toMatch(/role="tab"[^>]*aria-selected="true"[^>]*tabindex="0"[^>]*>Map</);
		expect(html).toMatch(/role="tab"[^>]*aria-selected="false"[^>]*tabindex="-1"[^>]*>List</);
		// The tabs are the first focusable control in the section.
		expect(html.indexOf('role="tablist"')).toBeLessThan(html.search(/<(button|a)\b/));
		expect(html).toContain('role="tabpanel"');
		// The card grid, the year tree and the motion toggle were cut (RM27).
		expect(html).not.toContain('Year tree');
		expect(html).not.toContain('Pause motion');
		expect(html).not.toContain('constellation-field');
		// Pulse items stay in the reviewed details block.
		expect(html).toContain('The full note lives in Pulse.');
	});

	it('paints the stars as a silhouette before any script or data loads', () => {
		const { html } = render(ReaderConstellation, { props: { snapshot } });
		expect(html).toContain('data-testid="constellation-silhouette-wide"');
		expect(html).toContain('data-testid="constellation-silhouette-tall"');
		// Every star once per frame, and nothing interactive yet.
		expect((html.match(/h\.01/g) ?? []).length).toBe(silhouette.count * 2);
		expect(html).not.toContain('data-star=');
		expect(html).not.toContain('<canvas');
	});

	it('keeps the copy to one line, with the how-to and the method note in the help', () => {
		const { html } = render(ReaderConstellation, { props: { snapshot } });
		expect(html).toContain('Each star is a post. Posts that share words or tags sit together.');
		expect(html).toMatch(/aria-expanded="false"[^>]*>How it works</);
		expect(html).toMatch(/id="constellation-help"[^>]*hidden/);
		expect(html).toContain('Positions come from a t-SNE fit over post text and tags. Axes, distances and density are not measurements.');
		expect((html.match(/<p class="lede/g) ?? []).length).toBe(1);
	});

	it('names every category in a legend that filters, with a label beside each colour', () => {
		const { html } = render(ReaderConstellation, { props: { snapshot } });
		for (const category of silhouette.categories) expect(html).toContain(`</span>${category.label}`);
		expect((html.match(/aria-pressed="false"/g) ?? []).length).toBe(silhouette.categories.length);
		expect(silhouette.categories.reduce((sum, category) => sum + category.count, 0)).toBe(silhouette.count);
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
		// Colour is never the only signal: the category is in each star's name.
		expect(html).toMatch(/aria-label="First placed post\. [A-Za-z]+, Sep 22, 2026"/);
		expect(html).toContain('1 newer post is not on the map yet. Latest has it.');
		// Every constellation name is a control that goes there.
		for (const group of constellation.groups) expect(html).toContain(`aria-label="Go to ${group.name}"`);
		expect(html).toContain('aria-label="Zoom in"');
		expect(html).toMatch(/>Reset</);
	});

	it('draws on two canvases, one of them the glow layer, and says where a picked post shows on a phone', () => {
		const posts = [{ ...post, slug: slugOf(0), title: 'First placed post' }];
		const { html } = render(ConstellationSky, { props: { ...sky, posts } });
		expect((html.match(/<canvas/g) ?? []).length).toBe(2);
		expect(html).toMatch(/<canvas class="glow[^"]*"/);
		expect(html).toContain('Tap a star to see its post here.');
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
