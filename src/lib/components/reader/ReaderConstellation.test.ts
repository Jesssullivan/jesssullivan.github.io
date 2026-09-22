import { describe, expect, it } from 'vitest';
import { render } from 'svelte/server';
import type { Post } from '$lib/posts';
import type { PublicPulseSnapshotAny } from '$lib/pulse/snapshot';
import ReaderConstellation from './ReaderConstellation.svelte';

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
});
