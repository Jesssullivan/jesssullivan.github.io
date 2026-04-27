import { describe, it, expect } from 'vitest';
import { composeEvent, summarizeReadiness, type LabComposeForm } from './compose';

const ctx = (start = 0) => {
	let n = start;
	return { idGenerator: { next: (prefix: string) => `${prefix}_${++n}` } };
};

const baseNoteForm = (): LabComposeForm => ({
	payload: { kind: 'note', text: 'hello world' },
	visibility: 'VISIBILITY_PUBLIC',
	occurredAt: '2026-04-27T18:00:00.000Z',
	tags: ['lab'],
	idempotencyKey: 'idem_lab_1',
});

const baseBirdForm = (): LabComposeForm => ({
	payload: {
		kind: 'bird_sighting',
		commonName: 'Northern Cardinal',
		scientificName: 'Cardinalis cardinalis',
		count: 2,
		placeLabel: 'Cayuga Lake basin',
		placePrecision: 'LOCATION_PRECISION_REGION',
		latitude: 42.45,
		longitude: -76.5,
		observationId: 'obs_lab_1',
	},
	visibility: 'VISIBILITY_PUBLIC',
	occurredAt: '2026-04-27T07:00:00.000Z',
	tags: ['birds'],
	idempotencyKey: 'idem_lab_bird_1',
});

describe('lab/compose', () => {
	it('builds a valid note event', () => {
		const result = composeEvent(baseNoteForm(), ctx());
		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.event.payload.kind).toBe('note');
			expect(result.event.id).toMatch(/^lab_\d+$/);
		}
	});

	it('builds a valid bird sighting event with place', () => {
		const result = composeEvent(baseBirdForm(), ctx());
		expect(result.ok).toBe(true);
		if (result.ok && result.event.payload.kind === 'bird_sighting') {
			expect(result.event.payload.place?.precision).toBe('LOCATION_PRECISION_REGION');
		}
	});

	it('rejects an empty note before invoking the schema', () => {
		const form: LabComposeForm = {
			...baseNoteForm(),
			payload: { kind: 'note', text: '   ' },
		};
		const result = composeEvent(form, ctx());
		expect(result.ok).toBe(false);
	});

	it('omits place when label is empty even if lat/long are provided', () => {
		const form: LabComposeForm = {
			...baseBirdForm(),
			payload: {
				...(baseBirdForm().payload as Extract<LabComposeForm['payload'], { kind: 'bird_sighting' }>),
				placeLabel: '   ',
			},
		};
		const result = composeEvent(form, ctx());
		expect(result.ok).toBe(true);
		if (result.ok && result.event.payload.kind === 'bird_sighting') {
			expect(result.event.payload.place).toBeUndefined();
		}
	});

	it('rejects an unspecified visibility through the schema', () => {
		const form: LabComposeForm = {
			...baseNoteForm(),
			visibility: 'VISIBILITY_UNSPECIFIED',
		};
		const result = composeEvent(form, ctx());
		expect(result.ok).toBe(false);
	});

	it('summarizes readiness errors when bird has neither name', () => {
		const form: LabComposeForm = {
			...baseBirdForm(),
			payload: {
				...(baseBirdForm().payload as Extract<LabComposeForm['payload'], { kind: 'bird_sighting' }>),
				commonName: '',
				scientificName: '',
			},
		};
		const errors = summarizeReadiness(form);
		expect(errors).toContain('add a common or scientific name');
	});

	it('readiness is empty for a complete note form', () => {
		expect(summarizeReadiness(baseNoteForm())).toEqual([]);
	});
});
