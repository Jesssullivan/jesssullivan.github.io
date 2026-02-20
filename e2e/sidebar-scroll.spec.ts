import { test, expect, type Page } from '@playwright/test';

const DESKTOP_VIEWPORTS = [
	{ width: 1024, height: 600, label: '1024x600 (short desktop)' },
	{ width: 1024, height: 768, label: '1024x768 (standard desktop)' },
	{ width: 1440, height: 900, label: '1440x900 (wide desktop)' }
] as const;

async function visitAt(page: Page, path: string, w: number, h: number) {
	await page.setViewportSize({ width: w, height: h });
	await page.goto(path, { waitUntil: 'networkidle' });
}

test.describe('Blog listing sidebar scrollability', () => {
	for (const vp of DESKTOP_VIEWPORTS) {
		test.describe(`@ ${vp.label}`, () => {
			test.beforeEach(async ({ page }) => {
				await visitAt(page, '/blog', vp.width, vp.height);
			});

			test('sidebar has max-height and overflow-y-auto', async ({ page }) => {
				const sidebar = page.locator('.sidebar-scroll').first();
				await expect(sidebar).toBeVisible();
				const styles = await sidebar.evaluate((el) => {
					const cs = getComputedStyle(el);
					return {
						maxHeight: cs.maxHeight,
						overflowY: cs.overflowY
					};
				});
				expect(styles.maxHeight).not.toBe('none');
				expect(['auto', 'scroll']).toContain(styles.overflowY);
			});

			test('sidebar sticky top offset clears AppBar', async ({ page }) => {
				const sidebar = page.locator('.sidebar-scroll').first();
				const top = await sidebar.evaluate((el) => getComputedStyle(el).top);
				const topPx = parseFloat(top);
				expect(topPx).toBeGreaterThanOrEqual(60);
			});

			test('sidebar is independently scrollable when content overflows', async ({ page }) => {
				const sidebar = page.locator('.sidebar-scroll').first();
				const { clientHeight, scrollHeight } = await sidebar.evaluate((el) => ({
					clientHeight: el.clientHeight,
					scrollHeight: el.scrollHeight
				}));
				if (scrollHeight > clientHeight) {
					await sidebar.evaluate((el) => (el.scrollTop = 100));
					const scrollTop = await sidebar.evaluate((el) => el.scrollTop);
					expect(scrollTop).toBeGreaterThan(0);
				}
			});
		});
	}
});

test.describe('Blog post sidebar scrollability', () => {
	for (const vp of DESKTOP_VIEWPORTS) {
		test(`sidebar has max-height @ ${vp.label}`, async ({ page }) => {
			await visitAt(page, '/blog', vp.width, vp.height);
			// Navigate to a post via clicking
			const firstPost = page.locator('article.card a').first();
			await firstPost.click();
			await page.waitForLoadState('networkidle');

			const sidebar = page.locator('.sidebar-scroll').first();
			if ((await sidebar.count()) > 0) {
				const styles = await sidebar.evaluate((el) => ({
					maxHeight: getComputedStyle(el).maxHeight,
					overflowY: getComputedStyle(el).overflowY
				}));
				expect(styles.maxHeight).not.toBe('none');
				expect(['auto', 'scroll']).toContain(styles.overflowY);
			}
		});
	}
});

test.describe('TableOfContents nested sticky fix', () => {
	test('TOC nav is not independently sticky', async ({ page }) => {
		await visitAt(page, '/blog', 1440, 900);
		const firstPost = page.locator('article.card a').first();
		await firstPost.click();
		await page.waitForLoadState('networkidle');

		const tocNav = page.locator('nav:has(> ul.border-l)');
		if ((await tocNav.count()) > 0) {
			const position = await tocNav.evaluate((el) => getComputedStyle(el).position);
			expect(position).not.toBe('sticky');
		}
	});

	test('TOC has max-height for scrollability', async ({ page }) => {
		await visitAt(page, '/blog', 1440, 900);
		const firstPost = page.locator('article.card a').first();
		await firstPost.click();
		await page.waitForLoadState('networkidle');

		const tocNav = page.locator('nav:has(> ul.border-l)');
		if ((await tocNav.count()) > 0) {
			const maxH = await tocNav.evaluate((el) => getComputedStyle(el).maxHeight);
			expect(maxH).not.toBe('none');
		}
	});
});

test.describe('Sidebar hidden on mobile/tablet', () => {
	test('sidebar not visible at 320px', async ({ page }) => {
		await visitAt(page, '/blog', 320, 900);
		const sidebar = page.locator('.sidebar-scroll');
		if ((await sidebar.count()) > 0) {
			await expect(sidebar.first()).not.toBeVisible();
		}
	});

	test('sidebar not visible at 768px', async ({ page }) => {
		await visitAt(page, '/blog', 768, 1024);
		const sidebar = page.locator('.sidebar-scroll');
		if ((await sidebar.count()) > 0) {
			await expect(sidebar.first()).not.toBeVisible();
		}
	});
});
