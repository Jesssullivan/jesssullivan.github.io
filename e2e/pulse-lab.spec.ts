import { test, expect } from '@playwright/test';

const VIEWPORTS = [
	{ name: 'mobile', width: 390, height: 844 },
	{ name: 'desktop', width: 1280, height: 800 },
] as const;

for (const vp of VIEWPORTS) {
	test.describe(`Pulse Lab @ ${vp.name}`, () => {
		test.use({ viewport: { width: vp.width, height: vp.height } });

		test('renders the composer and submits a note', async ({ page }) => {
			await page.goto('/pulse/lab');
			await expect(page.getByRole('heading', { name: 'Compose' })).toBeVisible();

			await page.getByRole('button', { name: '💬 note' }).click();
			await page.getByLabel('Note').fill('hello from playwright');
			await page.getByTestId('lab-submit').click();

			await expect(page.getByText('public_projected')).toBeVisible();
		});

		test('blocks an exact-location bird sighting', async ({ page }) => {
			await page.goto('/pulse/lab');
			await page.getByRole('button', { name: '🐦 bird' }).click();
			await page.getByLabel('Common name').fill('Great Horned Owl');
			await page.getByLabel('Place label').fill('home');
			await page.getByLabel('Precision').selectOption('LOCATION_PRECISION_EXACT');
			await page.getByTestId('lab-submit').click();

			await expect(page.getByText(/exact_location_not_allowlisted/)).toBeVisible();
		});

		test('blocks a private note from public projection', async ({ page }) => {
			await page.goto('/pulse/lab');
			await page.getByRole('button', { name: '💬 note' }).click();
			await page.getByLabel('Note').fill('this is private');
			await page.getByLabel('Visibility').selectOption('VISIBILITY_PRIVATE');
			await page.getByTestId('lab-submit').click();

			await expect(page.getByText(/visibility_not_public/)).toBeVisible();
		});
	});
}
