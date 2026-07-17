import { describe, expect, it } from 'vitest';
import { render } from 'svelte/server';
import type { Post } from '$lib/types';
import ObservatoryMasthead from './ObservatoryMasthead.svelte';

function makePost(i: number, tier?: Post['editorial_tier']): Post {
	return {
		slug: `post-${i}`,
		title: `Entry number ${i}`,
		date: `2026-06-${String((i % 27) + 1).padStart(2, '0')}`,
		tags: ['hardware'],
		category: 'hardware',
		content: '',
		...(tier ? { editorial_tier: tier } : {}),
	} as Post;
}

describe('ObservatoryMasthead (SSR state)', () => {
	const posts = Array.from({ length: 5 }, (_, i) => makePost(i));

	it('serves the heron identity as the SSR/no-JS state; the constellation crossfades in only at hydration', () => {
		const { html } = render(ObservatoryMasthead, { props: { posts, pulseItems: [] } });
		// State A (heron) carries .on server-side; state B does not.
		const heronLayer = html.slice(html.indexOf('mast-layer'), html.indexOf('mast-constellation'));
		expect(heronLayer).toContain('on');
		const constellationLayer = html.slice(html.indexOf('mast-constellation'));
		expect(constellationLayer.slice(0, constellationLayer.indexOf('>'))).not.toMatch(/\bon\b/);
	});

	it('renders the site identity verbatim with a single h1 and no banner role', () => {
		const { html } = render(ObservatoryMasthead, { props: { posts, pulseItems: [] } });
		expect(html.split('<h1').length - 1).toBe(1);
		expect(html).toContain('Trans Scend Survival');
		expect(html).toContain('Jess Sullivan');
		expect(html).not.toContain('role="banner"');
	});

	it('keeps the constellation decorative (aria-hidden) with the honesty caption and a non-shown tooltip', () => {
		const { html } = render(ObservatoryMasthead, { props: { posts, pulseItems: [] } });
		expect(html).toContain('aria-hidden="true"');
		expect(html).toContain('not an embedding');
		expect(html).toContain('mast-tip');
		expect(html).not.toContain('mast-tip show');
	});

	it('exposes the oscillation and pause controls with their initial labels', () => {
		const { html } = render(ObservatoryMasthead, { props: { posts, pulseItems: [] } });
		expect(html).toContain('aria-label="Show constellation"');
		expect(html).toContain('aria-label="Pause masthead oscillation"');
	});
});
