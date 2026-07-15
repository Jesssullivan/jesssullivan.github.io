import { describe, expect, it } from 'vitest';
import { render } from 'svelte/server';
import type { PublicPulseItem } from '@blog/pulse-core/schema';
import PulseRail from './PulseRail.svelte';

function makeNote(i: number): PublicPulseItem {
	return {
		id: `note_${i}`,
		kind: 'note',
		occurredAt: `2026-05-${String((i % 27) + 1).padStart(2, '0')}T12:00:00.000Z`,
		summary: `summary ${i}`,
		content: `pulse-content-${i}`,
		tags: [],
	};
}

describe('PulseRail', () => {
	it('renders every snapshot item — no silent cap (N in -> N out)', () => {
		const items = Array.from({ length: 12 }, (_, i) => makeNote(i));
		const { html } = render(PulseRail, { props: { items } });

		for (const item of items) {
			expect(html).toContain(item.content);
		}
		// 12 note cards each carry the "💬 note" kind marker.
		const cardCount = html.split('💬 note').length - 1;
		expect(cardCount).toBe(12);
		expect(html).toContain('12 of 12 rendered');
	});

	it('preserves producer order (never re-ranked)', () => {
		const items = [makeNote(0), makeNote(1), makeNote(2)];
		const { html } = render(PulseRail, { props: { items } });
		const first = html.indexOf('pulse-content-0');
		const second = html.indexOf('pulse-content-1');
		const third = html.indexOf('pulse-content-2');
		expect(first).toBeGreaterThan(-1);
		expect(first).toBeLessThan(second);
		expect(second).toBeLessThan(third);
	});

	it('degrades to a calm note when the snapshot is empty', () => {
		const { html } = render(PulseRail, { props: { items: [] } });
		expect(html).toContain('No live items right now.');
		expect(html).not.toContain('💬 note');
	});
});
