import type { PulseEvent } from '../schema/event.js';

// These exist to exercise policy denial paths. They are valid PulseEvents at
// the schema level; the policy engine MUST reject them from public projection.
export const FIXTURE_DISALLOWED: readonly PulseEvent[] = [
	{
		id: 'evt_git_001',
		actor: 'jess',
		occurredAt: '2026-04-25T22:00:00.000Z',
		visibility: 'VISIBILITY_PUBLIC',
		source: {
			client: 'git-pulse',
			deviceId: 'host-laptop',
			idempotencyKey: 'idem_git_001',
		},
		tags: [],
		media: [],
		revision: 1,
		payload: {
			kind: 'git_summary',
			repository: 'jesssullivan.github.io',
			summary: '+10 commits in jesssullivan.github.io.',
		},
	},
	{
		id: 'evt_listen_001',
		actor: 'jess',
		occurredAt: '2026-04-26T13:00:00.000Z',
		visibility: 'VISIBILITY_PUBLIC',
		source: {
			client: 'pulse-lab',
			deviceId: 'fixture-device',
			idempotencyKey: 'idem_listen_001',
		},
		tags: [],
		media: [],
		revision: 1,
		payload: {
			kind: 'listening',
			title: 'A track',
			artist: 'An artist',
			album: 'An album',
			externalUrl: 'https://example.invalid/track',
		},
	},
	{
		id: 'evt_photo_with_private_key',
		actor: 'jess',
		occurredAt: '2026-04-26T15:00:00.000Z',
		visibility: 'VISIBILITY_PUBLIC',
		source: {
			client: 'pulse-lab',
			deviceId: 'fixture-device',
			idempotencyKey: 'idem_photo_001',
		},
		tags: [],
		media: [
			{
				id: 'm1',
				mimeType: 'image/jpeg',
				altText: 'a bird',
				privateObjectKey: 's3://private-bucket/photos/raw/m1.jpg',
				publicUrl: '',
			},
		],
		revision: 1,
		payload: {
			kind: 'photo',
			caption: 'photo caption',
		},
	},
];
