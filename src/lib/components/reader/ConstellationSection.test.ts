import { describe, expect, it } from 'vitest';
import { render } from 'svelte/server';
import type { Post } from '$lib/types';
import { buildConstellationGroups } from '$lib/reader/ledger';
import ConstellationSection from './ConstellationSection.svelte';

function makePost(i: number, tier?: Post['editorial_tier']): Post {
	return {
		slug: `post-${i}`,
		title: `Entry number ${i}`,
		date: `2026-06-${String((i % 27) + 1).padStart(2, '0')}`,
		tags: ['hardware'],
		category: 'hardware',
		content: '',
		reading_time: 4,
		...(tier ? { editorial_tier: tier } : {}),
	} as Post;
}

describe('ConstellationSection (accessible counterpart axes)', () => {
	it('carries all three canvas axes: topic (grouping), tier (badge), time (<time datetime>)', () => {
		const groups = buildConstellationGroups([makePost(1, 'noteworthy'), makePost(2)], []);
		const { html } = render(ConstellationSection, { props: { groups } });

		expect(html).toContain('grouped by current category');
		// tier axis: the noteworthy node renders a TierBadge; untiered renders none.
		expect(html).toContain('Noteworthy');
		// time axis: machine-readable dates on the nodes.
		expect(html).toContain('<time datetime=');
		// honesty label intact.
		expect(html).toContain('Not an embedding, not t-SNE.');
	});

	it('renders nothing for an empty group set (fail-soft)', () => {
		const { html } = render(ConstellationSection, { props: { groups: [] } });
		expect(html).not.toContain('reader-constellation');
	});
});
