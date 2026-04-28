import type { PulseEvent } from '../schema/event.js';

export const FIXTURE_BIRDS: readonly PulseEvent[] = [
	{
		id: 'evt_bird_001',
		actor: 'jess',
		occurredAt: '2026-04-26T07:42:00.000Z',
		visibility: 'VISIBILITY_PUBLIC',
		source: {
			client: 'pulse-lab',
			deviceId: 'fixture-device',
			idempotencyKey: 'idem_bird_001',
		},
		tags: ['birds'],
		media: [],
		revision: 1,
		payload: {
			kind: 'bird_sighting',
			commonName: 'Northern Cardinal',
			scientificName: 'Cardinalis cardinalis',
			count: 2,
			place: {
				label: 'Cayuga Lake basin',
				latitude: 42.45,
				longitude: -76.5,
				precision: 'LOCATION_PRECISION_REGION',
			},
			observationId: 'obs_001',
		},
	},
	{
		id: 'evt_bird_002_exact_loc',
		actor: 'jess',
		occurredAt: '2026-04-26T08:05:00.000Z',
		visibility: 'VISIBILITY_PUBLIC',
		source: {
			client: 'pulse-lab',
			deviceId: 'fixture-device',
			idempotencyKey: 'idem_bird_002',
		},
		tags: ['birds'],
		media: [],
		revision: 1,
		payload: {
			kind: 'bird_sighting',
			commonName: 'Great Horned Owl',
			scientificName: 'Bubo virginianus',
			count: 1,
			place: {
				label: 'home',
				latitude: 42.443012,
				longitude: -76.501234,
				precision: 'LOCATION_PRECISION_EXACT',
			},
			observationId: 'obs_002',
		},
	},
];
