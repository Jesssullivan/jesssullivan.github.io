import { describe, expect, it } from 'vitest';
import {
	createPulseClientDraft,
	draftPreviewToOutboxItem,
	evaluatePulseClientDraft,
	parseClientTags,
	summarizeClientDraftReadiness,
	submitPulseClientDraftToBroker,
	type PulseClientBirdDraft,
	type PulseClientNoteDraft,
} from './drafts';
import { createBroker, seededIdGenerator, tickingClock } from '@blog/pulse-core/broker';

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

const makeBroker = () =>
	createBroker({
		clock: tickingClock(nowIso, 1000),
		idGenerator: seededIdGenerator(0),
	});

const publicationOptions = {
	sourceSnapshotId: 'pulse-client-test',
	baseUrl: 'https://example.test/pulse/ap-demo',
	actorId: 'https://example.test/pulse/actors/jess',
} as const;

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

	it('submits an allowed note through broker and AP demo publication', () => {
		const result = submitPulseClientDraftToBroker(makeBroker(), noteDraft(), publicationOptions);

		expect(result.errors).toEqual([]);
		expect(result.outboxItem.state).toBe('ap_published');
		expect(result.outboxItem.eventId).toBe('evt_1');
		expect(result.outboxItem.activityId).toBe('https://example.test/pulse/ap-demo/activities/evt_1/create');
		expect(result.publication.outbox.totalItems).toBe(1);
		expect(result.publication.queue.map((item) => item.state)).toEqual(['published']);
	});

	it('keeps policy-denied client submissions blocked in the AP demo queue', () => {
		const result = submitPulseClientDraftToBroker(
			makeBroker(),
			{
				...birdDraft(),
				placePrecision: 'LOCATION_PRECISION_EXACT',
			},
			publicationOptions,
		);

		expect(result.errors).toEqual([]);
		expect(result.outboxItem.state).toBe('ap_blocked');
		expect(result.outboxItem.eventId).toBe('evt_1');
		expect(result.outboxItem.detail).toContain('AP demo blocked');
		expect(result.publication.outbox.totalItems).toBe(0);
		expect(result.publication.queue.map((item) => item.state)).toEqual(['blocked']);
		expect(result.publication.denied[0]?.reason).toBe('exact_location_not_allowlisted');
	});

	it('surfaces duplicate idempotency keys without creating a second event', () => {
		const broker = makeBroker();
		const first = submitPulseClientDraftToBroker(broker, noteDraft(), publicationOptions);
		const duplicate = submitPulseClientDraftToBroker(
			broker,
			{
				...noteDraft(),
				id: 'draft_1_retry',
				text: 'changed local text should not create a second broker event',
			},
			publicationOptions,
		);

		expect(first.outboxItem.state).toBe('ap_published');
		expect(duplicate.outboxItem.state).toBe('broker_duplicate');
		expect(duplicate.outboxItem.eventId).toBe(first.outboxItem.eventId);
		expect(duplicate.publication.outbox.totalItems).toBe(1);
		expect(broker.allEvents()).toHaveLength(1);
	});
});
