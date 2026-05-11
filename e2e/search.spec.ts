import { test, expect, type Locator, type Page } from '@playwright/test';

const SEARCH_TIMEOUT = 10_000;

async function mainSearchInput(page: Page): Promise<Locator> {
	const input = page.getByRole('combobox', { name: 'Search blog posts' });
	await expect(input).toBeVisible({ timeout: SEARCH_TIMEOUT });
	return input;
}

async function fillMainSearch(page: Page, query: string): Promise<Locator> {
	const input = await mainSearchInput(page);
	await input.fill(query);
	await expect(input).toHaveValue(query);
	return input;
}

async function expectMainSearchResults(page: Page, query: string) {
	const input = await fillMainSearch(page, query);
	await expect(input).toHaveAttribute('aria-expanded', 'true', { timeout: SEARCH_TIMEOUT });
	const dropdown = page.locator('#search-results[role="listbox"]');
	await expect(dropdown).toBeVisible({ timeout: SEARCH_TIMEOUT });
	await expect(dropdown.locator('[role="option"]').first()).toBeVisible({ timeout: SEARCH_TIMEOUT });
	return { input, dropdown };
}

async function expectSearchInputReadable(input: Locator) {
	const initialStyles = await input.evaluate((element) => {
		const styles = window.getComputedStyle(element);
		const placeholder = window.getComputedStyle(element, '::placeholder');
		return {
			background: styles.backgroundColor,
			text: styles.color,
			caret: styles.caretColor,
			placeholder: placeholder.color,
		};
	});

	expect(initialStyles.placeholder).not.toBe(initialStyles.background);

	await input.fill('solar');
	const filledStyles = await input.evaluate((element) => {
		const styles = window.getComputedStyle(element);
		return {
			background: styles.backgroundColor,
			text: styles.color,
			caret: styles.caretColor,
		};
	});

	expect(filledStyles.text).not.toBe(filledStyles.background);
	expect(filledStyles.caret).not.toBe(filledStyles.background);
}

function todayKey() {
	const now = new Date();
	const year = now.getFullYear();
	const month = String(now.getMonth() + 1).padStart(2, '0');
	const day = String(now.getDate()).padStart(2, '0');
	return `${year}-${month}-${day}`;
}

test.describe('Search — main blog page', () => {
	test('search input is visible after FlexSearch loads', async ({ page }) => {
		await page.goto('/blog');
		await mainSearchInput(page);
	});

	test('typing a query shows results', async ({ page }) => {
		await page.goto('/blog');
		await expectMainSearchResults(page, 'bird');
	});

	test('prefix matching works (typeahead)', async ({ page }) => {
		await page.goto('/blog');
		const { dropdown } = await expectMainSearchResults(page, 'bir');
		const results = dropdown.locator('[role="option"]');
		const count = await results.count();
		expect(count).toBeGreaterThan(0);
	});

	test('typing a nonsense query shows "No results found"', async ({ page }) => {
		await page.goto('/blog');
		const input = await fillMainSearch(page, 'xyzzynonexistent12345');
		await expect(input).toHaveAttribute('aria-expanded', 'true', { timeout: SEARCH_TIMEOUT });
		await expect(page.getByText('No results found')).toBeVisible({ timeout: SEARCH_TIMEOUT });
	});

	test('clearing query hides results', async ({ page }) => {
		await page.goto('/blog');
		const { input } = await expectMainSearchResults(page, 'solar');
		await input.fill('');
		await expect(input).toHaveAttribute('aria-expanded', 'false', { timeout: SEARCH_TIMEOUT });
		const noResults = page.getByText('No results found');
		await expect(noResults).not.toBeVisible();
	});

	test('search result links point to blog posts', async ({ page }) => {
		await page.goto('/blog');
		const { dropdown } = await expectMainSearchResults(page, 'bird');
		const firstResult = dropdown.locator('a').first();
		await expect(firstResult).toBeVisible({ timeout: SEARCH_TIMEOUT });
		const href = await firstResult.getAttribute('href');
		expect(href).toMatch(/\/blog\//);
	});

	test('keyboard navigation works', async ({ page }) => {
		await page.goto('/blog');
		const { input, dropdown } = await expectMainSearchResults(page, 'bird');
		// Arrow down to first result
		await input.press('ArrowDown');
		const firstOption = dropdown.locator('[role="option"]').first();
		await expect(firstOption).toHaveAttribute('aria-selected', 'true');
		// Escape closes dropdown
		await input.press('Escape');
		await expect(input).toHaveAttribute('aria-expanded', 'false');
		await expect(dropdown).not.toBeVisible();
	});

	test('search has ARIA combobox attributes', async ({ page }) => {
		await page.goto('/blog');
		const input = await mainSearchInput(page);
		await expect(input).toHaveAttribute('role', 'combobox');
		await expect(input).toHaveAttribute('aria-autocomplete', 'list');
	});
});

test.describe('Search — color modes', () => {
	test.use({ viewport: { width: 1280, height: 800 } });

	test('main and sidebar inputs keep readable text in light and dark modes', async ({ page }) => {
		await page.goto('/blog');

		for (const mode of ['light', 'dark'] as const) {
			await page.evaluate(
				({ mode, today }) => {
					localStorage.setItem('color-mode', mode);
					localStorage.setItem('skeleton-theme', 'pine');
					localStorage.setItem('theme-switcher-nudge-last-shown', today);
				},
				{ mode, today: todayKey() },
			);
			await page.reload({ waitUntil: 'domcontentloaded' });
			await expect(page.locator('html')).toHaveAttribute('data-mode', mode);

			const inputs = page.locator('input[type="search"]');
			await expect(inputs.first()).toBeVisible({ timeout: SEARCH_TIMEOUT });
			await expectSearchInputReadable(inputs.nth(0));
			await expectSearchInputReadable(inputs.nth(1));
		}
	});
});

test.describe('Search — sidebar', () => {
	test.use({ viewport: { width: 1280, height: 800 } });

	test('sidebar search input is visible on desktop', async ({ page }) => {
		await page.goto('/blog');
		const sidebar = page.locator('aside');
		const input = sidebar.locator('input[type="search"]');
		await expect(input).toBeVisible({ timeout: SEARCH_TIMEOUT });
	});

	test('sidebar search returns results', async ({ page }) => {
		await page.goto('/blog');
		const sidebar = page.locator('aside');
		const input = sidebar.locator('input[type="search"]');
		await expect(input).toBeVisible({ timeout: SEARCH_TIMEOUT });
		await input.fill('solar');
		const results = sidebar.locator('ul a');
		await expect(results.first()).toBeVisible({ timeout: SEARCH_TIMEOUT });
	});
});

test.describe('Pagefind indexing — data-pagefind-body', () => {
	test('blog post prose section has data-pagefind-body', async ({ page }) => {
		await page.goto('/blog');
		const firstPost = page.locator('article.card a').first();
		await expect(firstPost).toBeVisible({ timeout: SEARCH_TIMEOUT });
		const href = await firstPost.getAttribute('href');
		expect(href).toBeTruthy();
		await page.goto(href!);
		const prose = page.locator('[data-pagefind-body]');
		await expect(prose).toBeVisible();
		await expect(prose).toHaveClass(/prose/);
	});
});
