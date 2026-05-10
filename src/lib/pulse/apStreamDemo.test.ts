import { describe, expect, it, vi } from 'vitest';
import {
	TINYLAND_PULSE_AP_STREAM_DEMO_URL,
	loadPulseApStreamDemo,
	type PulseApStreamFetch,
} from './apStreamDemo';
import type { PulseApStreamDemo } from '@blog/pulse-core/schema';

const validDemo: PulseApStreamDemo = {
	schemaVersion: 'tinyland.pulse.ap-stream-demo.v1',
	generatedAt: '2026-05-10T13:00:00.000Z',
	sourceAuthority: 'tinyland.dev',
	sourceAuthorityUrl: 'https://tinyland.dev',
	sourceSnapshotId: 'tinyland-jesssullivan-pulse-static-seed-2026-05-10',
	contentHash: 'sha256:fc3b04ec97946d6777e5245040b09a3ead296a9bf4614d0fea7df2d3cfb2ccb7',
	policyVersion: 'm1-2026-04-27',
	projectionKind: 'pulse-ap-stream-demo',
	demoStatus: 'controlled-static-source-live-broker-demo',
	publicFediverseDelivery: false,
	activityPubStatus: 'ap-shaped-projection-only',
	spokeRef: 'jesssullivan-github-io',
	spokeTarget: 'transscendsurvival.org',
	routePath: '/projections/jesssullivan-github-io/pulse/ap-stream-demo.v1.json',
	publicUrl: TINYLAND_PULSE_AP_STREAM_DEMO_URL,
	itemCount: 1,
	orderedItems: [
		{
			id: `${TINYLAND_PULSE_AP_STREAM_DEMO_URL}#tinyland-pulse-note-2026-05-10-001`,
			type: 'Note',
			published: '2026-05-10T12:30:00.000Z',
			summary: 'Live hello from Tinyland',
			content: 'Live hello from Tinyland',
			tag: [
				{ type: 'Hashtag', name: '#tinyland' },
				{ type: 'Hashtag', name: '#pulse' },
			],
			tinylandPulse: {
				id: 'tinyland-pulse-note-2026-05-10-001',
				kind: 'note',
				sourceSnapshotId: 'tinyland-jesssullivan-pulse-static-seed-2026-05-10',
			},
		},
	],
};

const jsonResponse = (body: unknown, init: ResponseInit = {}) =>
	new Response(JSON.stringify(body), {
		status: init.status ?? 200,
		statusText: init.statusText,
		headers: { 'Content-Type': 'application/json' },
	});

describe('loadPulseApStreamDemo', () => {
	it('fetches the live Tinyland broker URL and validates the response', async () => {
		const fetchMock = vi.fn<PulseApStreamFetch>(async () => jsonResponse(validDemo));

		await expect(loadPulseApStreamDemo(fetchMock)).resolves.toEqual(validDemo);
		expect(fetchMock).toHaveBeenCalledTimes(1);
		expect(fetchMock).toHaveBeenCalledWith(
			TINYLAND_PULSE_AP_STREAM_DEMO_URL,
			expect.objectContaining({
				headers: { Accept: 'application/json' },
				cache: 'no-store',
			}),
		);
	});

	it('does not fall back to the checked-in static Pulse snapshot when the broker fails', async () => {
		const fetchMock = vi.fn<PulseApStreamFetch>(async () =>
			jsonResponse({ error: 'unavailable' }, { status: 503, statusText: 'Service Unavailable' }),
		);

		await expect(loadPulseApStreamDemo(fetchMock)).rejects.toThrow('pulse AP stream demo fetch failed: 503');
		expect(fetchMock).toHaveBeenCalledTimes(1);
		expect(fetchMock.mock.calls[0]?.[0]).toBe(TINYLAND_PULSE_AP_STREAM_DEMO_URL);
		expect(fetchMock.mock.calls.flat().join(' ')).not.toContain('/data/pulse/public-snapshot.v1.json');
	});

	it('rejects broker data that carries federation internals', async () => {
		const fetchMock = vi.fn<PulseApStreamFetch>(async () =>
			jsonResponse({
				...validDemo,
				deliveryWorker: { retryQueue: ['hidden'] },
			}),
		);

		await expect(loadPulseApStreamDemo(fetchMock)).rejects.toThrow('pulse AP stream demo failed schema validation');
	});

	it('rejects item data with exact-location fields', async () => {
		const fetchMock = vi.fn<PulseApStreamFetch>(async () =>
			jsonResponse({
				...validDemo,
				orderedItems: [
					{
						...validDemo.orderedItems[0],
						latitude: 42.44,
						longitude: -76.5,
					},
				],
			}),
		);

		await expect(loadPulseApStreamDemo(fetchMock)).rejects.toThrow('pulse AP stream demo failed schema validation');
	});
});
