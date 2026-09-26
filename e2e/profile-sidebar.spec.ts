import { readFileSync } from 'node:fs';
import { test, expect } from '@playwright/test';

// R69: the sidebar's upstream chips come from the synced profile facts.
const facts: { merged_upstream: { project: string; url: string }[] } = JSON.parse(
	readFileSync(new URL('../static/profile/facts.json', import.meta.url), 'utf8'),
);

test.describe('Profile Sidebar', () => {
	test('visible on desktop blog listing', async ({ page }) => {
		await page.setViewportSize({ width: 1280, height: 800 });
		await page.goto('/blog');
		// The desktop sidebar is inside the hidden lg:block container
		const sidebar = page.locator('.sticky .profile-sidebar');
		await expect(sidebar).toBeVisible();
	});

	test('shows the pinned local avatar image', async ({ page }) => {
		await page.setViewportSize({ width: 1280, height: 800 });
		await page.goto('/blog');
		const avatar = page.locator('.sticky .profile-sidebar img[alt="Jess Sullivan"]');
		await expect(avatar).toBeVisible();
		const src = await avatar.getAttribute('src');
		expect(src).toBe('/images/profile-avatar.jpg');
	});

	test('shows name and codecogs formula on desktop', async ({ page }) => {
		await page.setViewportSize({ width: 1280, height: 800 });
		await page.goto('/blog');
		const sidebar = page.locator('.sticky .profile-sidebar');
		await expect(sidebar.getByText('Jess Sullivan')).toBeVisible();
		await expect(sidebar.locator('img[alt*="Learning"]')).toBeVisible();
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
		await page.waitForURL(/\/blog\/.+/, { waitUntil: 'domcontentloaded' });
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

	test('merged-upstream chips equal facts merged_upstream, in order (R69)', async ({ page }) => {
		await page.setViewportSize({ width: 1280, height: 800 });
		await page.goto('/blog');
		const tagCloud = page.locator('.sticky .tag-cloud');
		await expect(tagCloud.getByText('Merged upstream', { exact: true })).toBeVisible();
		// The first chip row is the merged-upstream category.
		const chips = tagCloud.locator('div.flex').first().locator('a');
		expect(await chips.allInnerTexts()).toEqual(facts.merged_upstream.map((u) => u.project));
		const hrefs = await chips.evaluateAll((els) => els.map((el) => el.getAttribute('href')));
		expect(hrefs).toEqual(facts.merged_upstream.map((u) => u.url));
		// The old hand-written chips are gone.
		for (const name of ['SearXNG', 'qutebrowser', 'pytest', 'Budgie Desktop', 'Tails', 'Apache Solr', 'Skeleton UI']) {
			await expect(tagCloud.getByText(name, { exact: true }), name).toHaveCount(0);
		}
	});

	test('has sponsoring badges', async ({ page }) => {
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

	test('renders all 3 category sections', async ({ page }) => {
		await page.setViewportSize({ width: 1280, height: 800 });
		await page.goto('/blog');
		const tagCloud = page.locator('.sticky .tag-cloud');
		await expect(tagCloud.getByText('Merged upstream', { exact: true })).toBeVisible();
		await expect(tagCloud.getByText('Sponsoring')).toBeVisible();
		await expect(tagCloud.getByText('Ventures')).toBeVisible();
	});
});
