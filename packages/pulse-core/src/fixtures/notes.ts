import type { PulseEvent } from '../schema/event.js';

// Deterministic note fixtures. IDs are stable strings, not UUIDs, so test
// failures point at a known event rather than at noise.
export const FIXTURE_NOTES: readonly PulseEvent[] = [
	{
		id: 'evt_note_001',
		actor: 'jess',
		occurredAt: '2026-04-25T18:30:00.000Z',
		visibility: 'VISIBILITY_PUBLIC',
		source: {
			client: 'pulse-lab',
			deviceId: 'fixture-device',
			idempotencyKey: 'idem_note_001',
		},
		tags: ['lab'],
		media: [],
		revision: 1,
		payload: {
			kind: 'note',
			text: 'First fixture note from the M1 lab. Hello tinyland.',
		},
	},
	{
		id: 'evt_note_002',
		actor: 'jess',
		occurredAt: '2026-04-26T09:12:00.000Z',
		visibility: 'VISIBILITY_PUBLIC',
		source: {
			client: 'pulse-lab',
			deviceId: 'fixture-device',
			idempotencyKey: 'idem_note_002',
		},
		tags: ['birds', 'morning'],
		media: [],
		revision: 1,
		payload: {
			kind: 'note',
			text: 'Cardinals on the feeder before dawn.',
		},
	},
	{
		id: 'evt_note_003_private',
		actor: 'jess',
		occurredAt: '2026-04-26T11:00:00.000Z',
		visibility: 'VISIBILITY_PRIVATE',
		source: {
			client: 'pulse-lab',
			deviceId: 'fixture-device',
			idempotencyKey: 'idem_note_003',
		},
		tags: [],
		media: [],
		revision: 1,
		payload: {
			kind: 'note',
			text: 'Private fixture note. Must never appear in a public snapshot.',
		},
	},
];
