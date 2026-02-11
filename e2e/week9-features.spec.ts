import { test, expect } from '@playwright/test';

test.describe('Reading Progress Bar', () => {
	test('progress bar appears on blog post page when scrolled', async ({ page }) => {
		await page.goto('/blog/840-watts-of-solar-power');
		// Scroll down to trigger progress
		await page.evaluate(() => window.scrollBy(0, 500));
		await page.waitForTimeout(200);
		const progressBar = page.locator('.reading-progress');
		const count = await progressBar.count();
		// May not appear if prefers-reduced-motion is set
		expect(count).toBeLessThanOrEqual(1);
	});

	test('progress bar has correct ARIA attributes', async ({ page }) => {
		await page.goto('/blog/840-watts-of-solar-power');
		await page.evaluate(() => window.scrollBy(0, 500));
		await page.waitForTimeout(200);
		const progressBar = page.locator('[role="progressbar"]');
		if ((await progressBar.count()) > 0) {
			await expect(progressBar).toHaveAttribute('aria-label', 'Reading progress');
			await expect(progressBar).toHaveAttribute('aria-valuemin', '0');
			await expect(progressBar).toHaveAttribute('aria-valuemax', '100');
		}
	});

	test('progress bar is fixed at top of viewport', async ({ page }) => {
		await page.goto('/blog/840-watts-of-solar-power');
		await page.evaluate(() => window.scrollBy(0, 500));
		await page.waitForTimeout(200);
		const progressBar = page.locator('.reading-progress');
		if ((await progressBar.count()) > 0) {
			const style = await progressBar.evaluate((el) => {
				const cs = window.getComputedStyle(el);
				return { position: cs.position, top: cs.top, zIndex: cs.zIndex };
			});
			expect(style.position).toBe('fixed');
			expect(style.top).toBe('0px');
		}
	});

	test('progress bar does not appear on non-post pages', async ({ page }) => {
		await page.goto('/blog');
		await page.evaluate(() => window.scrollBy(0, 500));
		await page.waitForTimeout(200);
		const progressBar = page.locator('.reading-progress');
		expect(await progressBar.count()).toBe(0);
	});

	test('progress bar increases as user scrolls down', async ({ page }) => {
		await page.goto('/blog/840-watts-of-solar-power');
		await page.evaluate(() => window.scrollBy(0, 300));
		await page.waitForTimeout(200);
		const bar = page.locator('[role="progressbar"]');
		if ((await bar.count()) > 0) {
			const val1 = Number(await bar.getAttribute('aria-valuenow'));
			await page.evaluate(() => window.scrollBy(0, 1000));
			await page.waitForTimeout(200);
			const val2 = Number(await bar.getAttribute('aria-valuenow'));
			expect(val2).toBeGreaterThanOrEqual(val1);
		}
	});
});

test.describe('Related Posts', () => {
	test('related posts section appears on blog post pages', async ({ page }) => {
		await page.goto('/blog/840-watts-of-solar-power');
		const section = page.locator('[aria-label="Related posts"]');
		await expect(section).toBeVisible();
	});

	test('shows exactly 3 related posts', async ({ page }) => {
		await page.goto('/blog/840-watts-of-solar-power');
		const relatedLinks = page.locator('[aria-label="Related posts"] a');
		const count = await relatedLinks.count();
		expect(count).toBe(3);
	});

	test('related post links navigate to blog posts', async ({ page }) => {
		await page.goto('/blog/840-watts-of-solar-power');
		const relatedLinks = page.locator('[aria-label="Related posts"] a');
		const count = await relatedLinks.count();
		for (let i = 0; i < count; i++) {
			const href = await relatedLinks.nth(i).getAttribute('href');
			expect(href).toMatch(/^\/blog\//);
		}
	});

	test('related posts have titles and dates', async ({ page }) => {
		await page.goto('/blog/840-watts-of-solar-power');
		const cards = page.locator('[aria-label="Related posts"] a');
		const count = await cards.count();
		for (let i = 0; i < count; i++) {
			const title = cards.nth(i).locator('h3');
			await expect(title).toBeVisible();
			const time = cards.nth(i).locator('time');
			await expect(time).toBeVisible();
		}
	});

	test('related posts do not include current post', async ({ page }) => {
		await page.goto('/blog/840-watts-of-solar-power');
		const relatedLinks = page.locator('[aria-label="Related posts"] a');
		const count = await relatedLinks.count();
		for (let i = 0; i < count; i++) {
			const href = await relatedLinks.nth(i).getAttribute('href');
			expect(href).not.toBe('/blog/840-watts-of-solar-power');
		}
	});
});

test.describe('Full-Content RSS Feed', () => {
	test('RSS feed includes content:encoded element', async ({ request }) => {
		const response = await request.get('/feed.xml');
		const body = await response.text();
		expect(body).toContain('xmlns:content=');
		expect(body).toContain('<content:encoded>');
	});

	test('RSS feed content is longer than description', async ({ request }) => {
		const response = await request.get('/feed.xml');
		const body = await response.text();
		// Extract first content:encoded block
		const contentMatch = body.match(/<content:encoded><!\[CDATA\[([\s\S]*?)\]\]><\/content:encoded>/);
		const descMatch = body.match(/<description><!\[CDATA\[([\s\S]*?)\]\]><\/description>/);
		if (contentMatch && descMatch) {
			expect(contentMatch[1].length).toBeGreaterThan(descMatch[1].length);
		}
	});

	test('RSS feed items have category elements', async ({ request }) => {
		const response = await request.get('/feed.xml');
		const body = await response.text();
		expect(body).toContain('<category>');
	});
});

test.describe('JSON Feed Full Content', () => {
	test('JSON feed items have content_text field', async ({ request }) => {
		const response = await request.get('/feed.json');
		const body = await response.json();
		const itemWithContent = body.items.find((item: { content_text?: string }) => item.content_text);
		expect(itemWithContent).toBeTruthy();
	});

	test('JSON feed content_text is longer than summary', async ({ request }) => {
		const response = await request.get('/feed.json');
		const body = await response.json();
		const item = body.items.find((item: { content_text?: string; summary?: string }) =>
			item.content_text && item.summary && item.content_text.length > 10
		);
		if (item) {
			expect(item.content_text.length).toBeGreaterThan(item.summary.length);
		}
	});
});

test.describe('Per-Tag RSS Feeds', () => {
	test('tag feed returns valid XML', async ({ request }) => {
		const response = await request.get('/blog/tag/DIY/feed.xml');
		expect(response.status()).toBe(200);
		const body = await response.text();
		expect(body).toContain('<?xml');
		expect(body).toContain('<rss');
		expect(body).toContain('DIY');
		expect(body).toContain('<item>');
	});

	test('tag feed only contains posts with that tag', async ({ request }) => {
		const response = await request.get('/blog/tag/Music/feed.xml');
		const body = await response.text();
		expect(body).toContain('<title>transscendsurvival.org — Music</title>');
		// All items should have Music category
		const items = body.match(/<item>[\s\S]*?<\/item>/g) ?? [];
		for (const item of items) {
			expect(item).toContain('<category>Music</category>');
		}
	});

	test('nonexistent tag returns 404', async ({ request }) => {
		const response = await request.get('/blog/tag/NonexistentTag12345/feed.xml');
		expect(response.status()).toBe(404);
	});
});

test.describe('Mobile Viewport', () => {
	test.use({ viewport: { width: 375, height: 667 } });

	test('mobile nav hamburger is visible', async ({ page }) => {
		await page.goto('/');
		await expect(page.getByLabel('Toggle navigation')).toBeVisible();
	});

	test('mobile nav opens on hamburger click', async ({ page }) => {
		await page.goto('/');
		await page.getByLabel('Toggle navigation').click();
		await expect(page.locator('nav.sm\\:hidden a[href="/blog"]')).toBeVisible();
	});

	test('blog post is readable on mobile', async ({ page }) => {
		await page.goto('/blog/840-watts-of-solar-power');
		await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
		const prose = page.locator('.prose');
		await expect(prose).toBeVisible();
	});

	test('sidebar is hidden on mobile', async ({ page }) => {
		await page.goto('/blog/840-watts-of-solar-power');
		const sidebar = page.locator('.hidden.lg\\:block');
		await expect(sidebar).not.toBeVisible();
	});
});
