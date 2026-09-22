import { test, expect } from '@playwright/test';

test.describe('Homepage reader foundation', () => {
	test('/ renders static Latest, Pulse, and Archive sections', async ({ page }) => {
		await page.goto('/');
		await expect(page.getByRole('heading', { name: 'Latest', exact: true })).toBeVisible();
		await expect(page.getByRole('heading', { name: 'Pulse', exact: true })).toBeVisible();
		await expect(page.getByRole('heading', { name: 'Archive', exact: true })).toBeVisible();
		await expect(page.getByText('No public events yet.')).toBeVisible();
		await expect(page.locator('#latest a[href^="/blog/"]').first()).toBeVisible();
		await expect(page.locator('main')).toHaveCount(1);
	});

	test('/ has its own canonical URL', async ({ page }) => {
		await page.goto('/');
		const canonical = page.locator('link[rel="canonical"]');
		await expect(canonical).toHaveAttribute('href', 'https://transscendsurvival.org/');
	});

	test('/ keeps the reader content available without JavaScript', async ({ browser }) => {
		const context = await browser.newContext({ javaScriptEnabled: false });
		const page = await context.newPage();

		await page.goto('/');
		await expect(page.getByRole('heading', { name: 'Latest', exact: true })).toBeVisible();
		await expect(page.getByRole('heading', { name: 'Pulse', exact: true })).toBeVisible();
		await expect(page.getByRole('heading', { name: 'Archive', exact: true })).toBeVisible();
		await expect(page.locator('#archive a[href^="/blog/"]').first()).toBeVisible();

		await context.close();
	});
});
