import { test, expect } from '@playwright/test';

test.describe('RSS Feed', () => {
	test('returns valid XML with correct content type', async ({ request }) => {
		const response = await request.get('/feed.xml');
		expect(response.status()).toBe(200);
		const contentType = response.headers()['content-type'];
		expect(contentType).toContain('xml');

		const body = await response.text();
		expect(body).toContain('<?xml');
		expect(body).toContain('<rss');
		expect(body).toContain('<channel>');
		expect(body).toContain('<item>');
		expect(body).toContain('transscendsurvival.org');
	});

	test('includes more than 50 posts (feed is not truncated)', async ({ request }) => {
		const response = await request.get('/feed.xml');
		const body = await response.text();
		const itemCount = (body.match(/<item>/g) || []).length;
		expect(itemCount).toBeGreaterThan(50);
	});
});

test.describe('JSON Feed', () => {
	test('returns valid JSON with correct content type', async ({ request }) => {
		const response = await request.get('/feed.json');
		expect(response.status()).toBe(200);
		const contentType = response.headers()['content-type'];
		expect(contentType).toContain('json');

		const body = await response.json();
		expect(body.version).toContain('jsonfeed.org');
		expect(body.title).toBeTruthy();
		expect(body.items).toBeInstanceOf(Array);
		expect(body.items.length).toBeGreaterThan(0);
	});

	test('includes more than 50 posts (feed is not truncated)', async ({ request }) => {
		const response = await request.get('/feed.json');
		const body = await response.json();
		expect(body.items.length).toBeGreaterThan(50);
	});
});

test.describe('Sitemap', () => {
	test('returns valid XML sitemap', async ({ request }) => {
		const response = await request.get('/sitemap.xml');
		expect(response.status()).toBe(200);
		const body = await response.text();
		expect(body).toContain('<urlset');
		expect(body).toContain('<url>');
		expect(body).toContain('<loc>');
	});

	test('includes homepage and blog posts', async ({ request }) => {
		const response = await request.get('/sitemap.xml');
		const body = await response.text();
		expect(body).toContain('transscendsurvival.org/blog</loc>');
		expect(body).toContain('/blog/');
	});
});

test.describe('SEO', () => {
	test('homepage has RSS auto-discovery link', async ({ page }) => {
		await page.goto('/');
		const rssLink = page.locator('link[rel="alternate"][type="application/rss+xml"]');
		await expect(rssLink).toHaveAttribute('href', '/feed.xml');
	});

	test('homepage has JSON feed auto-discovery link', async ({ page }) => {
		await page.goto('/');
		const jsonLink = page.locator('link[rel="alternate"][type="application/feed+json"]');
		await expect(jsonLink).toHaveAttribute('href', '/feed.json');
	});

	test('homepage has canonical URL', async ({ page }) => {
		await page.goto('/');
		const canonical = page.locator('link[rel="canonical"]');
		await expect(canonical).toHaveAttribute('href', /transscendsurvival\.org/);
	});

	test('homepage has Open Graph tags', async ({ page }) => {
		await page.goto('/');
		await expect(page.locator('meta[property="og:title"]')).toHaveAttribute('content', /./);
		await expect(page.locator('meta[property="og:description"]')).toHaveAttribute('content', /./);
		await expect(page.locator('meta[property="og:type"]')).toHaveAttribute('content', 'website');
	});
});
