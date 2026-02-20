import { test, expect } from '@playwright/test';

test.describe('Search — main blog page', () => {
	test('search input is visible after FlexSearch loads', async ({ page }) => {
		await page.goto('/blog');
		const input = page.locator('input[type="search"]').first();
		await expect(input).toBeVisible({ timeout: 10_000 });
	});

	test('typing a query shows results', async ({ page }) => {
		await page.goto('/blog', { waitUntil: 'networkidle' });
		const input = page.locator('input[type="search"]').first();
		await expect(input).toBeVisible({ timeout: 10_000 });
		await input.fill('bird');
		await page.waitForTimeout(500);
		const dropdown = page.locator('[role="listbox"]');
		await expect(dropdown).toBeVisible({ timeout: 10_000 });
	});

	test('prefix matching works (typeahead)', async ({ page }) => {
		await page.goto('/blog', { waitUntil: 'networkidle' });
		const input = page.locator('input[type="search"]').first();
		await expect(input).toBeVisible({ timeout: 10_000 });
		await input.fill('bir');
		await page.waitForTimeout(500);
		const results = page.locator('[role="listbox"] li');
		const count = await results.count();
		expect(count).toBeGreaterThan(0);
	});

	test('typing a nonsense query shows "No results found"', async ({ page }) => {
		await page.goto('/blog');
		const input = page.locator('input[type="search"]').first();
		await expect(input).toBeVisible({ timeout: 10_000 });
		await input.fill('xyzzynonexistent12345');
		await page.waitForTimeout(500);
		await expect(page.getByText('No results found')).toBeVisible();
	});

	test('clearing query hides results', async ({ page }) => {
		await page.goto('/blog');
		const input = page.locator('input[type="search"]').first();
		await expect(input).toBeVisible({ timeout: 10_000 });
		await input.fill('solar');
		await page.waitForTimeout(500);
		await input.fill('');
		await page.waitForTimeout(300);
		const noResults = page.getByText('No results found');
		await expect(noResults).not.toBeVisible();
	});

	test('search result links point to blog posts', async ({ page }) => {
		await page.goto('/blog', { waitUntil: 'networkidle' });
		const input = page.locator('input[type="search"]').first();
		await expect(input).toBeVisible({ timeout: 10_000 });
		await input.fill('bird');
		await page.waitForTimeout(500);
		const firstResult = page.locator('[role="listbox"] a').first();
		if ((await firstResult.count()) > 0) {
			const href = await firstResult.getAttribute('href');
			expect(href).toMatch(/\/blog\//);
		}
	});

	test('keyboard navigation works', async ({ page }) => {
		await page.goto('/blog', { waitUntil: 'networkidle' });
		const input = page.locator('input[type="search"]').first();
		await expect(input).toBeVisible({ timeout: 10_000 });
		await input.fill('bird');
		await page.waitForTimeout(500);
		// Arrow down to first result
		await input.press('ArrowDown');
		const firstOption = page.locator('[role="option"]').first();
		await expect(firstOption).toHaveAttribute('aria-selected', 'true');
		// Escape closes dropdown
		await input.press('Escape');
		const dropdown = page.locator('[role="listbox"]');
		await expect(dropdown).not.toBeVisible();
	});

	test('search has ARIA combobox attributes', async ({ page }) => {
		await page.goto('/blog');
		const input = page.locator('input[type="search"]').first();
		await expect(input).toBeVisible({ timeout: 10_000 });
		await expect(input).toHaveAttribute('role', 'combobox');
		await expect(input).toHaveAttribute('aria-autocomplete', 'list');
	});
});

test.describe('Search — sidebar', () => {
	test.use({ viewport: { width: 1280, height: 800 } });

	test('sidebar search input is visible on desktop', async ({ page }) => {
		await page.goto('/blog');
		const sidebar = page.locator('aside');
		const input = sidebar.locator('input[type="search"]');
		await expect(input).toBeVisible({ timeout: 10_000 });
	});

	test('sidebar search returns results', async ({ page }) => {
		await page.goto('/blog');
		const sidebar = page.locator('aside');
		const input = sidebar.locator('input[type="search"]');
		await expect(input).toBeVisible({ timeout: 10_000 });
		await input.fill('solar');
		await page.waitForTimeout(600);
		const results = sidebar.locator('ul a');
		await expect(results.first()).toBeVisible({ timeout: 5_000 });
	});
});

test.describe('Pagefind indexing — data-pagefind-body', () => {
	test('blog post prose section has data-pagefind-body', async ({ page }) => {
		await page.goto('/blog');
		const firstPost = page.locator('article.card a').first();
		await firstPost.click();
		await page.waitForLoadState('networkidle');
		const prose = page.locator('[data-pagefind-body]');
		await expect(prose).toBeVisible();
		await expect(prose).toHaveClass(/prose/);
	});
});
