import { describe, expect, it } from 'vitest';
import type { PulseClientOutboxItem } from '../src/drafts';
import {
	PULSE_CLIENT_STORAGE_KEY,
	createBrowserPulseClientStorageAdapter,
	createMemoryPulseClientStorageAdapter,
	createPulseClientPersistedState,
	parsePulseClientPersistedState,
	type PulseClientFormState,
} from '../src/storage';
import { PULSE_CLIENT_DEFAULT_IDENTITY } from '../src/identity';
import { PULSE_CLIENT_DEFAULT_MEDIA_INTENT, createPulseClientMediaIntent } from '../src/media';

const form: PulseClientFormState = {
	sequence: 3,
	kind: 'bird_sighting',
	visibility: 'VISIBILITY_PUBLIC',
	occurredAt: '2026-05-02T20:00:00.000Z',
	tagsInput: 'client, birds',
	idempotencyKey: 'pulse-client-3',
	identity: {
		actor: 'demo-operator',
		displayName: 'Demo Operator',
		deviceId: 'demo-device-3',
		deviceLabel: 'Demo device 3',
		client: 'pulse-client-test',
		sessionId: 'session-3',
	},
	mediaIntentEnabled: true,
	mediaIntent: createPulseClientMediaIntent({
		id: 'media_3',
		filename: 'cardinal-demo.jpg',
		lifecycle: 'private_object_staged',
		privateObjectKey: 'pulse/client/drafts/media_3/cardinal-demo-original.jpg',
	}),
	noteText: '',
	birdCommonName: 'Northern Cardinal',
	birdScientificName: 'Cardinalis cardinalis',
	birdCount: 2,
	birdPlaceLabel: 'Cayuga Lake basin',
	birdPlacePrecision: 'LOCATION_PRECISION_REGION',
	birdObservationId: 'client-obs-3',
};

const outboxItem: PulseClientOutboxItem = {
	id: 'draft_3_preview_queued',
	draftId: 'draft_3',
	state: 'local_queued',
	idempotencyKey: 'pulse-client-3',
	label: 'Bird sighting draft',
	detail: 'queued locally; policy preview allows public projection',
	eventId: 'preview_draft_3',
	decision: {
		allowed: true,
		item: {
			id: 'preview_draft_3',
			kind: 'bird_sighting',
			occurredAt: form.occurredAt,
			summary: '2x Northern Cardinal',
			content: '',
			tags: ['client', 'birds'],
			birdSighting: {
				commonName: form.birdCommonName,
				scientificName: form.birdScientificName,
				count: form.birdCount,
				placeLabel: form.birdPlaceLabel,
			},
		},
	},
	identity: form.identity,
	mediaIntents: [form.mediaIntent],
};

const blockedOutboxItem: PulseClientOutboxItem = {
	...outboxItem,
	id: 'draft_3_preview_blocked',
	state: 'draft_blocked',
	detail: 'media=media_3',
	decision: {
		allowed: false,
		reason: 'private_object_key_present',
		detail: 'media=media_3',
	},
};

const createFakeStorage = () => {
	const values = new Map<string, string>();
	return {
		getItem: (key: string) => values.get(key) ?? null,
		setItem: (key: string, value: string) => {
			values.set(key, value);
		},
		removeItem: (key: string) => {
			values.delete(key);
		},
		values,
	};
};

describe('pulse client storage', () => {
	it('round-trips versioned form and outbox state through memory storage', () => {
		const state = createPulseClientPersistedState({
			form,
			outbox: [outboxItem],
			savedAt: '2026-05-02T21:00:00.000Z',
		});
		const storage = createMemoryPulseClientStorageAdapter();

		storage.save(state);

		expect(storage.load()).toEqual(state);
	});

	it('returns clones so tests cannot mutate adapter state accidentally', () => {
		const state = createPulseClientPersistedState({
			form,
			outbox: [outboxItem],
			savedAt: '2026-05-02T21:00:00.000Z',
		});
		const storage = createMemoryPulseClientStorageAdapter(state);
		const loaded = storage.load();

		expect(loaded).not.toBe(state);
		expect(loaded?.outbox).not.toBe(state.outbox);
	});

	it('persists JSON through a browser storage boundary', () => {
		const fakeStorage = createFakeStorage();
		const storage = createBrowserPulseClientStorageAdapter(fakeStorage);
		const state = createPulseClientPersistedState({
			form,
			outbox: [outboxItem, blockedOutboxItem],
			savedAt: '2026-05-02T21:00:00.000Z',
		});

		storage.save(state);

		expect(fakeStorage.values.has(PULSE_CLIENT_STORAGE_KEY)).toBe(true);
		expect(storage.load()).toEqual(state);
	});

	it('ignores unsupported or malformed persisted state', () => {
		expect(parsePulseClientPersistedState({ schemaVersion: 'tinyland.pulse.client.v0' })).toBeNull();
		expect(
			parsePulseClientPersistedState({
				schemaVersion: 'tinyland.pulse.client.v1',
				savedAt: '2026-05-02T21:00:00.000Z',
				form: { ...form, birdCount: 'two' },
				outbox: [],
			}),
		).toBeNull();
		expect(
			parsePulseClientPersistedState({
				schemaVersion: 'tinyland.pulse.client.v1',
				savedAt: '2026-05-02T21:00:00.000Z',
				form: { ...form, identity: { ...form.identity, deviceId: 123 } },
				outbox: [],
			}),
		).toBeNull();
		expect(
			parsePulseClientPersistedState({
				schemaVersion: 'tinyland.pulse.client.v1',
				savedAt: '2026-05-02T21:00:00.000Z',
				form: { ...form, mediaIntent: { ...form.mediaIntent, lifecycle: 'invented' } },
				outbox: [],
			}),
		).toBeNull();
		expect(
			parsePulseClientPersistedState({
				schemaVersion: 'tinyland.pulse.client.v1',
				savedAt: '2026-05-02T21:00:00.000Z',
				form,
				outbox: [{ ...outboxItem, decision: { allowed: false, reason: 'invented', detail: 'nope' } }],
			}),
		).toBeNull();

		const fakeStorage = createFakeStorage();
		fakeStorage.setItem(PULSE_CLIENT_STORAGE_KEY, '{not-json');

		expect(createBrowserPulseClientStorageAdapter(fakeStorage).load()).toBeNull();
	});

	it('loads existing v1 form state with default identity values', () => {
		const parsed = parsePulseClientPersistedState({
			schemaVersion: 'tinyland.pulse.client.v1',
			savedAt: '2026-05-02T21:00:00.000Z',
			form: {
				...form,
				identity: undefined,
				mediaIntentEnabled: undefined,
				mediaIntent: undefined,
			},
			outbox: [
				{
					...outboxItem,
					identity: undefined,
					mediaIntents: undefined,
				},
			],
		});

		expect(parsed?.form.identity).toEqual(PULSE_CLIENT_DEFAULT_IDENTITY);
		expect(parsed?.form.mediaIntentEnabled).toBe(false);
		expect(parsed?.form.mediaIntent).toEqual(PULSE_CLIENT_DEFAULT_MEDIA_INTENT);
		expect(parsed?.outbox[0]?.identity).toBeUndefined();
		expect(parsed?.outbox[0]?.mediaIntents).toBeUndefined();
	});

	it('clears browser storage', () => {
		const fakeStorage = createFakeStorage();
		const storage = createBrowserPulseClientStorageAdapter(fakeStorage);

		storage.save(
			createPulseClientPersistedState({
				form,
				outbox: [outboxItem],
				savedAt: '2026-05-02T21:00:00.000Z',
			}),
		);
		storage.clear();

		expect(storage.load()).toBeNull();
	});
});
