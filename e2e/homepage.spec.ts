import { test, expect } from '@playwright/test';

// TIN-2903 ratified contract: `/` IS the canonical reader homepage (the old
// meta-refresh redirect to /blog is retired); /blog remains the archive.
test.describe('Reader homepage', () => {
	test('/ serves the reader without redirecting', async ({ page }) => {
		await page.goto('/');
		await expect(page).toHaveURL(/\/$/);
		await expect(page.locator('section.observatory-masthead')).toBeVisible();
	});

	test('/ has canonical pointing to the apex root', async ({ page }) => {
		await page.goto('/');
		const canonical = page.locator('link[rel="canonical"]');
		await expect(canonical).toHaveAttribute('href', 'https://transscendsurvival.org/');
	});

	test('/blog still serves the archive listing', async ({ page }) => {
		await page.goto('/blog');
		await expect(page).toHaveURL(/\/blog/);
		await expect(page.getByRole('heading', { name: 'Blog' })).toBeVisible();
	});
});
