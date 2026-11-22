import { describe, expect, it } from 'vitest';
import { render } from 'svelte/server';
import type { Post } from '$lib/posts';
import type { PublicPulseSnapshotAny } from '$lib/pulse/snapshot';
import ReaderConstellation from './ReaderConstellation.svelte';
import projection from '$lib/data/posts-projection.v1.json';

const post: Post = {
	title: 'A real post',
	slug: 'a-real-post',
	date: '2026-09-22',
	description: '',
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

describe('ReaderConstellation', () => {
	it('opens on the similarity map and offers the list as its equivalent (RM27)', () => {
		const [first, second] = projection.posts;
		const archive = [{ year: '2026', posts: [
			{ ...post, slug: first.slug, title: 'First projected post' },
			{ ...post, slug: second.slug, title: 'Second projected post' },
			{ ...post, slug: 'not-in-projection-yet', title: 'Brand new post' },
		] }];
		const { html } = render(ReaderConstellation, { props: { snapshot, archive } });
		expect(html).toContain('The constellation');
		expect(html).toContain('data-testid="posts-projection"');
		expect(html).toContain('aria-label="Similarity map of public posts"');
		expect(html).toContain(`data-slug="${first.slug}"`);
		expect(html).toContain(`href="/blog/${second.slug}"`);
		expect(html).not.toContain('data-slug="not-in-projection-yet"');
		expect(html).toContain('Placed 2 public posts.');
		expect(html).toContain('1 newer post is not on the map yet');
		expect(html).toContain('not measurements');
		expect((html.match(/tabindex="0"/g) ?? []).length).toBe(1);
		expect(html).toMatch(/aria-pressed="true"[^>]*>Map</);
		expect(html).toMatch(/aria-pressed="false"[^>]*>List</);
		expect(html).toContain('A real note');
		// The card grid, the year tree and the motion toggle were cut (RM27).
		expect(html).not.toContain('Year tree');
		expect(html).not.toContain('Pause motion');
		expect(html).not.toContain('constellation-field');
	});

	it('offers the same posts as a list with their nearest neighbours', () => {
		const [a, b] = projection.edges[0];
		const left = projection.posts[a];
		const right = projection.posts[b];
		const archive = [{ year: '2026', posts: [
			{ ...post, slug: left.slug, title: 'Left post' },
			{ ...post, slug: right.slug, title: 'Right post' },
		] }];
		const { html } = render(ReaderConstellation, { props: { snapshot, archive, initialView: 'list' } });
		expect(html).toContain('Public posts with their most similar posts');
		expect(html).toContain('Near: ');
		expect(html).toContain(`href="/blog/${right.slug}"`);
		expect(html).not.toContain('data-testid="posts-projection-detail"');
	});

	it('shows titles with quotes as text, without escape backslashes', () => {
		const [first] = projection.posts;
		const archive = [{ year: '2017', posts: [{ ...post, slug: first.slug, title: 'Gallery of "Warblers in the Hand"' }] }];
		const { html } = render(ReaderConstellation, { props: { snapshot, archive, initialView: 'list' } });
		expect(html).toMatch(/Gallery of (?:"|&quot;)Warblers in the Hand(?:"|&quot;)/);
		expect(html).not.toContain('\\');
	});

	it('says where to read when no routeable post is projected', () => {
		const { html } = render(ReaderConstellation, { props: { snapshot } });
		expect(html).not.toContain('data-testid="posts-projection"');
		expect(html).not.toContain('aria-pressed');
		expect(html).toContain('No public post is on the map yet.');
	});
});
