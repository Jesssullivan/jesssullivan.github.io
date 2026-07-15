import { describe, expect, it } from 'vitest';
import { render } from 'svelte/server';
import type { Post } from '$lib/types';
import { POST_EDITORIAL_TIERS } from '$lib/types';
import TierBadge from './TierBadge.svelte';
import BlogCard from './BlogCard.svelte';

describe('TierBadge', () => {
	it('renders a labelled badge for the noteworthy tier', () => {
		const { html } = render(TierBadge, { props: { tier: 'noteworthy' } });

		expect(html).toContain('data-testid="tier-badge"');
		expect(html).toContain('data-tier="noteworthy"');
		expect(html).toContain('Noteworthy');
		expect(html).toContain('aria-label="Editorial tier: Noteworthy"');
	});

	it('renders a labelled badge for the less-noteworthy tier', () => {
		const { html } = render(TierBadge, { props: { tier: 'less-noteworthy' } });

		expect(html).toContain('data-testid="tier-badge"');
		expect(html).toContain('data-tier="less-noteworthy"');
		expect(html).toContain('Less noteworthy');
		expect(html).toContain('aria-label="Editorial tier: Less noteworthy"');
	});

	it('renders a badge with an aria-label for every declared tier', () => {
		for (const tier of POST_EDITORIAL_TIERS) {
			const { html } = render(TierBadge, { props: { tier } });
			expect(html).toContain('aria-label="Editorial tier:');
			expect(html).toContain(`data-tier="${tier}"`);
		}
	});

	it('renders nothing when the tier is undefined', () => {
		const { html } = render(TierBadge, { props: { tier: undefined } });

		expect(html).not.toContain('tier-badge');
		expect(html).not.toContain('aria-label');
		expect(html.replace(/<!--[\s\S]*?-->/g, '').trim()).toBe('');
	});
});

function makePost(overrides: Partial<Post> = {}): Post {
	return {
		title: 'A Test Post',
		slug: 'a-test-post',
		date: '2026-03-04',
		description: 'A description for the card.',
		tags: ['test'],
		published: true,
		...overrides,
	};
}

describe('BlogCard editorial tier surface', () => {
	it('shows the tier badge when the post carries a tier', () => {
		const { html } = render(BlogCard, {
			props: { post: makePost({ editorial_tier: 'noteworthy' }) },
		});

		expect(html).toContain('data-testid="tier-badge"');
		expect(html).toContain('aria-label="Editorial tier: Noteworthy"');
	});

	it('omits the tier badge entirely when the post has no tier', () => {
		const { html } = render(BlogCard, {
			props: { post: makePost() },
		});

		expect(html).toContain('A Test Post');
		expect(html).not.toContain('tier-badge');
	});
});
