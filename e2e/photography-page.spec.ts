import { test, expect } from '@playwright/test';

test.describe('Photography Page', () => {
	test.beforeEach(async ({ page }) => {
		await page.goto('/photography');
	});

	test('page loads with correct title', async ({ page }) => {
		await expect(page).toHaveTitle(/Photography/);
	});

	test('has heading', async ({ page }) => {
		await expect(page.getByRole('heading', { name: /Photography/, level: 1 })).toBeVisible();
	});

	test('shows photo gallery images', async ({ page }) => {
		const images = page.locator('img[loading="lazy"]');
		const count = await images.count();
		expect(count).toBeGreaterThanOrEqual(1);
	});

	test('has correct meta tags', async ({ page }) => {
		const canonical = page.locator('link[rel="canonical"]');
		await expect(canonical).toHaveAttribute('href', 'https://transscendsurvival.org/photography');
	});

	test('no horizontal overflow at 375px', async ({ page }) => {
		await page.setViewportSize({ width: 375, height: 812 });
		await page.goto('/photography');
		const body = page.locator('body');
		const box = await body.boundingBox();
		expect(box?.width).toBeLessThanOrEqual(375);
	});
});
