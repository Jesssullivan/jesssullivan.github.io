import { test, expect } from '@playwright/test';

test.describe('Music Page', () => {
	test.beforeEach(async ({ page }) => {
		await page.goto('/music');
	});

	test('page loads with correct title', async ({ page }) => {
		await expect(page).toHaveTitle('Music | transscendsurvival.org');
	});

	test('has heading and bio text from README', async ({ page }) => {
		await expect(page.getByRole('heading', { name: 'Music', level: 1 })).toBeVisible();
		await expect(page.getByText('9-string electric')).toBeVisible();
		await expect(page.getByText('rotary Yamaha organ')).toBeVisible();
	});

	test('shows SoundCloud track embeds', async ({ page }) => {
		const embeds = page.locator('.soundcloud-embed iframe');
		const count = await embeds.count();
		expect(count).toBeGreaterThanOrEqual(3);
	});

	test('shows track titles from original posts', async ({ page }) => {
		await expect(page.getByRole('heading', { name: /Sleepish/ }).first()).toBeVisible();
		await expect(page.getByRole('heading', { name: 'Morning Metal 12.17.20' }).first()).toBeVisible();
		await expect(page.getByRole('heading', { name: 'Evening Metal 9.14.20' }).first()).toBeVisible();
	});

	test('links to SoundCloud profile', async ({ page }) => {
		const link = page.getByRole('link', { name: /SoundCloud/i });
		await expect(link).toBeVisible();
		await expect(link).toHaveAttribute('href', 'https://soundcloud.com/jesssullivan');
	});

	test('shows YouTube video section', async ({ page }) => {
		await expect(page.getByRole('heading', { name: 'Videos' })).toBeVisible();
		const ytIframe = page.locator('iframe[src*="youtube-nocookie.com"]');
		await expect(ytIframe).toBeVisible();
	});

	test('shows music blog posts section', async ({ page }) => {
		await expect(page.getByRole('heading', { name: 'Music Posts' })).toBeVisible();
		const postLinks = page.locator('a[href^="/blog/"]');
		const count = await postLinks.count();
		expect(count).toBeGreaterThanOrEqual(1);
	});

	test('has the quote from README', async ({ page }) => {
		await expect(page.getByText('baker, a minstrel or a bard')).toBeVisible();
	});

	test('has correct meta tags', async ({ page }) => {
		const ogTitle = page.locator('meta[property="og:title"]');
		await expect(ogTitle).toHaveAttribute('content', 'Music | transscendsurvival.org');
		const canonical = page.locator('link[rel="canonical"]');
		await expect(canonical).toHaveAttribute('href', 'https://transscendsurvival.org/music');
	});
});

test.describe('Music Navigation', () => {
	test('music link in navbar navigates to /music', async ({ page }) => {
		await page.goto('/');
		await page.locator('nav a[href="/music"]').first().click();
		await page.waitForURL(/\/music/);
		await expect(page.getByRole('heading', { name: 'Music', level: 1 })).toBeVisible();
	});
});
