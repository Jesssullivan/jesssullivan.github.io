import { test, expect } from '@playwright/test';

const endpoint = 'https://tinyland.dev/projections/jesssullivan-github-io/pulse/ap-stream-demo.v1.json';
const endpointPattern = '**/projections/jesssullivan-github-io/pulse/ap-stream-demo.v1.json**';

const liveDemo = {
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
	publicUrl: endpoint,
	itemCount: 1,
	orderedItems: [
		{
			id: `${endpoint}#tinyland-pulse-note-2026-05-10-001`,
			type: 'Note',
			published: '2026-05-10T12:30:00.000Z',
			summary: 'Live hello from Tinyland',
			content: 'Tinyland broker payload rendered',
			tag: [{ type: 'Hashtag', name: '#pulse' }],
			tinylandPulse: {
				id: 'tinyland-pulse-note-2026-05-10-001',
				kind: 'note',
				sourceSnapshotId: 'tinyland-jesssullivan-pulse-static-seed-2026-05-10',
			},
		},
	],
};

test.describe('Pulse brokered stream lab', () => {
	test('renders AP-shaped broker data from the live Tinyland endpoint', async ({ page }) => {
		await page.route(endpointPattern, (route) =>
			route.fulfill({
				status: 200,
				contentType: 'application/json',
				headers: {
					'Access-Control-Allow-Origin': '*',
				},
				body: JSON.stringify(liveDemo),
			}),
		);

		await page.goto('/pulse/client/brokered-stream');

		await expect(page.getByRole('heading', { name: 'AP stream' })).toBeVisible();
		await expect(page.getByTestId('pulse-ap-stream-ready')).toBeVisible();
		await expect(page.getByText('AP-shaped projection only')).toBeVisible();
		await expect(page.getByText('Fediverse delivery')).toBeVisible();
		await expect(page.getByRole('heading', { name: 'Live hello from Tinyland' })).toBeVisible();
		await expect(page.getByText('Tinyland broker payload rendered')).toBeVisible();
	});

	test('shows unavailable instead of falling back to checked-in static data', async ({ page }) => {
		await page.route(endpointPattern, (route) =>
			route.fulfill({
				status: 503,
				contentType: 'application/json',
				headers: {
					'Access-Control-Allow-Origin': '*',
				},
				body: JSON.stringify({ error: 'broker unavailable' }),
			}),
		);

		await page.goto('/pulse/client/brokered-stream');

		await expect(page.getByTestId('pulse-ap-stream-unavailable')).toBeVisible();
		await expect(page.getByText('Broker stream unavailable')).toBeVisible();
		await expect(page.locator('body')).not.toContainText('Static Pulse projection is now sourced');
	});
});
