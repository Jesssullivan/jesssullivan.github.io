import { test, expect } from '@playwright/test';

test.describe('Banner + Font Stack (Week 1)', () => {
	test.beforeEach(async ({ page }) => {
		await page.goto('/');
	});

	test('banner image displays at native 672px width, uncropped', async ({ page }) => {
		const img = page.locator('img.hero-banner-img');
		await expect(img).toBeVisible();
		await expect(img).toHaveAttribute('width', '672');
		await expect(img).toHaveAttribute('height', '219');
		await expect(img).toHaveAttribute('src', '/images/header.png');

		// Verify the image is not stretched beyond native width
		const box = await img.boundingBox();
		expect(box).not.toBeNull();
		if (box) {
			expect(box.width).toBeLessThanOrEqual(672);
		}
	});

	test('hero overlay uses Hemingway-style dark background', async ({ page }) => {
		const overlay = page.locator('.hero-banner-overlay');
		await expect(overlay).toBeVisible();
		const bgColor = await overlay.evaluate((el) => getComputedStyle(el).backgroundColor);
		// #1d1d1d = rgb(29, 29, 29)
		expect(bgColor).toBe('rgb(29, 29, 29)');
	});

	test('hero title has uppercase and letter-spacing', async ({ page }) => {
		const title = page.locator('.hero-banner-title');
		await expect(title).toBeVisible();
		const textTransform = await title.evaluate((el) => getComputedStyle(el).textTransform);
		expect(textTransform).toBe('uppercase');
		const letterSpacing = await title.evaluate((el) => getComputedStyle(el).letterSpacing);
		// 4px letter-spacing
		expect(parseFloat(letterSpacing)).toBeGreaterThanOrEqual(3.5);
	});

	test('hero title uses Raleway font', async ({ page }) => {
		const title = page.locator('.hero-banner-title');
		const fontFamily = await title.evaluate((el) => getComputedStyle(el).fontFamily);
		expect(fontFamily.toLowerCase()).toContain('raleway');
	});

	test('body uses Fira Sans font', async ({ page }) => {
		const body = page.locator('body');
		const fontFamily = await body.evaluate((el) => getComputedStyle(el).fontFamily);
		expect(fontFamily.toLowerCase()).toContain('fira sans');
	});

	test('code blocks use Fira Code with ligature settings', async ({ page }) => {
		// Navigate to a blog post with code blocks
		await page.goto('/blog');
		const firstPostLink = page.locator('a[href^="/blog/"]').first();
		if (await firstPostLink.isVisible()) {
			await firstPostLink.click();
			await page.waitForLoadState('networkidle');

			const codeBlock = page.locator('pre code').first();
			if (await codeBlock.isVisible()) {
				const fontFamily = await codeBlock.evaluate((el) => getComputedStyle(el).fontFamily);
				expect(fontFamily.toLowerCase()).toContain('fira code');
				const fontFeatures = await codeBlock.evaluate((el) => getComputedStyle(el).fontFeatureSettings);
				expect(fontFeatures).toContain('liga');
			}
		}
	});

	test('no Google Fonts external requests', async ({ page }) => {
		const externalFontRequests: string[] = [];
		page.on('request', (req) => {
			if (req.url().includes('fonts.googleapis.com') || req.url().includes('fonts.gstatic.com')) {
				externalFontRequests.push(req.url());
			}
		});

		await page.goto('/');
		await page.waitForLoadState('networkidle');
		expect(externalFontRequests).toHaveLength(0);
	});

	test('hero banner has dark (#1d1d1d) background behind image', async ({ page }) => {
		const banner = page.locator('section.hero-banner');
		const bgColor = await banner.evaluate((el) => getComputedStyle(el).backgroundColor);
		expect(bgColor).toBe('rgb(29, 29, 29)');
	});
});
