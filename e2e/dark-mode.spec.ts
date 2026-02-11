import { test, expect } from '@playwright/test';

test.describe('Dark Mode', () => {
	test('defaults to light mode', async ({ page }) => {
		await page.goto('/');
		const mode = await page.locator('html').getAttribute('data-mode');
		expect(mode).toBe('light');
	});

	test('toggle switches to dark mode', async ({ page }) => {
		await page.goto('/');
		const toggle = page.getByLabel('Toggle dark/light mode');
		await toggle.click();

		const mode = await page.locator('html').getAttribute('data-mode');
		expect(mode).toBe('dark');

		const colorScheme = await page.locator('html').evaluate(
			(el) => el.style.colorScheme
		);
		expect(colorScheme).toBe('dark');
	});

	test('toggle switches back to light mode', async ({ page }) => {
		await page.goto('/');
		const toggle = page.getByLabel('Toggle dark/light mode');

		await toggle.click();
		expect(await page.locator('html').getAttribute('data-mode')).toBe('dark');

		await toggle.click();
		expect(await page.locator('html').getAttribute('data-mode')).toBe('light');
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
