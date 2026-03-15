import { test, expect } from '@playwright/test';

test.describe('Signal Boosts Page', () => {
	test.beforeEach(async ({ page }) => {
		await page.goto('/signal-boosts');
	});

	test('page loads with correct title', async ({ page }) => {
		await expect(page).toHaveTitle(/Signal Boosts/);
	});

	test('has heading', async ({ page }) => {
		await expect(page.getByRole('heading', { name: /Signal Boosts/, level: 1 })).toBeVisible();
	});

	test('shows person cards with links', async ({ page }) => {
		const cards = page.locator('a.card');
		const count = await cards.count();
		expect(count).toBeGreaterThanOrEqual(1);
	});

	test('cards have names and descriptions', async ({ page }) => {
		const headings = page.locator('a.card h2');
		const count = await headings.count();
		expect(count).toBeGreaterThanOrEqual(1);
	});

	test('no horizontal overflow at 375px', async ({ page }) => {
		await page.setViewportSize({ width: 375, height: 812 });
		await page.goto('/signal-boosts');
		const body = page.locator('body');
		const box = await body.boundingBox();
		expect(box?.width).toBeLessThanOrEqual(375);
	});
});
