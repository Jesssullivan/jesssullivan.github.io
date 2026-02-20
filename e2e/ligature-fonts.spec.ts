import { test, expect } from '@playwright/test';

test.describe('Fira Code Ligature Verification', () => {
	const TEST_POST = '/blog/ligature-test-fixture';

	test.beforeEach(async ({ page }) => {
		await page.goto(TEST_POST, { waitUntil: 'networkidle' });
	});

	test('code block renders with Fira Code font-family', async ({ page }) => {
		const codeBlock = page.locator('pre code').first();
		await expect(codeBlock).toBeVisible();
		const fontFamily = await codeBlock.evaluate(
			(el) => getComputedStyle(el).fontFamily
		);
		expect(fontFamily.toLowerCase()).toContain('fira code');
	});

	test('code block has liga font-feature-settings enabled', async ({ page }) => {
		const codeBlock = page.locator('pre code').first();
		await expect(codeBlock).toBeVisible();
		const fontFeatures = await codeBlock.evaluate(
			(el) => getComputedStyle(el).fontFeatureSettings
		);
		expect(fontFeatures).toMatch(/liga/);
		expect(fontFeatures).not.toBe('normal');
	});

	test('code block has calt font-feature-settings enabled', async ({ page }) => {
		const codeBlock = page.locator('pre code').first();
		const fontFeatures = await codeBlock.evaluate(
			(el) => getComputedStyle(el).fontFeatureSettings
		);
		expect(fontFeatures).toMatch(/calt/);
	});

	test('inline code also uses Fira Code', async ({ page }) => {
		const inlineCode = page.locator('.prose > p code').first();
		await expect(inlineCode).toBeVisible();
		const fontFamily = await inlineCode.evaluate(
			(el) => getComputedStyle(el).fontFamily
		);
		expect(fontFamily.toLowerCase()).toContain('fira code');
	});

	test('Shiki-rendered spans inherit font settings', async ({ page }) => {
		const shikiSpan = page.locator('pre.shiki code span').first();
		if ((await shikiSpan.count()) > 0) {
			const fontFamily = await shikiSpan.evaluate(
				(el) => getComputedStyle(el).fontFamily
			);
			expect(fontFamily.toLowerCase()).toContain('fira code');
			const fontFeatures = await shikiSpan.evaluate(
				(el) => getComputedStyle(el).fontFeatureSettings
			);
			expect(fontFeatures).not.toBe('normal');
		}
	});

	test('no external font requests', async ({ page }) => {
		const fontRequests: string[] = [];
		page.on('request', (req) => {
			const url = req.url();
			if (url.includes('fonts.googleapis.com') || url.includes('fonts.gstatic.com')) {
				fontRequests.push(url);
			}
		});
		await page.goto(TEST_POST, { waitUntil: 'networkidle' });
		expect(fontRequests).toHaveLength(0);
	});

	test('Fira Code woff2 font file is loaded', async ({ page }) => {
		const fontRequests: string[] = [];
		page.on('response', (res) => {
			if (res.url().includes('fira-code') && res.url().endsWith('.woff2')) {
				fontRequests.push(res.url());
			}
		});
		await page.goto(TEST_POST, { waitUntil: 'networkidle' });
		expect(fontRequests.length).toBeGreaterThanOrEqual(1);
	});
});
