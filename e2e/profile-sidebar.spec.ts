import { test, expect } from '@playwright/test';

test.describe('Profile Sidebar', () => {
	test('visible on desktop blog listing', async ({ page }) => {
		await page.setViewportSize({ width: 1280, height: 800 });
		await page.goto('/blog');
		// The desktop sidebar is inside the hidden lg:block container
		const sidebar = page.locator('.sticky .profile-sidebar');
		await expect(sidebar).toBeVisible();
	});

	test('shows avatar image from GitHub', async ({ page }) => {
		await page.setViewportSize({ width: 1280, height: 800 });
		await page.goto('/blog');
		const avatar = page.locator('.sticky .profile-sidebar img[alt="Jess Sullivan"]');
		await expect(avatar).toBeVisible();
		const src = await avatar.getAttribute('src');
		expect(src).toContain('github.com/Jesssullivan.png');
	});

	test('shows name and title on desktop', async ({ page }) => {
		await page.setViewportSize({ width: 1280, height: 800 });
		await page.goto('/blog');
		const sidebar = page.locator('.sticky .profile-sidebar');
		await expect(sidebar.getByText('Jess Sullivan')).toBeVisible();
		await expect(sidebar.getByText('Systems Analyst')).toBeVisible();
	});

	test('shows social links', async ({ page }) => {
		await page.setViewportSize({ width: 1280, height: 800 });
		await page.goto('/blog');
		const sidebar = page.locator('.sticky .profile-sidebar');
		await expect(sidebar.getByRole('link', { name: 'GitHub' })).toBeVisible();
		await expect(sidebar.getByRole('link', { name: 'GitLab' })).toBeVisible();
		await expect(sidebar.getByRole('link', { name: 'Sponsor' })).toBeVisible();
	});

	test('shows compact layout on mobile', async ({ page }) => {
		await page.setViewportSize({ width: 375, height: 667 });
		await page.goto('/blog');
		const compact = page.locator('.profile-sidebar--compact');
		await expect(compact).toBeVisible();
		const avatar = compact.locator('img[alt="Jess Sullivan"]');
		await expect(avatar).toBeVisible();
		await expect(avatar).toHaveAttribute('width', '64');
	});

	test('desktop sidebar hidden on mobile', async ({ page }) => {
		await page.setViewportSize({ width: 375, height: 667 });
		await page.goto('/blog');
		const fullSidebar = page.locator('.sticky .profile-sidebar');
		await expect(fullSidebar).not.toBeVisible();
	});

	test('visible on blog post pages', async ({ page }) => {
		await page.setViewportSize({ width: 1280, height: 800 });
		await page.goto('/blog');
		// Click an actual post link (inside article cards), not a tag link
		const postLink = page.locator('article a[href^="/blog/"]').first();
		await postLink.click();
		await page.waitForLoadState('networkidle');
		const sidebar = page.locator('.profile-sidebar').first();
		await expect(sidebar).toBeVisible();
	});
});

test.describe('Tag Cloud', () => {
	test('renders tag badges on desktop blog page', async ({ page }) => {
		await page.setViewportSize({ width: 1280, height: 800 });
		await page.goto('/blog');
		const tagCloud = page.locator('.sticky .tag-cloud');
		await expect(tagCloud).toBeVisible();
	});

	test('has identity badges', async ({ page }) => {
		await page.setViewportSize({ width: 1280, height: 800 });
		await page.goto('/blog');
		const tagCloud = page.locator('.sticky .tag-cloud');
		await expect(tagCloud.getByText('Trans Pride')).toBeVisible();
	});

	test('has tech/FOSS badges with links', async ({ page }) => {
		await page.setViewportSize({ width: 1280, height: 800 });
		await page.goto('/blog');
		const tagCloud = page.locator('.sticky .tag-cloud');
		const chapelLink = tagCloud.getByRole('link', { name: 'Chapel' });
		await expect(chapelLink).toBeVisible();
		await expect(chapelLink).toHaveAttribute('href', 'https://chapel-lang.org/');
	});

	test('has sponsor badges', async ({ page }) => {
		await page.setViewportSize({ width: 1280, height: 800 });
		await page.goto('/blog');
		const tagCloud = page.locator('.sticky .tag-cloud');
		await expect(tagCloud.getByText('Xe Iaso')).toBeVisible();
	});

	test('has venture badges', async ({ page }) => {
		await page.setViewportSize({ width: 1280, height: 800 });
		await page.goto('/blog');
		const tagCloud = page.locator('.sticky .tag-cloud');
		await expect(tagCloud.getByRole('link', { name: 'xoxd.ai' })).toBeVisible();
		await expect(tagCloud.getByRole('link', { name: 'tinyland.dev' })).toBeVisible();
	});

	test('renders all 4 category sections', async ({ page }) => {
		await page.setViewportSize({ width: 1280, height: 800 });
		await page.goto('/blog');
		const tagCloud = page.locator('.sticky .tag-cloud');
		await expect(tagCloud.getByText('Identity')).toBeVisible();
		await expect(tagCloud.getByText('Tech / FOSS')).toBeVisible();
		await expect(tagCloud.getByText('Sponsors')).toBeVisible();
		await expect(tagCloud.getByText('Ventures')).toBeVisible();
	});
});
