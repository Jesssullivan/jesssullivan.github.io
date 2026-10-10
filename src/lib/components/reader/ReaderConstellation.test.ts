import { describe, expect, it } from 'vitest';
import { render } from 'svelte/server';
import type { Post } from '#lib/posts.js';
import type { PublicPulseSnapshotAny } from '#lib/pulse/snapshot.js';
import ReaderConstellation from './ReaderConstellation.svelte';
import projection from '#lib/data/posts-projection.v1.json';

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
	it('renders real projected links and readable text before JavaScript', () => {
		const { html } = render(ReaderConstellation, { props: { posts: [post], snapshot } });
		expect(html).toContain('href="/blog/a-real-post"');
		expect(html).toContain('A real post');
		expect(html).toContain('A real note');
		expect(html).toContain('href="/pulse"');
		expect(html).toContain('Browse as a list');
		expect(html).toContain('Pause motion');
	});

	it('does not invent a note when the reviewed snapshot is empty', () => {
		const { html } = render(ReaderConstellation, {
			props: { posts: [post], snapshot: { ...snapshot, items: [], manifest: { ...snapshot.manifest, itemCount: 0 } } },
		});
		expect(html).not.toContain('A real note');
		expect(html).toContain('A real post');
	});

	it('renders the similarity map from the build-time projection, routeable posts only', () => {
		const [first, second] = projection.posts;
		const archive = [{ year: '2026', posts: [
			{ ...post, slug: first.slug, title: 'First projected post' },
			{ ...post, slug: second.slug, title: 'Second projected post' },
			{ ...post, slug: 'not-in-projection-yet', title: 'Brand new post' },
		] }];
		const { html } = render(ReaderConstellation, { props: { posts: [post], snapshot, archive, initialView: 'map' } });
		expect(html).toContain('data-testid="posts-projection"');
		expect(html).toContain(`data-slug="${first.slug}"`);
		expect(html).toContain(`href="/blog/${second.slug}"`);
		expect(html).not.toContain('data-slug="not-in-projection-yet"');
		expect(html).toContain('Placed 2 public posts.');
		expect(html).toContain('1 newer post is not on the map yet');
		expect(html).toContain('not measurements');
		expect((html.match(/tabindex="0"/g) ?? []).length).toBe(1);
		expect(html).toContain('Similarity map');
		expect(html).toContain('Similar posts');
	});

	it('offers the same posts as a list with their nearest neighbours', () => {
		const [a, b] = projection.edges[0];
		const left = projection.posts[a];
		const right = projection.posts[b];
		const archive = [{ year: '2026', posts: [
			{ ...post, slug: left.slug, title: 'Left post' },
			{ ...post, slug: right.slug, title: 'Right post' },
		] }];
		const { html } = render(ReaderConstellation, { props: { posts: [post], snapshot, archive, initialView: 'similar' } });
		expect(html).toContain('Public posts with their most similar posts');
		expect(html).toContain('Near: ');
		expect(html).toContain(`href="/blog/${right.slug}"`);
	});

	it('hides the map controls when no routeable post is projected', () => {
		const { html } = render(ReaderConstellation, { props: { posts: [post], snapshot } });
		expect(html).not.toContain('Similarity map');
		expect(html).not.toContain('data-testid="posts-projection"');
	});
});
