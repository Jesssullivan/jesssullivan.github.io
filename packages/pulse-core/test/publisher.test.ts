import { describe, expect, it } from 'vitest';
import {
	ACTIVITYPUB_DEMO_SCHEMA_VERSION,
	createBroker,
	publishPublicPulseItemsToActivityPubDemo,
	seededIdGenerator,
	tickingClock,
	type IngestInput,
	type PulseEvent,
	type PublicPulseItem,
} from '../src/index.js';
import { FIXTURE_BIRDS, FIXTURE_DISALLOWED, FIXTURE_NOTES } from '../src/fixtures/index.js';

const stripBrokerOwned = (event: PulseEvent): IngestInput => ({
	actor: event.actor,
	occurredAt: event.occurredAt,
	visibility: event.visibility,
	source: event.source,
	tags: event.tags,
	media: event.media,
	payload: event.payload,
});

const makeBroker = () =>
	createBroker({
		clock: tickingClock('2026-04-27T17:00:00.000Z', 1000),
		idGenerator: seededIdGenerator(0),
	});

const ingestAll = (broker: ReturnType<typeof makeBroker>, events: readonly PulseEvent[]) => {
	for (const event of events) broker.ingest(stripBrokerOwned(event));
};

describe('publisher/activitypub-demo', () => {
	it('projects public Pulse items into an ActivityStreams outbox', () => {
		const broker = makeBroker();
		ingestAll(broker, [FIXTURE_NOTES[0]!, FIXTURE_BIRDS[0]!]);
		const result = broker.deriveActivityPubDemo({
			sourceSnapshotId: 'demo-snapshot',
			baseUrl: 'https://example.test/pulse/ap-demo',
			actorId: 'https://example.test/pulse/actors/jess',
		});
		expect(result.schemaVersion).toBe(ACTIVITYPUB_DEMO_SCHEMA_VERSION);
		expect(result.outbox.type).toBe('OrderedCollection');
		expect(result.outbox.totalItems).toBe(2);
		expect(result.queue.map((item) => item.state)).toEqual(['published', 'published']);
		expect(result.outbox.orderedItems.every((activity) => activity.type === 'Create')).toBe(true);
		expect(result.outbox.orderedItems.every((activity) => activity.actor === result.actor.id)).toBe(true);
	});

	it('carries note content into AP-shaped Note objects', () => {
		const broker = makeBroker();
		ingestAll(broker, [FIXTURE_NOTES[0]!]);
		const result = broker.deriveActivityPubDemo({ sourceSnapshotId: 'demo-snapshot' });
		const activity = result.outbox.orderedItems[0]!;
		expect(activity.object.type).toBe('Note');
		expect(activity.object.content).toContain('First fixture note from the M1 lab');
		expect(activity.object.to).toContain('https://www.w3.org/ns/activitystreams#Public');
	});

	it('keeps equal-timestamp demo items in descending id order', () => {
		const occurredAt = '2026-04-30T12:00:00.000Z';
		const makeItem = (id: string): PublicPulseItem => ({
			id,
			kind: 'note',
			occurredAt,
			summary: `Summary ${id}`,
			content: `Content ${id}`,
			tags: ['demo'],
		});
		const result = publishPublicPulseItemsToActivityPubDemo({
			items: [makeItem('evt_a'), makeItem('evt_c'), makeItem('evt_b')],
			generatedAt: '2026-04-30T12:01:00.000Z',
			sourceSnapshotId: 'demo-snapshot',
		});
		expect(result.queue.map((item) => item.sourceEventId)).toEqual(['evt_c', 'evt_b', 'evt_a']);
	});

	it('keeps bird output coarse and never publishes exact coordinates', () => {
		const broker = makeBroker();
		ingestAll(broker, FIXTURE_BIRDS);
		const result = broker.deriveActivityPubDemo({ sourceSnapshotId: 'demo-snapshot' });
		const serialized = JSON.stringify(result);
		expect(serialized).toContain('Northern Cardinal');
		expect(serialized).toContain('Cayuga Lake basin');
		expect(serialized).not.toContain('42.45');
		expect(serialized).not.toContain('-76.5');
		expect(result.queue.some((item) => item.state === 'blocked')).toBe(true);
		expect(result.denied.some((denial) => denial.reason === 'exact_location_not_allowlisted')).toBe(true);
	});

	it('keeps policy-denied events in blocked queue items instead of the outbox', () => {
		const broker = makeBroker();
		const privateMediaNote: PulseEvent = {
			...FIXTURE_NOTES[0]!,
			id: 'evt_note_private_media',
			source: {
				...FIXTURE_NOTES[0]!.source,
				idempotencyKey: 'idem_note_private_media',
			},
			media: [
				{
					id: 'm-private',
					mimeType: 'image/jpeg',
					altText: 'private media',
					privateObjectKey: 's3://private-bucket/raw/private.jpg',
					publicUrl: '',
				},
			],
		};
		ingestAll(broker, [...FIXTURE_NOTES, privateMediaNote, ...FIXTURE_DISALLOWED]);
		const result = broker.deriveActivityPubDemo({ sourceSnapshotId: 'demo-snapshot' });
		const publishedIds = result.outbox.orderedItems.map((activity) => activity.object.id);
		const blocked = result.queue.filter((item) => item.state === 'blocked');
		expect(blocked.length).toBeGreaterThanOrEqual(4);
		expect(publishedIds.join('\n')).not.toContain('evt_note_003_private');
		expect(blocked.some((item) => item.reason === 'visibility_not_public')).toBe(true);
		expect(blocked.some((item) => item.reason === 'kind_not_in_m1_allowlist')).toBe(true);
		expect(blocked.some((item) => item.reason === 'private_object_key_present')).toBe(true);
	});

	it('is deterministic for the same projected snapshot and publisher options', () => {
		const a = makeBroker();
		const b = makeBroker();
		const events = [...FIXTURE_NOTES, ...FIXTURE_BIRDS, ...FIXTURE_DISALLOWED];
		ingestAll(a, events);
		ingestAll(b, events);
		const options = {
			sourceSnapshotId: 'demo-snapshot',
			baseUrl: 'https://example.test/pulse/ap-demo',
			actorId: 'https://example.test/pulse/actors/jess',
		};
		expect(a.deriveActivityPubDemo(options)).toEqual(b.deriveActivityPubDemo(options));
	});
});
