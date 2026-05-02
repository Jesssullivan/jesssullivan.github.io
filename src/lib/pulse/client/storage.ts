import type { LocationPrecision, Visibility } from '@blog/pulse-core/schema';
import type { PulseClientDraftKind, PulseClientOutboxItem } from './drafts';

export const PULSE_CLIENT_STORAGE_SCHEMA_VERSION = 'tinyland.pulse.client.v1';
export const PULSE_CLIENT_STORAGE_KEY = 'tinyland:pulse:client:v1';

export interface PulseClientFormState {
	readonly sequence: number;
	readonly kind: PulseClientDraftKind;
	readonly visibility: Visibility;
	readonly occurredAt: string;
	readonly tagsInput: string;
	readonly idempotencyKey: string;
	readonly noteText: string;
	readonly birdCommonName: string;
	readonly birdScientificName: string;
	readonly birdCount: number;
	readonly birdPlaceLabel: string;
	readonly birdPlacePrecision: LocationPrecision;
	readonly birdObservationId: string;
}

export interface PulseClientPersistedState {
	readonly schemaVersion: typeof PULSE_CLIENT_STORAGE_SCHEMA_VERSION;
	readonly savedAt: string;
	readonly form: PulseClientFormState;
	readonly outbox: readonly PulseClientOutboxItem[];
}

export interface PulseClientStorageAdapter {
	load(): PulseClientPersistedState | null;
	save(state: PulseClientPersistedState): void;
	clear(): void;
}

type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

const visibilityValues = new Set<Visibility>([
	'VISIBILITY_UNSPECIFIED',
	'VISIBILITY_PUBLIC',
	'VISIBILITY_UNLISTED',
	'VISIBILITY_PRIVATE',
]);

const locationPrecisionValues = new Set<LocationPrecision>([
	'LOCATION_PRECISION_UNSPECIFIED',
	'LOCATION_PRECISION_EXACT',
	'LOCATION_PRECISION_REGION',
	'LOCATION_PRECISION_HIDDEN',
]);

const outboxStateValues = new Set<PulseClientOutboxItem['state']>([
	'draft_ready',
	'draft_blocked',
	'local_queued',
	'retry_pending',
	'broker_accepted',
	'broker_duplicate',
	'broker_invalid',
	'ap_published',
	'ap_blocked',
]);

const isRecord = (value: unknown): value is Record<string, unknown> =>
	typeof value === 'object' && value !== null && !Array.isArray(value);

const isString = (value: unknown): value is string => typeof value === 'string';

const clonePersistedState = (state: PulseClientPersistedState): PulseClientPersistedState =>
	JSON.parse(JSON.stringify(state)) as PulseClientPersistedState;

const parseOutboxItem = (value: unknown): PulseClientOutboxItem | null => {
	if (!isRecord(value)) return null;
	if (!isString(value.id)) return null;
	if (!isString(value.draftId)) return null;
	if (!isString(value.state) || !outboxStateValues.has(value.state as PulseClientOutboxItem['state'])) return null;
	if (!isString(value.idempotencyKey)) return null;
	if (!isString(value.label)) return null;
	if (!isString(value.detail)) return null;

	return {
		id: value.id,
		draftId: value.draftId,
		state: value.state as PulseClientOutboxItem['state'],
		idempotencyKey: value.idempotencyKey,
		label: value.label,
		detail: value.detail,
		...(isString(value.eventId) ? { eventId: value.eventId } : {}),
		...(isString(value.activityId) ? { activityId: value.activityId } : {}),
	};
};

const parseFormState = (value: unknown): PulseClientFormState | null => {
	if (!isRecord(value)) return null;
	if (typeof value.sequence !== 'number' || !Number.isInteger(value.sequence) || value.sequence < 1) return null;
	if (value.kind !== 'note' && value.kind !== 'bird_sighting') return null;
	if (!isString(value.visibility) || !visibilityValues.has(value.visibility as Visibility)) return null;
	if (!isString(value.occurredAt)) return null;
	if (!isString(value.tagsInput)) return null;
	if (!isString(value.idempotencyKey)) return null;
	if (!isString(value.noteText)) return null;
	if (!isString(value.birdCommonName)) return null;
	if (!isString(value.birdScientificName)) return null;
	if (typeof value.birdCount !== 'number' || !Number.isFinite(value.birdCount)) return null;
	if (!isString(value.birdPlaceLabel)) return null;
	if (
		!isString(value.birdPlacePrecision) ||
		!locationPrecisionValues.has(value.birdPlacePrecision as LocationPrecision)
	) {
		return null;
	}
	if (!isString(value.birdObservationId)) return null;

	return {
		sequence: value.sequence,
		kind: value.kind,
		visibility: value.visibility as Visibility,
		occurredAt: value.occurredAt,
		tagsInput: value.tagsInput,
		idempotencyKey: value.idempotencyKey,
		noteText: value.noteText,
		birdCommonName: value.birdCommonName,
		birdScientificName: value.birdScientificName,
		birdCount: value.birdCount,
		birdPlaceLabel: value.birdPlaceLabel,
		birdPlacePrecision: value.birdPlacePrecision as LocationPrecision,
		birdObservationId: value.birdObservationId,
	};
};

export const parsePulseClientPersistedState = (value: unknown): PulseClientPersistedState | null => {
	if (!isRecord(value)) return null;
	if (value.schemaVersion !== PULSE_CLIENT_STORAGE_SCHEMA_VERSION) return null;
	if (!isString(value.savedAt)) return null;

	const form = parseFormState(value.form);
	if (!form) return null;
	if (!Array.isArray(value.outbox)) return null;

	const outbox: PulseClientOutboxItem[] = [];
	for (const item of value.outbox) {
		const parsed = parseOutboxItem(item);
		if (!parsed) return null;
		outbox.push(parsed);
	}

	return {
		schemaVersion: PULSE_CLIENT_STORAGE_SCHEMA_VERSION,
		savedAt: value.savedAt,
		form,
		outbox,
	};
};

export const createPulseClientPersistedState = ({
	form,
	outbox,
	savedAt,
}: {
	readonly form: PulseClientFormState;
	readonly outbox: readonly PulseClientOutboxItem[];
	readonly savedAt: string;
}): PulseClientPersistedState => ({
	schemaVersion: PULSE_CLIENT_STORAGE_SCHEMA_VERSION,
	savedAt,
	form,
	outbox,
});

export const createMemoryPulseClientStorageAdapter = (
	initialState: PulseClientPersistedState | null = null,
): PulseClientStorageAdapter => {
	let current = initialState ? clonePersistedState(initialState) : null;

	return {
		load: () => (current ? clonePersistedState(current) : null),
		save: (state) => {
			current = clonePersistedState(state);
		},
		clear: () => {
			current = null;
		},
	};
};

export const createBrowserPulseClientStorageAdapter = (
	storage: StorageLike,
	key = PULSE_CLIENT_STORAGE_KEY,
): PulseClientStorageAdapter => ({
	load: () => {
		const raw = storage.getItem(key);
		if (!raw) return null;
		try {
			return parsePulseClientPersistedState(JSON.parse(raw));
		} catch {
			return null;
		}
	},
	save: (state) => {
		storage.setItem(key, JSON.stringify(state));
	},
	clear: () => {
		storage.removeItem(key);
	},
});
