import { describe, expect, it } from 'vitest';
import {
	createPulseClientDraft,
	draftPreviewToOutboxItem,
	evaluatePulseClientDraft,
	parseClientTags,
	summarizeClientDraftReadiness,
	type PulseClientBirdDraft,
	type PulseClientNoteDraft,
} from './drafts';

const nowIso = '2026-04-30T20:00:00.000Z';

const noteDraft = (): PulseClientNoteDraft => ({
	...createPulseClientDraft({ nowIso, sequence: 1, kind: 'note' }),
	kind: 'note',
	text: 'hello from the client scaffold',
});

const birdDraft = (): PulseClientBirdDraft => ({
	...createPulseClientDraft({ nowIso, sequence: 2, kind: 'bird_sighting' }),
	kind: 'bird_sighting',
	commonName: 'Northern Cardinal',
	scientificName: 'Cardinalis cardinalis',
	count: 2,
	placeLabel: 'Cayuga Lake basin',
	placePrecision: 'LOCATION_PRECISION_REGION',
	observationId: 'obs-client-1',
});

describe('pulse client draft helpers', () => {
	it('creates deterministic local draft ids and idempotency keys', () => {
		const draft = createPulseClientDraft({ nowIso, sequence: 7, kind: 'note' });

		expect(draft.id).toBe('draft_7');
		expect(draft.idempotencyKey).toBe('pulse-client-7');
		expect(draft.occurredAt).toBe(nowIso);
	});

	it('parses comma-separated tags', () => {
		expect(parseClientTags(' client, birds ,, pulse ')).toEqual(['client', 'birds', 'pulse']);
	});

	it('evaluates a public note draft into a broker ingest input and policy preview', () => {
		const result = evaluatePulseClientDraft(noteDraft());

		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.input.source.client).toBe('pulse-client-scaffold');
			expect(result.input.source.idempotencyKey).toBe('pulse-client-1');
			expect(result.previewEvent.id).toBe('preview_draft_1');
			expect(result.decision.allowed).toBe(true);
		}
	});

	it('blocks exact-location bird sightings at policy preview time', () => {
		const result = evaluatePulseClientDraft({
			...birdDraft(),
			placePrecision: 'LOCATION_PRECISION_EXACT',
		});

		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.decision.allowed).toBe(false);
			expect(result.decision.allowed ? '' : result.decision.reason).toBe('exact_location_not_allowlisted');
		}
	});

	it('summarizes missing client fields before compose', () => {
		const errors = summarizeClientDraftReadiness({
			...noteDraft(),
			text: '   ',
			idempotencyKey: '',
		});

		expect(errors).toContain('write a note');
		expect(errors).toContain('idempotency key missing');
	});

	it('maps preview decisions into outbox rows', () => {
		const draft = noteDraft();
		const result = evaluatePulseClientDraft(draft);
		const item = draftPreviewToOutboxItem(draft, result);

		expect(item.state).toBe('draft_ready');
		expect(item.idempotencyKey).toBe('pulse-client-1');
		expect(item.eventId).toBe('preview_draft_1');
	});
});
