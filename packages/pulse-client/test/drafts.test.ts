import { describe, expect, it } from 'vitest';
import {
	createPulseClientDraft,
	draftPreviewToOutboxItem,
	evaluatePulseClientDraft,
	parseClientTags,
	queuePulseClientOutboxItem,
	queuePulseClientOutboxItemForRetry,
	summarizeClientDraftReadiness,
	submitPulseClientDraftToBroker,
	type PulseClientBirdDraft,
	type PulseClientNoteDraft,
} from '../src/drafts';
import { createPulseClientIdentity } from '../src/identity';
import { createPulseClientMediaIntent } from '../src/media';
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
		expect(draft.identity).toMatchObject({
			actor: 'jess',
			deviceId: 'browser-local',
			client: 'pulse-client-scaffold',
		});
	});

	it('parses comma-separated tags', () => {
		expect(parseClientTags(' client, birds ,, pulse ')).toEqual(['client', 'birds', 'pulse']);
	});

	it('evaluates a public note draft into a broker ingest input and policy preview', () => {
		const result = evaluatePulseClientDraft(noteDraft());

		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.input.source.client).toBe('pulse-client-scaffold');
			expect(result.input.source.deviceId).toBe('browser-local');
			expect(result.input.source.idempotencyKey).toBe('pulse-client-1');
			expect(result.previewEvent.id).toBe('preview_draft_1');
			expect(result.decision.allowed).toBe(true);
		}
	});

	it('propagates explicit client identity into broker input and outbox rows', () => {
		const draft: PulseClientNoteDraft = {
			...noteDraft(),
			identity: createPulseClientIdentity({
				actor: 'demo-operator',
				displayName: 'Demo Operator',
				deviceId: 'tin-921-demo-device',
				deviceLabel: 'TIN-921 demo device',
				client: 'pulse-client-m2-demo',
				sessionId: 'tin-921-session',
			}),
		};
		const result = evaluatePulseClientDraft(draft);

		expect(result.ok).toBe(true);
		if (result.ok) {
			const item = draftPreviewToOutboxItem(draft, result);

			expect(result.input.actor).toBe('demo-operator');
			expect(result.input.source.client).toBe('pulse-client-m2-demo');
			expect(result.input.source.deviceId).toBe('tin-921-demo-device');
			expect(item.identity).toEqual({
				actor: 'demo-operator',
				displayName: 'Demo Operator',
				deviceId: 'tin-921-demo-device',
				deviceLabel: 'TIN-921 demo device',
				client: 'pulse-client-m2-demo',
				sessionId: 'tin-921-session',
			});
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

	it('blocks private media intents at policy preview time', () => {
		const result = evaluatePulseClientDraft({
			...noteDraft(),
			mediaIntents: [
				createPulseClientMediaIntent({
					id: 'media_private',
					lifecycle: 'private_object_staged',
					privateObjectKey: 'pulse/client/drafts/media_private/original.jpg',
				}),
			],
		});

		expect(result.ok).toBe(true);
		if (result.ok) {
			const item = draftPreviewToOutboxItem(
				{
					...noteDraft(),
					mediaIntents: [
						createPulseClientMediaIntent({
							id: 'media_private',
							lifecycle: 'private_object_staged',
							privateObjectKey: 'pulse/client/drafts/media_private/original.jpg',
						}),
					],
				},
				result,
			);

			expect(result.input.media[0]?.privateObjectKey).toBe('pulse/client/drafts/media_private/original.jpg');
			expect(result.decision.allowed).toBe(false);
			expect(result.decision.allowed ? '' : result.decision.reason).toBe('private_object_key_present');
			expect(item.mediaIntents?.[0]?.lifecycle).toBe('private_object_staged');
		}
	});

	it('allows public-ready media derivatives through policy preview', () => {
		const result = evaluatePulseClientDraft({
			...noteDraft(),
			mediaIntents: [
				createPulseClientMediaIntent({
					id: 'media_public',
					lifecycle: 'public_projection_ready',
					publicUrl: 'https://example.test/pulse/media/media_public.jpg',
					privateObjectKey: 'pulse/client/private/media_public.jpg',
				}),
			],
		});

		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.input.media[0]).toMatchObject({
				id: 'media_public',
				privateObjectKey: '',
				publicUrl: 'https://example.test/pulse/media/media_public.jpg',
			});
			expect(result.decision.allowed).toBe(true);
		}
	});

	it('surfaces unsupported media intent before broker preview', () => {
		const result = evaluatePulseClientDraft({
			...noteDraft(),
			mediaIntents: [
				createPulseClientMediaIntent({
					lifecycle: 'unsupported',
					mimeType: 'audio/wav',
				}),
			],
		});

		expect(result).toEqual({
			ok: false,
			errors: ['media type unsupported for public projection'],
		});
	});

	it('summarizes missing client fields before compose', () => {
		const errors = summarizeClientDraftReadiness({
			...noteDraft(),
			identity: createPulseClientIdentity({
				actor: '',
				deviceId: '',
				client: '',
				sessionId: '',
			}),
			text: '   ',
			idempotencyKey: '',
			mediaIntents: [
				createPulseClientMediaIntent({
					altText: '',
				}),
			],
		});

		expect(errors).toContain('actor identity missing');
		expect(errors).toContain('device id missing');
		expect(errors).toContain('client id missing');
		expect(errors).toContain('session id missing');
		expect(errors).toContain('write a note');
		expect(errors).toContain('idempotency key missing');
		expect(errors).toContain('media alt text missing');
	});

	it('maps preview decisions into outbox rows', () => {
		const draft = noteDraft();
		const result = evaluatePulseClientDraft(draft);
		const item = draftPreviewToOutboxItem(draft, result);

		expect(item.state).toBe('draft_ready');
		expect(item.idempotencyKey).toBe('pulse-client-1');
		expect(item.eventId).toBe('preview_draft_1');
		expect(item.identity?.deviceId).toBe('browser-local');
	});

	it('marks local preview rows as queued without changing idempotency ownership', () => {
		const draft = noteDraft();
		const result = evaluatePulseClientDraft(draft);
		const item = queuePulseClientOutboxItem(draftPreviewToOutboxItem(draft, result));

		expect(item.state).toBe('local_queued');
		expect(item.id).toBe('draft_1_preview_queued');
		expect(item.idempotencyKey).toBe('pulse-client-1');
	});

	it('submits an allowed note through broker and AP demo publication', () => {
		const result = submitPulseClientDraftToBroker(makeBroker(), noteDraft(), publicationOptions);

		expect(result.errors).toEqual([]);
		expect(result.outboxItem.state).toBe('ap_published');
		expect(result.outboxItem.eventId).toBe('evt_1');
		expect(result.outboxItem.activityId).toBe('https://example.test/pulse/ap-demo/activities/evt_1/create');
		expect(result.outboxItem.identity?.sessionId).toBe('local-session-1');
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

	it('models retry rows deterministically from accepted broker outcomes', () => {
		const submitted = submitPulseClientDraftToBroker(makeBroker(), noteDraft(), publicationOptions);
		const retry = queuePulseClientOutboxItemForRetry(submitted.outboxItem);

		expect(retry.state).toBe('retry_pending');
		expect(retry.id).toBe(`${submitted.outboxItem.id}_retry`);
		expect(retry.idempotencyKey).toBe(submitted.outboxItem.idempotencyKey);
		expect(retry.detail).toContain('retry queued from ap_published');
	});
});
