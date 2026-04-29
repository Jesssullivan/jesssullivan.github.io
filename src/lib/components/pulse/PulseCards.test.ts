import { describe, expect, it } from 'vitest';
import { render } from 'svelte/server';
import type { PolicyDecision } from '@blog/pulse-core/policy';
import type { PublicPulseItem, PulseEvent } from '@blog/pulse-core/schema';
import PulseBirdCard from './PulseBirdCard.svelte';
import PulseLabDecisionRow from './PulseLabDecisionRow.svelte';
import PulseNoteCard from './PulseNoteCard.svelte';

const occurredAt = '2026-04-27T18:00:00.000Z';

const noteItem: PublicPulseItem = {
	id: 'note_1',
	kind: 'note',
	occurredAt,
	summary: 'hello from pulse',
	content: 'hello from pulse\nwith a second line',
	tags: ['lab', 'pulse'],
};

const birdItem: PublicPulseItem = {
	id: 'bird_1',
	kind: 'bird_sighting',
	occurredAt,
	summary: '2x Northern Cardinal',
	content: '',
	tags: ['birds'],
	birdSighting: {
		commonName: 'Northern Cardinal',
		scientificName: 'Cardinalis cardinalis',
		count: 2,
		placeLabel: 'Cayuga Lake basin',
	},
};

const noteEvent: PulseEvent = {
	id: 'lab_1',
	actor: 'jess',
	occurredAt,
	visibility: 'VISIBILITY_PUBLIC',
	source: {
		client: 'pulse-lab',
		deviceId: 'browser',
		idempotencyKey: 'idem_1',
	},
	tags: ['lab'],
	media: [],
	revision: 1,
	payload: {
		kind: 'note',
		text: 'hello from pulse',
	},
};

describe('Pulse cards', () => {
	it('renders public note content and tags', () => {
		const { html } = render(PulseNoteCard, { props: { item: noteItem } });

		expect(html).toContain('note');
		expect(html).toContain('hello from pulse');
		expect(html).toContain('with a second line');
		expect(html).toContain('#lab');
		expect(html).toContain('#pulse');
		expect(html).toContain(`datetime="${occurredAt}"`);
	});

	it('renders bird sighting name, count, place, and tags', () => {
		const { html } = render(PulseBirdCard, { props: { item: birdItem } });

		expect(html).toContain('bird sighting');
		expect(html).toContain('2');
		expect(html).toContain('Northern Cardinal');
		expect(html).toContain('Cardinalis cardinalis');
		expect(html).toContain('Cayuga Lake basin');
		expect(html).toContain('#birds');
	});
});

describe('Pulse lab policy result rendering', () => {
	it('renders allowed projection decisions', () => {
		const decision: PolicyDecision = { allowed: true, item: noteItem };
		const { html } = render(PulseLabDecisionRow, {
			props: { event: noteEvent, decision },
		});

		expect(html).toContain('lab_1');
		expect(html).toContain('public_projected');
		expect(html).toContain('note');
		expect(html).toContain('VISIBILITY_PUBLIC');
	});

	it('renders denied decisions with reason and detail', () => {
		const decision: PolicyDecision = {
			allowed: false,
			reason: 'visibility_not_public',
			detail: 'visibility=VISIBILITY_PRIVATE',
		};
		const event: PulseEvent = {
			...noteEvent,
			id: 'lab_2',
			visibility: 'VISIBILITY_PRIVATE',
		};
		const { html } = render(PulseLabDecisionRow, {
			props: { event, decision },
		});

		expect(html).toContain('lab_2');
		expect(html).toContain('denied: visibility_not_public');
		expect(html).toContain('visibility=VISIBILITY_PRIVATE');
	});
});
