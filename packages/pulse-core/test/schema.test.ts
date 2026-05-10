import { describe, it, expect } from 'vitest';
import {
	PulseEventSchema,
	PublicPulseSnapshotSchema,
	PulseApStreamDemoSchema,
	PUBLIC_SNAPSHOT_SCHEMA_VERSION,
	PUBLIC_SNAPSHOT_POLICY_VERSION,
	PULSE_AP_STREAM_DEMO_SCHEMA_VERSION,
	PULSE_AP_STREAM_DEMO_STATUS,
	NotePayloadSchema,
	PayloadSchema,
	type PulseEvent,
} from '../src/schema/index.js';
import { FIXTURE_NOTES, FIXTURE_BIRDS, FIXTURE_DISALLOWED } from '../src/fixtures/index.js';

describe('schema/event', () => {
	it.each([...FIXTURE_NOTES, ...FIXTURE_BIRDS, ...FIXTURE_DISALLOWED])(
		'accepts well-formed fixture event %s',
		(event: PulseEvent) => {
			const parsed = PulseEventSchema.parse(event);
			expect(parsed.id).toBe(event.id);
			expect(parsed.payload.kind).toBe(event.payload.kind);
		},
	);

	it('rejects an event with unspecified visibility', () => {
		const broken = { ...FIXTURE_NOTES[0]!, visibility: 'VISIBILITY_UNSPECIFIED' };
		const result = PulseEventSchema.safeParse(broken);
		expect(result.success).toBe(false);
	});

	it('rejects an event with revision below 1', () => {
		const broken = { ...FIXTURE_NOTES[0]!, revision: 0 };
		expect(PulseEventSchema.safeParse(broken).success).toBe(false);
	});

	it('rejects an event with a non-UTC timestamp', () => {
		const broken = { ...FIXTURE_NOTES[0]!, occurredAt: '2026-04-25T18:30:00+02:00' };
		expect(PulseEventSchema.safeParse(broken).success).toBe(false);
	});

	it('rejects unknown top-level fields (strict)', () => {
		const broken = { ...FIXTURE_NOTES[0]!, extra: 'unknown' } as unknown;
		expect(PulseEventSchema.safeParse(broken).success).toBe(false);
	});
});

describe('schema/payload', () => {
	it('rejects an empty note', () => {
		const result = NotePayloadSchema.safeParse({ kind: 'note', text: '   ' });
		expect(result.success).toBe(false);
	});

	it('preserves note text without auto-trimming (consumer trims at boundary)', () => {
		const result = NotePayloadSchema.parse({ kind: 'note', text: '  hello  ' });
		expect(result.text).toBe('  hello  ');
	});

	it('rejects a bird sighting with no name (cross-field rule on the union)', () => {
		const result = PayloadSchema.safeParse({
			kind: 'bird_sighting',
			commonName: '',
			scientificName: '',
			count: 1,
			observationId: 'x',
		});
		expect(result.success).toBe(false);
	});

	it('rejects a bird sighting with count below 1', () => {
		const result = PayloadSchema.safeParse({
			kind: 'bird_sighting',
			commonName: 'Robin',
			scientificName: '',
			count: 0,
			observationId: 'x',
		});
		expect(result.success).toBe(false);
	});
});

describe('schema/snapshot', () => {
	const validSnapshot = {
		schemaVersion: PUBLIC_SNAPSHOT_SCHEMA_VERSION,
		generatedAt: '2026-04-27T17:00:00.000Z',
		items: [
			{
				id: 'evt_note_001',
				kind: 'note' as const,
				occurredAt: '2026-04-25T18:30:00.000Z',
				summary: 'a',
				content: 'a',
				tags: [],
			},
		],
		manifest: {
			schemaVersion: PUBLIC_SNAPSHOT_SCHEMA_VERSION,
			generatedAt: '2026-04-27T17:00:00.000Z',
			sourceSnapshotId: 'fixture',
			contentHash: `sha256:${'a'.repeat(64)}`,
			itemCount: 1,
			policyVersion: PUBLIC_SNAPSHOT_POLICY_VERSION,
		},
	};

	it('accepts a well-formed snapshot', () => {
		expect(PublicPulseSnapshotSchema.safeParse(validSnapshot).success).toBe(true);
	});

	it('rejects when manifest itemCount disagrees with items.length', () => {
		const broken = {
			...validSnapshot,
			manifest: { ...validSnapshot.manifest, itemCount: 2 },
		};
		expect(PublicPulseSnapshotSchema.safeParse(broken).success).toBe(false);
	});

	it('rejects when schemaVersion fields disagree', () => {
		const broken = {
			...validSnapshot,
			manifest: { ...validSnapshot.manifest, schemaVersion: 'tinyland.pulse.v0' },
		};
		expect(PublicPulseSnapshotSchema.safeParse(broken).success).toBe(false);
	});

	it('rejects an invalid contentHash format', () => {
		const broken = {
			...validSnapshot,
			manifest: { ...validSnapshot.manifest, contentHash: 'not-a-hash' },
		};
		expect(PublicPulseSnapshotSchema.safeParse(broken).success).toBe(false);
	});

	it('rejects a bird_sighting item without birdSighting', () => {
		const broken = {
			...validSnapshot,
			items: [
				{
					id: 'x',
					kind: 'bird_sighting' as const,
					occurredAt: '2026-04-25T18:30:00.000Z',
					summary: '',
					content: '',
					tags: [],
				},
			],
			manifest: { ...validSnapshot.manifest, itemCount: 1 },
		};
		expect(PublicPulseSnapshotSchema.safeParse(broken).success).toBe(false);
	});
});

describe('schema/ap-stream-demo', () => {
	const validDemo = {
		schemaVersion: PULSE_AP_STREAM_DEMO_SCHEMA_VERSION,
		generatedAt: '2026-05-10T13:00:00.000Z',
		sourceAuthority: 'tinyland.dev',
		sourceAuthorityUrl: 'https://tinyland.dev',
		sourceSnapshotId: 'tinyland-jesssullivan-pulse-static-seed-2026-05-10',
		contentHash: `sha256:${'b'.repeat(64)}`,
		policyVersion: PUBLIC_SNAPSHOT_POLICY_VERSION,
		projectionKind: 'pulse-ap-stream-demo',
		demoStatus: PULSE_AP_STREAM_DEMO_STATUS,
		publicFediverseDelivery: false,
		activityPubStatus: 'ap-shaped-projection-only',
		spokeRef: 'jesssullivan-github-io',
		spokeTarget: 'transscendsurvival.org',
		routePath: '/projections/jesssullivan-github-io/pulse/ap-stream-demo.v1.json',
		publicUrl: 'https://tinyland.dev/projections/jesssullivan-github-io/pulse/ap-stream-demo.v1.json',
		itemCount: 1,
		orderedItems: [
			{
				id: 'https://tinyland.dev/projections/jesssullivan-github-io/pulse/ap-stream-demo.v1.json#note-1',
				type: 'Note',
				published: '2026-05-10T12:30:00.000Z',
				summary: 'hello',
				content: 'hello',
				tag: [{ type: 'Hashtag', name: '#pulse' }],
				tinylandPulse: {
					id: 'note-1',
					kind: 'note',
					sourceSnapshotId: 'tinyland-jesssullivan-pulse-static-seed-2026-05-10',
				},
			},
		],
	};

	it('accepts a well-formed Tinyland AP stream demo', () => {
		expect(PulseApStreamDemoSchema.safeParse(validDemo).success).toBe(true);
	});

	it('rejects public Fediverse delivery claims', () => {
		const broken = { ...validDemo, publicFediverseDelivery: true };
		expect(PulseApStreamDemoSchema.safeParse(broken).success).toBe(false);
	});

	it('rejects leaked delivery-worker internals', () => {
		const broken = { ...validDemo, deliveryWorker: { retryQueue: ['evt_1'] } };
		expect(PulseApStreamDemoSchema.safeParse(broken).success).toBe(false);
	});

	it('rejects itemCount drift', () => {
		const broken = { ...validDemo, itemCount: 2 };
		expect(PulseApStreamDemoSchema.safeParse(broken).success).toBe(false);
	});
});
