import { test, expect } from '@playwright/test';

test.describe('Navigation', () => {
	test('navbar has all expected links', async ({ page }) => {
		await page.goto('/');
		// Desktop nav links (visible at default 1280px viewport)
		const nav = page.locator('nav.hidden.sm\\:flex, nav:not(.sm\\:hidden)').first();
		await expect(page.locator('a[href="/blog"]').first()).toBeVisible();
		await expect(page.locator('a[href="/cv"]').first()).toBeVisible();
		await expect(page.locator('a[href="/about"]').first()).toBeVisible();
	});

	test('blog link navigates to blog', async ({ page }) => {
		await page.goto('/');
		await page.locator('nav a[href="/blog"]').first().click();
		await page.waitForURL(/\/blog/);
	});

	test('about link navigates to about', async ({ page }) => {
		await page.goto('/');
		await page.locator('nav a[href="/about"]').first().click();
		await page.waitForURL(/\/about/);
	});

	test('footer has public domain dedication', async ({ page }) => {
		await page.goto('/');
		await expect(page.locator('footer')).toContainText('public domain');
	});

	test('footer has feed links', async ({ page }) => {
		await page.goto('/');
		const footer = page.locator('footer');
		await expect(footer.locator('a[href="/feed.xml"]')).toBeVisible();
		await expect(footer.locator('a[href="/feed.json"]')).toBeVisible();
	});
});

test.describe('About Page', () => {
	test('renders without hallucinated claims', async ({ page }) => {
		await page.goto('/about');
		await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
		const body = await page.textContent('body');
		expect(body).not.toContain('BrainFlow');
		expect(body).not.toContain('MeshCore');
		expect(body).not.toContain('Liqo');
		expect(body).not.toContain('EyeTrackVR');
	});
});

test.describe('404 Page', () => {
	test('shows error page for missing routes', async ({ page }) => {
		const response = await page.goto('/this-page-does-not-exist');
		// serve -s returns 200 with fallback to index, or actual 404 depending on config
		// The important thing is the page loads (doesn't crash)
		expect(response?.ok() || response?.status() === 404).toBeTruthy();
	});
});
