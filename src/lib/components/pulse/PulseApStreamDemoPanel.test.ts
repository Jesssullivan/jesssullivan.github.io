import { render } from 'svelte/server';
import { describe, expect, it } from 'vitest';
import { TINYLAND_PULSE_AP_STREAM_DEMO_URL, type PulseApStreamDemoPanelState } from '$lib/pulse/apStreamDemo';
import PulseApStreamDemoPanel from './PulseApStreamDemoPanel.svelte';

const readyState: PulseApStreamDemoPanelState = {
	status: 'ready',
	endpoint: TINYLAND_PULSE_AP_STREAM_DEMO_URL,
	demo: {
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
				tag: [{ type: 'Hashtag', name: '#pulse' }],
				tinylandPulse: {
					id: 'tinyland-pulse-note-2026-05-10-001',
					kind: 'note',
					sourceSnapshotId: 'tinyland-jesssullivan-pulse-static-seed-2026-05-10',
				},
			},
		],
	},
};

describe('PulseApStreamDemoPanel', () => {
	it('renders live AP-shaped stream metadata and items', () => {
		const { html } = render(PulseApStreamDemoPanel, { props: { state: readyState } });

		expect(html).toContain('AP stream');
		expect(html).toContain('AP-shaped projection only');
		expect(html).toContain('Fediverse delivery');
		expect(html).toContain('off');
		expect(html).toContain('Live hello from Tinyland');
		expect(html).toContain('#pulse');
		expect(html).not.toContain('privateObjectKey');
		expect(html).not.toContain('deliveryWorker');
	});

	it('renders a blocked state when the live broker cannot be read', () => {
		const { html } = render(PulseApStreamDemoPanel, {
			props: {
				state: {
					status: 'unavailable',
					endpoint: TINYLAND_PULSE_AP_STREAM_DEMO_URL,
					reason: 'pulse AP stream demo fetch failed: 503 Service Unavailable',
				},
			},
		});

		expect(html).toContain('Broker stream unavailable');
		expect(html).toContain('pulse AP stream demo fetch failed');
		expect(html).toContain(TINYLAND_PULSE_AP_STREAM_DEMO_URL);
	});

	it('renders a live-loading state without static Pulse content', () => {
		const { html } = render(PulseApStreamDemoPanel, {
			props: { state: { status: 'loading', endpoint: TINYLAND_PULSE_AP_STREAM_DEMO_URL } },
		});

		expect(html).toContain('Connecting to Tinyland broker');
		expect(html).not.toContain('Static Pulse projection is now sourced');
	});
});
