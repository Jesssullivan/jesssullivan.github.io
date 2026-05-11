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

const NUDGE_STORAGE_KEY = 'theme-switcher-nudge-last-shown';

function localDateKeyScript() {
	const now = new Date();
	const year = now.getFullYear();
	const month = String(now.getMonth() + 1).padStart(2, '0');
	const day = String(now.getDate()).padStart(2, '0');
	return `${year}-${month}-${day}`;
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

	test('theme welcome nudge appears once per desktop day', async ({ page }) => {
		await page.setViewportSize({ width: 1280, height: 800 });
		await page.addInitScript((key) => {
			localStorage.removeItem(key);
		}, NUDGE_STORAGE_KEY);

		await page.goto('/');
		await expect(page.getByTestId('theme-welcome-nudge')).toBeVisible({ timeout: 8000 });
		await expect(page.getByTestId('theme-switcher-trigger')).toHaveAttribute('aria-expanded', 'true');

		await page.getByLabel('Dismiss theme welcome nudge').click();
		await expect(page.getByTestId('theme-welcome-nudge')).not.toBeVisible();

		const stored = await page.evaluate((key) => localStorage.getItem(key), NUDGE_STORAGE_KEY);
		const today = await page.evaluate(localDateKeyScript);
		expect(stored).toBe(today);
	});

	test('theme welcome nudge uses Skeleton/Zag popover parts', async ({ page }) => {
		await page.setViewportSize({ width: 1280, height: 800 });
		await page.addInitScript((key) => {
			localStorage.removeItem(key);
		}, NUDGE_STORAGE_KEY);

		await page.goto('/');
		await expect(page.getByTestId('theme-welcome-nudge')).toBeVisible({ timeout: 8000 });

		const trigger = page.getByTestId('theme-switcher-trigger');
		const content = page.getByTestId('theme-switcher-content');

		await expect(trigger).toHaveAttribute('data-scope', 'popover');
		await expect(trigger).toHaveAttribute('data-part', 'trigger');
		await expect(trigger).toHaveAttribute('data-state', 'open');
		await expect(content).toHaveAttribute('data-scope', 'popover');
		await expect(content).toHaveAttribute('data-part', 'content');
		await expect(content).toHaveAttribute('data-state', 'open');
		await expect(page.locator('[data-scope="popover"][data-part="arrow"]')).toBeVisible();
	});

	test('theme welcome nudge inherits dark-mode style cascade', async ({ page }) => {
		await page.setViewportSize({ width: 1280, height: 800 });
		await page.addInitScript((key) => {
			localStorage.removeItem(key);
			localStorage.setItem('color-mode', 'dark');
			localStorage.setItem('skeleton-theme', 'rose');
		}, NUDGE_STORAGE_KEY);

		await page.goto('/');
		await expect(page.getByTestId('theme-welcome-nudge')).toBeVisible({ timeout: 8000 });
		await expect(page.locator('html')).toHaveAttribute('data-mode', 'dark');
		await expect(page.locator('html')).toHaveAttribute('data-theme', 'rose');

		const styles = await page.getByTestId('theme-switcher-content').evaluate((element) => {
			const content = window.getComputedStyle(element);
			const nudge = window.getComputedStyle(element.querySelector('[data-testid="theme-welcome-nudge"]')!);
			const link = window.getComputedStyle(element.querySelector('a')!);
			return {
				background: content.backgroundColor,
				borderColor: content.borderTopColor,
				textColor: nudge.color,
				linkColor: link.color,
			};
		});

		expect(styles.background).not.toBe('rgba(0, 0, 0, 0)');
		expect(styles.borderColor).not.toBe('rgba(0, 0, 0, 0)');
		expect(styles.textColor).not.toBe(styles.background);
		expect(styles.linkColor).not.toBe(styles.textColor);
	});

	test('theme welcome nudge stays inside short desktop viewports', async ({ page }) => {
		await page.setViewportSize({ width: 768, height: 560 });
		await page.addInitScript((key) => {
			localStorage.removeItem(key);
		}, NUDGE_STORAGE_KEY);

		await page.goto('/');
		await expect(page.getByTestId('theme-welcome-nudge')).toBeVisible({ timeout: 8000 });

		const contentBox = await page.getByTestId('theme-switcher-content').boundingBox();
		expect(contentBox).not.toBeNull();
		expect(contentBox!.y + contentBox!.height).toBeLessThanOrEqual(560);
	});

	test('theme welcome nudge stays hidden when already shown today', async ({ page }) => {
		await page.setViewportSize({ width: 1280, height: 800 });
		await page.addInitScript((key) => {
			const now = new Date();
			const year = now.getFullYear();
			const month = String(now.getMonth() + 1).padStart(2, '0');
			const day = String(now.getDate()).padStart(2, '0');
			localStorage.setItem(key, `${year}-${month}-${day}`);
		}, NUDGE_STORAGE_KEY);

		await page.goto('/');
		const startedAt = Date.now();
		await page.waitForFunction((start) => Date.now() - start > 3500, startedAt);
		await expect(page.getByTestId('theme-welcome-nudge')).not.toBeVisible();
		await expect(page.getByTestId('theme-switcher-trigger')).toHaveAttribute('aria-expanded', 'false');
	});

	test('theme welcome nudge is desktop only', async ({ page }) => {
		await page.setViewportSize({ width: 390, height: 800 });
		await page.addInitScript((key) => {
			localStorage.removeItem(key);
		}, NUDGE_STORAGE_KEY);

		await page.goto('/');
		const startedAt = Date.now();
		await page.waitForFunction((start) => Date.now() - start > 3500, startedAt);
		await expect(page.getByTestId('theme-welcome-nudge')).not.toBeVisible();
	});
});
