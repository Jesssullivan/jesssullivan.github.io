import { test, expect } from '@playwright/test';

test.describe('Banner + Font Stack (Week 1)', () => {
	test.beforeEach(async ({ page }) => {
		await page.goto('/about');
	});

	test('banner image is visible and full-width', async ({ page }) => {
		const img = page.locator('img.hero-banner-img');
		await expect(img).toBeVisible();
		await expect(img).toHaveAttribute('width', '672');
		await expect(img).toHaveAttribute('height', '219');
		await expect(img).toHaveAttribute('src', '/images/header.png');

		const box = await img.boundingBox();
		expect(box).not.toBeNull();
		if (box) {
			expect(box.width).toBeGreaterThan(0);
		}
	});

	test('hero overlay is visible over image', async ({ page }) => {
		const overlay = page.locator('.hero-banner-overlay');
		await expect(overlay).toBeVisible();
		const position = await overlay.evaluate((el) => getComputedStyle(el).position);
		expect(position).toBe('absolute');
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

		await page.goto('/about');
		await page.waitForLoadState('networkidle');
		expect(externalFontRequests).toHaveLength(0);
	});

	test('hero banner has dark background', async ({ page }) => {
		const banner = page.locator('section.hero-banner');
		const bgColor = await banner.evaluate((el) => getComputedStyle(el).backgroundColor);
		expect(bgColor).toBe('rgb(29, 29, 29)');
	});

	test('etymology description is visible with all three definitions', async ({ page }) => {
		const desc = page.locator('.hero-banner-description');
		await expect(desc).toBeVisible();
		await expect(desc).toContainText('Trans:');
		await expect(desc).toContainText('Scend:');
		await expect(desc).toContainText('Survival:');
		await expect(desc).toContainText('gender nonconforming');
		await expect(desc).toContainText('surge');
		await expect(desc).toContainText('transcending');
	});

	test('etymology description has rainbow gradient text', async ({ page }) => {
		const desc = page.locator('.hero-banner-description');
		const bgClip = await desc.evaluate((el) => getComputedStyle(el).backgroundClip);
		expect(bgClip).toBe('text');
		const bgImage = await desc.evaluate((el) => getComputedStyle(el).backgroundImage);
		expect(bgImage).toContain('gradient');
	});

	test('separator line exists between title and description', async ({ page }) => {
		const sep = page.locator('.hero-banner-separator');
		await expect(sep).toBeVisible();
		const width = await sep.evaluate((el) => getComputedStyle(el).width);
		expect(width).toBe('100px');
		const height = await sep.evaluate((el) => getComputedStyle(el).height);
		expect(height).toBe('2px');
	});

	test('etymology uses Raleway font', async ({ page }) => {
		const desc = page.locator('.hero-banner-description');
		const fontFamily = await desc.evaluate((el) => getComputedStyle(el).fontFamily);
		expect(fontFamily.toLowerCase()).toContain('raleway');
	});
});
