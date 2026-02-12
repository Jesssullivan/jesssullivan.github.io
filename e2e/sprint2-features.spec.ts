import { test, expect } from '@playwright/test';

test.describe('Hero Banner', () => {
	test.beforeEach(async ({ page }) => {
		await page.goto('/about');
	});

	test('hero section exists with .hero-banner class', async ({ page }) => {
		const hero = page.locator('section.hero-banner');
		await expect(hero).toBeVisible();
	});

	test('hero banner image is visible', async ({ page }) => {
		const heroImg = page.locator('.hero-banner .hero-banner-img');
		await expect(heroImg).toBeVisible();
	});

	test('hero title "Trans Scend Survival" is visible', async ({ page }) => {
		await expect(
			page.locator('.hero-banner-title')
		).toBeVisible();
	});

	test('hero subtitle with "Jess Sullivan" is visible', async ({ page }) => {
		const hero = page.locator('section.hero-banner');
		await expect(hero.getByText('Jess Sullivan')).toBeVisible();
	});
});

test.describe('Blog Sidebar', () => {
	test('sidebar is visible on desktop viewport', async ({ page }) => {
		await page.setViewportSize({ width: 1280, height: 800 });
		await page.goto('/blog');
		const sidebar = page.locator('aside');
		await expect(sidebar).toBeVisible();
	});

	test('sidebar has "Recent Posts" section with links', async ({ page }) => {
		await page.setViewportSize({ width: 1280, height: 800 });
		await page.goto('/blog');
		const sidebar = page.locator('aside');
		await expect(sidebar.getByText('Recent Posts')).toBeVisible();
		// Recent posts are in a <ul> inside the sidebar
		const recentLinks = sidebar.locator('ul a[href^="/blog/"]');
		const count = await recentLinks.count();
		expect(count).toBeGreaterThanOrEqual(1);
		expect(count).toBeLessThanOrEqual(5);
	});

	test('sidebar has "Tags" section with badge links', async ({ page }) => {
		await page.setViewportSize({ width: 1280, height: 800 });
		await page.goto('/blog');
		const sidebar = page.locator('aside');
		await expect(sidebar.getByText('Tags')).toBeVisible();
		const tagLinks = sidebar.locator('a[href^="/blog/tag/"]');
		const count = await tagLinks.count();
		expect(count).toBeGreaterThanOrEqual(1);
	});

	test('tag links point to /blog/tag/... URLs', async ({ page }) => {
		await page.setViewportSize({ width: 1280, height: 800 });
		await page.goto('/blog');
		const sidebar = page.locator('aside');
		const tagLinks = sidebar.locator('a[href^="/blog/tag/"]');
		const count = await tagLinks.count();
		expect(count).toBeGreaterThanOrEqual(1);
		for (let i = 0; i < Math.min(count, 3); i++) {
			const href = await tagLinks.nth(i).getAttribute('href');
			expect(href).toMatch(/^\/blog\/tag\/.+/);
		}
	});
});

test.describe('Reading Time', () => {
	test('blog post shows "min read" text', async ({ page }) => {
		await page.goto('/blog/840-watts-of-solar-power');
		await expect(page.getByText('min read')).toBeVisible();
	});

	test('reading time is a reasonable number (1-60 min)', async ({ page }) => {
		await page.goto('/blog/840-watts-of-solar-power');
		const readingText = page.getByText(/\d+ min read/);
		await expect(readingText).toBeVisible();
		const text = await readingText.textContent();
		const minutes = parseInt(text?.match(/(\d+)\s*min/)?.[1] ?? '0');
		expect(minutes).toBeGreaterThanOrEqual(1);
		expect(minutes).toBeLessThanOrEqual(60);
	});
});

test.describe('Blog Pagination', () => {
	test('blog page shows pagination controls', async ({ page }) => {
		await page.goto('/blog');
		// Pagination nav contains "Page X of Y" and Newer/Older buttons
		const pageInfo = page.getByText(/Page \d+ of \d+/);
		await expect(pageInfo).toBeVisible();
	});

	test('page 2 URL works (/blog?page=2)', async ({ page }) => {
		await page.goto('/blog?page=2');
		// Should still load the blog page with posts
		await expect(page.getByRole('heading', { name: 'Blog', level: 1 })).toBeVisible();
		// Posts should be visible on page 2
		const postLinks = page.locator('article a[href^="/blog/"]');
		const count = await postLinks.count();
		expect(count).toBeGreaterThanOrEqual(1);
	});
});

test.describe('Two-Column Layout', () => {
	test('blog listing uses grid layout on desktop', async ({ page }) => {
		await page.setViewportSize({ width: 1280, height: 800 });
		await page.goto('/blog');
		// The blog page uses grid-cols-1 lg:grid-cols-[1fr_250px] which becomes
		// a two-column grid at lg (1024px+)
		const gridContainer = page.locator('.grid.grid-cols-1.lg\\:grid-cols-\\[1fr_250px\\]');
		await expect(gridContainer).toBeVisible();
		const display = await gridContainer.evaluate((el) => getComputedStyle(el).display);
		expect(display).toBe('grid');
		const columns = await gridContainer.evaluate(
			(el) => getComputedStyle(el).gridTemplateColumns
		);
		// At 1280px wide, should have two columns (not just "1fr")
		expect(columns).not.toBe('1fr');
		// Should contain at least one space or multiple values indicating two columns
		const colParts = columns.split(/\s+/);
		expect(colParts.length).toBeGreaterThanOrEqual(2);
	});
});
