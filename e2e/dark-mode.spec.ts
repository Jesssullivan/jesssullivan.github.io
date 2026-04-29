import { test, expect, type Page } from '@playwright/test';

const stableRoute = '/pulse';
const blogRoute = '/blog';

async function gotoStableRoute(page: Page) {
	await page.goto(stableRoute, { waitUntil: 'domcontentloaded' });
	await expect(page.getByRole('button', { name: 'Theme settings' })).toBeVisible();
}

async function gotoRoute(page: Page, route: string) {
	await page.goto(route, { waitUntil: 'domcontentloaded' });
}

async function openThemeSettings(page: Page) {
	const trigger = page.getByRole('button', { name: 'Theme settings' });
	const lightOption = page.getByRole('button', { name: 'Set color mode to light' });

	for (let attempt = 0; attempt < 3; attempt++) {
		await trigger.click();
		try {
			await expect(lightOption).toBeVisible({ timeout: 2_000 });
			return;
		} catch {
			// The SSR button can be visible just before WebKit has hydrated the popover handler.
		}
	}

	await expect(lightOption).toBeVisible();
}

test.describe('Dark Mode', () => {
	test('defaults to light mode', async ({ page }) => {
		await gotoStableRoute(page);
		const mode = await page.locator('html').getAttribute('data-mode');
		expect(mode).toBe('light');
	});

	test('theme switcher opens popover with mode options', async ({ page }) => {
		await gotoStableRoute(page);
		await openThemeSettings(page);

		await expect(page.getByRole('button', { name: 'Set color mode to light' })).toBeVisible();
		await expect(page.getByRole('button', { name: 'Set color mode to dark' })).toBeVisible();
		await expect(page.getByRole('button', { name: 'Set color mode to system' })).toBeVisible();
	});

	test('switching to dark mode works', async ({ page }) => {
		await gotoStableRoute(page);
		await openThemeSettings(page);
		await page.getByRole('button', { name: 'Set color mode to dark' }).click();

		const mode = await page.locator('html').getAttribute('data-mode');
		expect(mode).toBe('dark');

		const colorScheme = await page.locator('html').evaluate((el) => el.style.colorScheme);
		expect(colorScheme).toBe('dark');
	});

	test('switching back to light mode works', async ({ page }) => {
		await gotoStableRoute(page);
		// Switch to dark
		await openThemeSettings(page);
		await page.getByRole('button', { name: 'Set color mode to dark' }).click();
		expect(await page.locator('html').getAttribute('data-mode')).toBe('dark');

		// Switch back to light
		await openThemeSettings(page);
		await page.getByRole('button', { name: 'Set color mode to light' }).click();
		expect(await page.locator('html').getAttribute('data-mode')).toBe('light');
	});

	test('system mode respects localStorage removal', async ({ page }) => {
		await gotoStableRoute(page);
		await openThemeSettings(page);
		await page.getByRole('button', { name: 'Set color mode to system' }).click();

		// System mode removes explicit color-mode from localStorage
		const stored = await page.evaluate(() => localStorage.getItem('color-mode'));
		expect(stored).toBeNull();
	});

	test('persists dark mode across navigation', async ({ page }) => {
		await page.addInitScript(() => {
			localStorage.setItem('color-mode', 'dark');
		});
		await gotoRoute(page, stableRoute);
		await expect(page.locator('html')).toHaveAttribute('data-mode', 'dark');
		await gotoRoute(page, blogRoute);
		await expect(page.locator('html')).toHaveAttribute('data-mode', 'dark');
	});

	test('persists light mode preference', async ({ page }) => {
		await page.addInitScript(() => {
			localStorage.setItem('color-mode', 'light');
		});
		await gotoRoute(page, blogRoute);
		await expect(page.locator('html')).toHaveAttribute('data-mode', 'light');
		await gotoRoute(page, stableRoute);
		await expect(page.locator('html')).toHaveAttribute('data-mode', 'light');
	});

	test('theme can be changed', async ({ page }) => {
		await gotoStableRoute(page);
		await openThemeSettings(page);
		await page.getByRole('button', { name: 'Set color theme to Rose' }).click();
		expect(await page.locator('html').getAttribute('data-theme')).toBe('rose');
	});
});
