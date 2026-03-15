import { test, expect } from '@playwright/test';

test.describe('Making Page', () => {
	test.beforeEach(async ({ page }) => {
		await page.goto('/making');
	});

	test('page loads with correct title', async ({ page }) => {
		await expect(page).toHaveTitle('Making | transscendsurvival.org');
	});

	test('has heading and intro', async ({ page }) => {
		await expect(page.getByRole('heading', { name: 'Making', level: 1 })).toBeVisible();
		await expect(page.getByText('3D models, music, and project demos')).toBeVisible();
	});

	test('shows SketchUp stats banner', async ({ page }) => {
		await expect(page.getByText('86.5K+')).toBeVisible();
		await expect(page.getByText('Downloads')).toBeVisible();
		await expect(page.getByText('172K+')).toBeVisible();
		await expect(page.getByText('Views')).toBeVisible();
	});

	test('shows SketchUp thumbnail grid', async ({ page }) => {
		const thumbnails = page.locator('img[src^="/images/sketchup/"]');
		const count = await thumbnails.count();
		expect(count).toBeGreaterThanOrEqual(10);
	});

	test('thumbnail links go to 3D Warehouse', async ({ page }) => {
		const link = page.locator('a[href*="3dwarehouse.sketchup.com"]').first();
		await expect(link).toBeVisible();
	});

	test('shows Thingiverse profile card', async ({ page }) => {
		await expect(page.getByRole('link', { name: 'Thingiverse' })).toBeVisible();
	});

	test('shows YouTube profile card', async ({ page }) => {
		await expect(page.getByRole('link', { name: 'YouTube' })).toBeVisible();
	});

	test('shows SoundCloud profile card', async ({ page }) => {
		await expect(page.getByRole('link', { name: 'SoundCloud' })).toBeVisible();
	});

	test('has correct meta tags', async ({ page }) => {
		const ogTitle = page.locator('meta[property="og:title"]');
		await expect(ogTitle).toHaveAttribute('content', 'Making | transscendsurvival.org');
		const canonical = page.locator('link[rel="canonical"]');
		await expect(canonical).toHaveAttribute('href', 'https://transscendsurvival.org/making');
	});

	test('no horizontal overflow at 375px', async ({ page }) => {
		await page.setViewportSize({ width: 375, height: 812 });
		await page.goto('/making');
		const body = page.locator('body');
		const box = await body.boundingBox();
		expect(box?.width).toBeLessThanOrEqual(375);
	});
});
