import { test, expect } from '@playwright/test';

test.describe('AAG Page', () => {
	test.beforeEach(async ({ page }) => {
		await page.goto('/aag');
	});

	test('page loads with correct title', async ({ page }) => {
		await expect(page).toHaveTitle(/AAG/);
	});

	test('has heading', async ({ page }) => {
		await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
	});

	test('shows poster image', async ({ page }) => {
		const img = page.locator('img[alt*="AAG"], img[src*="aag"]').first();
		await expect(img).toBeVisible();
	});

	test('no horizontal overflow at 375px', async ({ page }) => {
		await page.setViewportSize({ width: 375, height: 812 });
		await page.goto('/aag');
		const body = page.locator('body');
		const box = await body.boundingBox();
		expect(box?.width).toBeLessThanOrEqual(375);
	});
});
