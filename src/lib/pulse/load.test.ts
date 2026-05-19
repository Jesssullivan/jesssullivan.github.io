import { describe, expect, it, vi } from 'vitest';
import {
	PUBLIC_SNAPSHOT_PATH,
	TINYLAND_PULSE_PUBLIC_SNAPSHOT_URL,
	loadPulsePublicBrokerSnapshot,
	loadPulseSnapshot,
	type PulseSnapshotFetch,
} from './load';
import type { PublicPulseSnapshot } from '@blog/pulse-core/schema';

const validSnapshot: PublicPulseSnapshot = {
	schemaVersion: 'tinyland.pulse.v1.PublicPulseSnapshot',
	generatedAt: '2026-05-10T13:00:00.000Z',
	items: [
		{
			id: 'tinyland-pulse-note-2026-05-10-001',
			kind: 'note',
			occurredAt: '2026-05-10T12:30:00.000Z',
			summary: 'Live hello from Tinyland',
			content: 'Live hello from Tinyland',
			tags: ['tinyland', 'pulse'],
		},
	],
	manifest: {
		schemaVersion: 'tinyland.pulse.v1.PublicPulseSnapshot',
		generatedAt: '2026-05-10T13:00:00.000Z',
		sourceSnapshotId: 'tinyland-jesssullivan-pulse-static-seed-2026-05-10',
		contentHash: 'sha256:6a0552b5648f3e80f3f17edd104d7d1389c034abcdaf981651af56929fbfd44e',
		itemCount: 1,
		policyVersion: 'm1-2026-04-27',
	},
};

const jsonResponse = (body: unknown, init: ResponseInit = {}) =>
	new Response(JSON.stringify(body), {
		status: init.status ?? 200,
		statusText: init.statusText,
		headers: { 'Content-Type': 'application/json' },
	});

describe('loadPulseSnapshot', () => {
	it('loads the checked-in static Pulse snapshot for first paint', async () => {
		const fetchMock = vi.fn<PulseSnapshotFetch>(async () => jsonResponse(validSnapshot));

		await expect(loadPulseSnapshot(fetchMock)).resolves.toEqual(validSnapshot);
		expect(fetchMock).toHaveBeenCalledWith(PUBLIC_SNAPSHOT_PATH);
	});
});

describe('loadPulsePublicBrokerSnapshot', () => {
	it('fetches the hub broker snapshot without falling back to the checked-in file', async () => {
		const fetchMock = vi.fn<PulseSnapshotFetch>(async () => jsonResponse(validSnapshot));

		await expect(loadPulsePublicBrokerSnapshot(fetchMock)).resolves.toEqual(validSnapshot);
		expect(fetchMock).toHaveBeenCalledWith(
			TINYLAND_PULSE_PUBLIC_SNAPSHOT_URL,
			expect.objectContaining({
				headers: { Accept: 'application/json' },
				cache: 'no-store',
			}),
		);
		expect(fetchMock.mock.calls.flat().join(' ')).not.toContain(PUBLIC_SNAPSHOT_PATH);
	});

	it('rejects invalid broker snapshots instead of rendering unchecked data', async () => {
		const fetchMock = vi.fn<PulseSnapshotFetch>(async () =>
			jsonResponse({
				...validSnapshot,
				items: validSnapshot.items.map((item) => ({
					...item,
					latitude: 42.44,
					longitude: -76.5,
				})),
			}),
		);

		await expect(loadPulsePublicBrokerSnapshot(fetchMock)).rejects.toThrow(
			'pulse snapshot failed schema validation',
		);
	});

	it('fails closed when the broker endpoint is unavailable', async () => {
		const fetchMock = vi.fn<PulseSnapshotFetch>(async () =>
			jsonResponse({ error: 'unavailable' }, { status: 503, statusText: 'Service Unavailable' }),
		);

		await expect(loadPulsePublicBrokerSnapshot(fetchMock)).rejects.toThrow(
			'pulse broker snapshot fetch failed: 503',
		);
		expect(fetchMock).toHaveBeenCalledTimes(1);
	});
});
