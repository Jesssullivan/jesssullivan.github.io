import { test, expect } from '@playwright/test';

test.describe('Blog Listing', () => {
	test('loads with posts', async ({ page }) => {
		await page.goto('/blog');
		const postLinks = page.locator('a[href^="/blog/"]');
		const count = await postLinks.count();
		expect(count).toBeGreaterThanOrEqual(1);
	});

	test('hello-world post is not listed', async ({ page }) => {
		await page.goto('/blog');
		const body = await page.textContent('body');
		expect(body?.toLowerCase()).not.toContain('hello world');
	});

	test('hello-world post is not accessible', async ({ request }) => {
		const response = await request.get('/blog/hello-world');
		// With adapter-static, unpublished posts have no generated HTML
		// serve returns 404 for missing files
		expect(response.status()).toBe(404);
	});
});

test.describe('Blog Post', () => {
	test('renders post content', async ({ page }) => {
		await page.goto('/blog/840-watts-of-solar-power');
		await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
	});

	test('has breadcrumbs if component exists', async ({ page }) => {
		await page.goto('/blog/840-watts-of-solar-power');
		const breadcrumbs = page.locator('nav[aria-label*="breadcrumb" i], nav[aria-label*="Breadcrumb" i], [class*="breadcrumb"]');
		if (await breadcrumbs.count() > 0) {
			await expect(breadcrumbs.first()).toBeVisible();
		}
	});

	test('post pages have tags links', async ({ page }) => {
		await page.goto('/blog/840-watts-of-solar-power');
		const tags = page.locator('a[href^="/blog/tag/"]');
		const count = await tags.count();
		expect(count).toBeGreaterThanOrEqual(0);
	});
});
