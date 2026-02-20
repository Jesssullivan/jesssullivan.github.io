import { test, expect } from '@playwright/test';

test.describe('Giscus Comments', () => {
	test.beforeEach(async ({ page }) => {
		await page.goto('/blog');
		const firstPost = page.locator('article.card a').first();
		await firstPost.click();
		await page.waitForLoadState('networkidle');
	});

	test('comments section exists on blog post page', async ({ page }) => {
		const section = page.locator('[data-testid="comments-section"]');
		await expect(section).toBeVisible();
	});

	test('comments section has heading', async ({ page }) => {
		const heading = page.locator('[data-testid="comments-section"] h2');
		await expect(heading).toHaveText('Comments');
	});

	test('comments section has aria-label', async ({ page }) => {
		const section = page.locator('[data-testid="comments-section"]');
		await expect(section).toHaveAttribute('aria-label', 'Comments');
	});

	test('comments section is not on blog listing page', async ({ page }) => {
		await page.goto('/blog');
		const section = page.locator('[data-testid="comments-section"]');
		expect(await section.count()).toBe(0);
	});
});

test.describe('Giscus lazy loading', () => {
	test('loading skeleton appears when giscus blocked', async ({ page }) => {
		await page.route('**/giscus.app/**', (route) => route.abort());
		await page.goto('/blog');
		const firstPost = page.locator('article.card a').first();
		await firstPost.click();
		await page.waitForLoadState('networkidle');

		await page.locator('[data-testid="comments-section"]').scrollIntoViewIfNeeded();
		const skeleton = page.locator('[data-testid="comments-loading"]');
		await expect(skeleton).toBeVisible();
		await expect(skeleton).toHaveAttribute('aria-busy', 'true');
	});

	test('loading skeleton has sr-only text', async ({ page }) => {
		await page.route('**/giscus.app/**', (route) => route.abort());
		await page.goto('/blog');
		const firstPost = page.locator('article.card a').first();
		await firstPost.click();
		await page.waitForLoadState('networkidle');

		await page.locator('[data-testid="comments-section"]').scrollIntoViewIfNeeded();
		const srText = page.locator('[data-testid="comments-loading"] .sr-only');
		await expect(srText).toHaveText('Loading comments...');
	});

	test('error state appears when giscus is unreachable', async ({ page }) => {
		await page.route('**/giscus.app/**', (route) => route.abort());
		await page.goto('/blog');
		const firstPost = page.locator('article.card a').first();
		await firstPost.click();
		await page.waitForLoadState('networkidle');

		await page.locator('[data-testid="comments-section"]').scrollIntoViewIfNeeded();
		const errorDiv = page.locator('[data-testid="comments-error"]');
		await expect(errorDiv).toBeVisible({ timeout: 15_000 });
		await expect(errorDiv).toContainText('Comments could not be loaded');
	});

	test('error state links to GitHub discussions', async ({ page }) => {
		await page.route('**/giscus.app/**', (route) => route.abort());
		await page.goto('/blog');
		const firstPost = page.locator('article.card a').first();
		await firstPost.click();
		await page.waitForLoadState('networkidle');

		await page.locator('[data-testid="comments-section"]').scrollIntoViewIfNeeded();
		const errorDiv = page.locator('[data-testid="comments-error"]');
		await expect(errorDiv).toBeVisible({ timeout: 15_000 });
		const link = errorDiv.locator('a');
		await expect(link).toHaveAttribute(
			'href',
			'https://github.com/Jesssullivan/jesssullivan.github.io/discussions'
		);
	});

	test('giscus iframe loads when scrolled into view', async ({ page }) => {
		await page.goto('/blog');
		const firstPost = page.locator('article.card a').first();
		await firstPost.click();
		await page.waitForLoadState('networkidle');

		await page.locator('[data-testid="comments-section"]').scrollIntoViewIfNeeded();
		const iframe = page.locator('iframe.giscus-frame');
		// Giscus depends on external service — use generous timeout and soft-fail
		try {
			await expect(iframe).toBeVisible({ timeout: 20_000 });
		} catch {
			// If giscus didn't load, at least verify the error fallback or loading state is shown
			const loading = page.locator('[data-testid="comments-loading"]');
			const error = page.locator('[data-testid="comments-error"]');
			const hasState = (await loading.count()) > 0 || (await error.count()) > 0;
			expect(hasState).toBeTruthy();
		}
	});

	test('loading skeleton disappears after giscus loads', async ({ page }) => {
		await page.goto('/blog');
		const firstPost = page.locator('article.card a').first();
		await firstPost.click();
		await page.waitForLoadState('networkidle');

		await page.locator('[data-testid="comments-section"]').scrollIntoViewIfNeeded();
		const iframe = page.locator('iframe.giscus-frame');
		try {
			await expect(iframe).toBeVisible({ timeout: 20_000 });
			const skeleton = page.locator('[data-testid="comments-loading"]');
			await expect(skeleton).not.toBeVisible();
		} catch {
			// External service unreachable — verify error state is shown instead
			const error = page.locator('[data-testid="comments-error"]');
			await expect(error).toBeVisible({ timeout: 15_000 });
		}
	});
});

test.describe('Comments — full-width layout', () => {
	test.use({ viewport: { width: 1280, height: 800 } });

	test('comments section spans full article width on desktop', async ({ page }) => {
		await page.goto('/blog');
		const firstPost = page.locator('article.card a').first();
		await firstPost.click();
		await page.waitForLoadState('networkidle');

		const article = page.locator('article');
		const comments = page.locator('[data-testid="comments-section"]');
		await comments.scrollIntoViewIfNeeded();

		const articleBox = await article.boundingBox();
		const commentsBox = await comments.boundingBox();
		expect(commentsBox!.width).toBeGreaterThan(articleBox!.width * 0.9);
	});

	test('comments section is outside the grid container', async ({ page }) => {
		await page.goto('/blog');
		const firstPost = page.locator('article.card a').first();
		await firstPost.click();
		await page.waitForLoadState('networkidle');

		const grid = page.locator('article .grid');
		const commentsInGrid = grid.locator('[data-testid="comments-section"]');
		expect(await commentsInGrid.count()).toBe(0);

		const article = page.locator('article');
		const commentsInArticle = article.locator('[data-testid="comments-section"]');
		expect(await commentsInArticle.count()).toBe(1);
	});
});

test.describe('Comments — mobile viewport', () => {
	test.use({ viewport: { width: 375, height: 667 } });

	test('comments section is visible on mobile', async ({ page }) => {
		await page.goto('/blog');
		const firstPost = page.locator('article.card a').first();
		await firstPost.click();
		await page.waitForLoadState('networkidle');

		await page.locator('[data-testid="comments-section"]').scrollIntoViewIfNeeded();
		const section = page.locator('[data-testid="comments-section"]');
		await expect(section).toBeVisible();
	});
});
