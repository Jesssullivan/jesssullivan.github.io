import { test, expect } from '@playwright/test';

test.describe('Homepage redirect', () => {
	test('/ redirects to /blog', async ({ page }) => {
		await page.goto('/');
		await expect(page).toHaveURL(/\/blog/);
	});

	test('/ has canonical pointing to /blog', async ({ page }) => {
		await page.goto('/');
		const canonical = page.locator('link[rel="canonical"]');
		await expect(canonical).toHaveAttribute('href', /\/blog/);
	});
});
