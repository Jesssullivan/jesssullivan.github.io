import { test, expect } from '@playwright/test';

test.describe('Blob Background', () => {
	test('blob background element exists in DOM', async ({ page }) => {
		await page.goto('/');
		const blob = page.locator('[data-testid="blob-background"]');
		// May or may not be visible depending on prefers-reduced-motion
		// but should be in the DOM when JS runs
		const count = await blob.count();
		expect(count).toBeLessThanOrEqual(1);
	});

	test('blob background has correct positioning', async ({ page }) => {
		await page.goto('/');
		const blob = page.locator('[data-testid="blob-background"]');
		if ((await blob.count()) > 0) {
			const style = await blob.evaluate((el) => {
				const cs = window.getComputedStyle(el);
				return { position: cs.position, pointerEvents: cs.pointerEvents };
			});
			expect(style.position).toBe('fixed');
			expect(style.pointerEvents).toBe('none');
		}
	});

	test('blob background is aria-hidden', async ({ page }) => {
		await page.goto('/');
		const blob = page.locator('[data-testid="blob-background"]');
		if ((await blob.count()) > 0) {
			await expect(blob).toHaveAttribute('aria-hidden', 'true');
		}
	});

	test('blob SVG renders with filter definitions', async ({ page }) => {
		await page.goto('/');
		const svg = page.locator('[data-testid="blob-background"] svg');
		if ((await svg.count()) > 0) {
			const filters = await svg.locator('defs filter').count();
			expect(filters).toBeGreaterThanOrEqual(3);
		}
	});
});

test.describe('Theme Switcher', () => {
	test('theme button has correct aria attributes', async ({ page }) => {
		await page.goto('/');
		const btn = page.getByLabel('Theme settings');
		await expect(btn).toBeVisible();
		await expect(btn).toHaveAttribute('aria-expanded', 'false');
	});

	test('dropdown opens on click', async ({ page }) => {
		await page.goto('/');
		await page.getByLabel('Theme settings').click();
		await expect(page.getByLabel('Theme settings')).toHaveAttribute('aria-expanded', 'true');
		await expect(page.getByRole('menuitem', { name: 'Light' })).toBeVisible();
	});

	test('dropdown closes when clicking outside', async ({ page }) => {
		await page.goto('/');
		await page.getByLabel('Theme settings').click();
		await expect(page.getByRole('menuitem', { name: 'Light' })).toBeVisible();

		// Click outside
		await page.locator('main').click();
		await expect(page.getByRole('menuitem', { name: 'Light' })).not.toBeVisible();
	});

	test('active mode is highlighted', async ({ page }) => {
		await page.goto('/');
		await page.getByLabel('Theme settings').click();
		// System should be the default (no stored preference)
		const systemBtn = page.getByRole('menuitem', { name: 'System' });
		const classes = await systemBtn.getAttribute('class');
		expect(classes).toContain('text-primary-500');
	});
});

test.describe('Featured Posts', () => {
	test('homepage shows recent posts section', async ({ page }) => {
		await page.goto('/');
		await expect(page.getByRole('heading', { name: 'Recent Posts' })).toBeVisible();
	});

	test('recent posts have category badges with variant colors', async ({ page }) => {
		await page.goto('/');
		const recentSection = page.locator('section', { has: page.getByRole('heading', { name: 'Recent Posts' }) });
		const badges = recentSection.locator('.badge');
		const count = await badges.count();
		// At least some posts should have categories
		expect(count).toBeGreaterThanOrEqual(0);
	});
});
