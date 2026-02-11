import { test, expect } from '@playwright/test';

test.describe('Dark Mode', () => {
	test('defaults to light mode', async ({ page }) => {
		await page.goto('/');
		const mode = await page.locator('html').getAttribute('data-mode');
		expect(mode).toBe('light');
	});

	test('theme switcher opens dropdown with 3 options', async ({ page }) => {
		await page.goto('/');
		const switcher = page.getByLabel('Theme settings');
		await switcher.click();

		await expect(page.getByRole('button', { name: 'Light' })).toBeVisible();
		await expect(page.getByRole('button', { name: 'Dark' })).toBeVisible();
		await expect(page.getByRole('button', { name: 'System' })).toBeVisible();
	});

	test('switching to dark mode works', async ({ page }) => {
		await page.goto('/');
		await page.getByLabel('Theme settings').click();
		await page.getByRole('button', { name: 'Dark' }).click();

		const mode = await page.locator('html').getAttribute('data-mode');
		expect(mode).toBe('dark');

		const colorScheme = await page.locator('html').evaluate((el) => el.style.colorScheme);
		expect(colorScheme).toBe('dark');
	});

	test('switching back to light mode works', async ({ page }) => {
		await page.goto('/');
		// Switch to dark
		await page.getByLabel('Theme settings').click();
		await page.getByRole('button', { name: 'Dark' }).click();
		expect(await page.locator('html').getAttribute('data-mode')).toBe('dark');

		// Switch back to light
		await page.getByLabel('Theme settings').click();
		await page.getByRole('button', { name: 'Light' }).click();
		expect(await page.locator('html').getAttribute('data-mode')).toBe('light');
	});

	test('system mode respects localStorage removal', async ({ page }) => {
		await page.goto('/');
		await page.getByLabel('Theme settings').click();
		await page.getByRole('button', { name: 'System' }).click();

		// System mode removes explicit color-mode from localStorage
		const stored = await page.evaluate(() => localStorage.getItem('color-mode'));
		expect(stored).toBeNull();
	});

	test('persists dark mode across navigation', async ({ page }) => {
		await page.goto('/');
		await page.evaluate(() => {
			localStorage.setItem('color-mode', 'dark');
		});
		await page.goto('/blog');
		const mode = await page.locator('html').getAttribute('data-mode');
		expect(mode).toBe('dark');
	});

	test('persists light mode preference', async ({ page }) => {
		await page.goto('/');
		await page.evaluate(() => {
			localStorage.setItem('color-mode', 'light');
		});
		await page.goto('/about');
		const mode = await page.locator('html').getAttribute('data-mode');
		expect(mode).toBe('light');
	});

	test('data-theme remains pine regardless of mode', async ({ page }) => {
		await page.goto('/');
		expect(await page.locator('html').getAttribute('data-theme')).toBe('pine');

		await page.evaluate(() => {
			localStorage.setItem('color-mode', 'dark');
		});
		await page.goto('/');
		expect(await page.locator('html').getAttribute('data-theme')).toBe('pine');
	});
});
