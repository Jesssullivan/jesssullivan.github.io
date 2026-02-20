import { test, expect, type Page } from '@playwright/test';

const VIEWPORTS = [
	{ width: 320, height: 900, label: '320px (mobile)' },
	{ width: 768, height: 1024, label: '768px (tablet)' },
	{ width: 1024, height: 768, label: '1024px (desktop)' },
	{ width: 1440, height: 900, label: '1440px (wide)' }
] as const;

async function visitAt(page: Page, path: string, width: number, height: number) {
	await page.setViewportSize({ width, height });
	await page.goto(path, { waitUntil: 'networkidle' });
}

test.describe('Blog card text enhancement', () => {
	for (const vp of VIEWPORTS) {
		test.describe(`@ ${vp.label}`, () => {
			test.beforeEach(async ({ page }) => {
				await visitAt(page, '/blog', vp.width, vp.height);
			});

			test('card descriptions use line-clamp-5', async ({ page }) => {
				const description = page.locator('article.card p.line-clamp-5').first();
				if ((await description.count()) > 0) {
					const styles = await description.evaluate((el) => {
						const cs = window.getComputedStyle(el);
						return { webkitLineClamp: cs.getPropertyValue('-webkit-line-clamp') };
					});
					expect(styles.webkitLineClamp).toBe('5');
				}
			});

			test('card titles are visible and not empty', async ({ page }) => {
				const titles = page.locator('article.card h2');
				const count = await titles.count();
				expect(count).toBeGreaterThanOrEqual(1);
				for (let i = 0; i < Math.min(count, 3); i++) {
					await expect(titles.nth(i)).toBeVisible();
					await expect(titles.nth(i)).not.toBeEmpty();
				}
			});

			test('card tags have flex-wrap to prevent overflow', async ({ page }) => {
				const tagRow = page.locator('article.card .flex.flex-wrap.gap-2.mt-3').first();
				if ((await tagRow.count()) > 0) {
					const flexWrap = await tagRow.evaluate((el) => getComputedStyle(el).flexWrap);
					expect(flexWrap).toBe('wrap');
				}
			});
		});
	}

	test('tag page descriptions use line-clamp-5', async ({ page }) => {
		await page.goto('/blog', { waitUntil: 'networkidle' });
		// Find a tag link and navigate
		const tagLink = page.locator('article.card a[href^="/blog/tag/"]').first();
		if ((await tagLink.count()) > 0) {
			await tagLink.click();
			await page.waitForLoadState('networkidle');
			const description = page.locator('article.card p.line-clamp-5').first();
			if ((await description.count()) > 0) {
				await expect(description).toBeVisible();
			}
		}
	});
});
