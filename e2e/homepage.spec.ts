import { test, expect } from '@playwright/test';

test.describe('Homepage', () => {
	test.beforeEach(async ({ page }) => {
		await page.goto('/');
	});

	test('renders hero with banner image and title', async ({ page }) => {
		await expect(page.locator('img[alt="Great Blue Heron"]')).toBeVisible();
		await expect(page.getByRole('heading', { name: 'Jess Sullivan', level: 1 })).toBeVisible();
		await expect(page.getByText('Lewiston, ME')).toBeVisible();
	});

	test('has correct meta tags', async ({ page }) => {
		await expect(page).toHaveTitle('Jess Sullivan | transscendsurvival.org');
		const ogTitle = page.locator('meta[property="og:title"]');
		await expect(ogTitle).toHaveAttribute('content', /Jess Sullivan/);
		const canonical = page.locator('link[rel="canonical"]');
		await expect(canonical).toHaveAttribute('href', 'https://transscendsurvival.org');
	});

	test('displays recent posts section with links', async ({ page }) => {
		await expect(page.getByRole('heading', { name: 'Recent Posts' })).toBeVisible();
		const postLinks = page.locator('a[href^="/blog/"]');
		await expect(postLinks.first()).toBeVisible();
		const count = await postLinks.count();
		expect(count).toBeGreaterThanOrEqual(1);
		expect(count).toBeLessThanOrEqual(5);
	});

	test('displays ventures section', async ({ page }) => {
		await expect(page.getByRole('heading', { name: 'Ventures' })).toBeVisible();
		await expect(page.getByText('Tinyland.dev')).toBeVisible();
		await expect(page.getByText('xoxd.ai')).toBeVisible();
	});

	test('displays experience table', async ({ page }) => {
		await expect(page.getByRole('heading', { name: 'Experience' })).toBeVisible();
		await expect(page.getByRole('cell', { name: 'Bates College' })).toBeVisible();
		await expect(page.getByRole('cell', { name: 'Macaulay Library' })).toBeVisible();
		await expect(page.getByRole('cell', { name: 'Cornell CALS' })).toBeVisible();
	});

	test('displays FOSS section with verified projects only', async ({ page }) => {
		await expect(page.getByRole('heading', { name: 'FOSS' })).toBeVisible();
		// Verified original projects
		await expect(page.getByText('quickchpl')).toBeVisible();
		await expect(page.getByText('GloriousFlywheel')).toBeVisible();
		await expect(page.getByText('XoxdWM')).toBeVisible();
		// Verified contributions (use first() to avoid strict mode with footer links)
		await expect(page.getByRole('link', { name: 'Chapel' }).first()).toBeVisible();
		await expect(page.getByRole('link', { name: 'SearXNG' }).first()).toBeVisible();
		// Should NOT contain hallucinated entries
		const body = await page.textContent('body');
		expect(body).not.toContain('BrainFlow');
		expect(body).not.toContain('MeshCore');
		expect(body).not.toContain('EyeTrackVR');
	});

	test('displays community section', async ({ page }) => {
		await expect(page.getByRole('heading', { name: 'Community' })).toBeVisible();
		await expect(page.getByText('RESF')).toBeVisible();
		await expect(page.getByText('Ithaca Generator')).toBeVisible();
	});

	test('displays beyond code section', async ({ page }) => {
		await expect(page.getByRole('heading', { name: 'Beyond Code' })).toBeVisible();
		await expect(page.getByRole('heading', { name: 'Photography' })).toBeVisible();
		await expect(page.getByRole('heading', { name: 'Music' })).toBeVisible();
		await expect(page.getByRole('heading', { name: 'Hospitality' })).toBeVisible();
	});

	test('nav links work', async ({ page }) => {
		await page.getByRole('link', { name: 'Read the Blog' }).click();
		await page.waitForURL(/\/blog/);
	});
});
