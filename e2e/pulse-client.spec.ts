import { test, expect, type Page } from '@playwright/test';

const VIEWPORTS = [
	{ name: 'mobile', width: 390, height: 844 },
	{ name: 'desktop', width: 1280, height: 800 },
] as const;

async function gotoPulseClient(page: Page) {
	await page.goto('/pulse/client');
	const shell = page.getByTestId('pulse-client-shell');
	await expect(shell).toContainText('Compose queue');
	await expect(shell).toHaveAttribute('data-hydrated', 'true');
}

for (const vp of VIEWPORTS) {
	test.describe(`Pulse Client @ ${vp.name}`, () => {
		test.use({ viewport: { width: vp.width, height: vp.height } });

		test('submits a note and renders broker/AP demo state', async ({ page }) => {
			await gotoPulseClient(page);

			await page.getByLabel('Note').fill('hello from the M2 client scaffold');
			await page.getByRole('button', { name: 'Submit to broker mock' }).click();

			await expect(page.getByTestId('pulse-client-outbox')).toContainText('accepted');
			await expect(page.getByTestId('pulse-client-outbox')).toContainText('pulse-client-1');
			await expect(page.getByTestId('pulse-ap-demo-queue')).toContainText('published');
			await expect(page.getByTestId('pulse-ap-demo-queue')).toContainText('hello from the M2 client scaffold');
		});

		test('keeps exact-location bird sightings blocked from public projection', async ({ page }) => {
			await gotoPulseClient(page);

			await page.getByRole('button', { name: 'bird' }).click();
			await page.getByLabel('Common name').fill('Great Horned Owl');
			await page.getByLabel('Place label').fill('home');
			await page.getByLabel('Precision').selectOption('LOCATION_PRECISION_EXACT');
			await page.getByRole('button', { name: 'Submit to broker mock' }).click();

			await expect(page.getByTestId('pulse-client-outbox')).toContainText('projection blocked');
			await expect(page.getByTestId('pulse-ap-demo-queue')).toContainText('blocked');
		});
	});
}
