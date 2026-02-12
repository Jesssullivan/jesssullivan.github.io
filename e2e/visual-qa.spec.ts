import { test, expect, type Page } from '@playwright/test';

/**
 * Visual QA tests across 4 breakpoints: 320, 768, 1024, 1440.
 *
 * Organized by feature (homepage, blog post, blog listing, dark mode),
 * with viewport iteration inside each describe block.
 */

const VIEWPORTS = [
	{ width: 320, height: 900, label: '320px (mobile)' },
	{ width: 768, height: 1024, label: '768px (tablet)' },
	{ width: 1024, height: 768, label: '1024px (desktop)' },
	{ width: 1440, height: 900, label: '1440px (wide)' },
] as const;

const BLOG_POST_PATH = '/blog/840-watts-of-solar-power';

/** Helper: set viewport and navigate, waiting for network idle. */
async function visitAt(page: Page, path: string, width: number, height: number) {
	await page.setViewportSize({ width, height });
	await page.goto(path, { waitUntil: 'networkidle' });
}

// ---------------------------------------------------------------------------
// Homepage
// ---------------------------------------------------------------------------
test.describe('Homepage — visual QA across viewports', () => {
	for (const vp of VIEWPORTS) {
		test.describe(`@ ${vp.label}`, () => {
			test.beforeEach(async ({ page }) => {
				await visitAt(page, '/about', vp.width, vp.height);
			});

			test('hero banner is visible', async ({ page }) => {
				await expect(page.locator('section.hero-banner')).toBeVisible();
				await expect(page.locator('.hero-banner-img')).toBeVisible();
			});

			test('site title is visible', async ({ page }) => {
				await expect(
					page.locator('.hero-banner-title')
				).toBeVisible();
			});

			test('navigation is accessible', async ({ page }) => {
				if (vp.width >= 640) {
					// Desktop nav: visible inline links (sm: breakpoint = 640px)
					const desktopNav = page.locator('nav.hidden.sm\\:flex');
					await expect(desktopNav).toBeVisible();
					await expect(desktopNav.getByRole('link', { name: 'Blog' })).toBeVisible();
				} else {
					// Mobile: hamburger button present
					const hamburger = page.getByRole('button', { name: 'Toggle navigation' });
					await expect(hamburger).toBeVisible();
				}
			});

			test('screenshot', async ({ page }) => {
				await page.screenshot({
					path: `test-results/visual-qa/homepage-${vp.width}.png`,
					fullPage: true,
				});
			});
		});
	}
});

// ---------------------------------------------------------------------------
// Blog Post
// ---------------------------------------------------------------------------
test.describe('Blog post — visual QA across viewports', () => {
	for (const vp of VIEWPORTS) {
		test.describe(`@ ${vp.label}`, () => {
			test.beforeEach(async ({ page }) => {
				await visitAt(page, BLOG_POST_PATH, vp.width, vp.height);
			});

			test('post heading is visible', async ({ page }) => {
				const heading = page.locator('article header h1');
				await expect(heading).toBeVisible();
				await expect(heading).not.toBeEmpty();
			});

			test('prose content is visible', async ({ page }) => {
				const prose = page.locator('.prose');
				await expect(prose).toBeVisible();
				// Ensure it actually has rendered content
				const text = await prose.textContent();
				expect((text ?? '').length).toBeGreaterThan(100);
			});

			if (vp.width >= 1024) {
				test('sidebar is visible on desktop', async ({ page }) => {
					// The sidebar column uses `hidden lg:block`
					const sidebar = page.locator('article .hidden.lg\\:block');
					await expect(sidebar).toBeVisible();
				});
			} else {
				test('sidebar is hidden on mobile/tablet', async ({ page }) => {
					const sidebar = page.locator('article .hidden.lg\\:block');
					await expect(sidebar).not.toBeVisible();
				});
			}

			test('screenshot', async ({ page }) => {
				await page.screenshot({
					path: `test-results/visual-qa/blog-post-${vp.width}.png`,
					fullPage: true,
				});
			});
		});
	}
});

// ---------------------------------------------------------------------------
// Blog Listing
// ---------------------------------------------------------------------------
test.describe('Blog listing — visual QA across viewports', () => {
	for (const vp of VIEWPORTS) {
		test.describe(`@ ${vp.label}`, () => {
			test.beforeEach(async ({ page }) => {
				await visitAt(page, '/blog', vp.width, vp.height);
			});

			test('post listing is visible', async ({ page }) => {
				// The blog listing heading
				await expect(
					page.getByRole('heading', { name: 'Blog', level: 1 })
				).toBeVisible();

				// At least one post card is rendered
				const articles = page.locator('article.card');
				await expect(articles.first()).toBeVisible();
				const count = await articles.count();
				expect(count).toBeGreaterThanOrEqual(1);
			});

			test('search input is accessible', async ({ page }) => {
				// Pagefind search loads async; the input appears once loaded.
				// Use .first() because main content and sidebar both have search inputs at wide viewports.
				const searchInput = page.locator('input[type="search"]').first();
				await expect(searchInput).toBeVisible({ timeout: 10_000 });
				await expect(searchInput).toHaveAttribute('placeholder', /[Ss]earch/);
			});

			if (vp.width >= 1024) {
				test('sidebar is visible on desktop', async ({ page }) => {
					const sidebar = page.locator('.hidden.lg\\:block');
					await expect(sidebar).toBeVisible();
				});
			} else {
				test('sidebar is hidden on mobile/tablet', async ({ page }) => {
					const sidebar = page.locator('.hidden.lg\\:block');
					await expect(sidebar).not.toBeVisible();
				});
			}

			test('screenshot', async ({ page }) => {
				await page.screenshot({
					path: `test-results/visual-qa/blog-listing-${vp.width}.png`,
					fullPage: true,
				});
			});
		});
	}
});

// ---------------------------------------------------------------------------
// Dark Mode Consistency
// ---------------------------------------------------------------------------
test.describe('Dark mode consistency', () => {
	test('homepage: switching to dark mode sets data-mode="dark"', async ({ page }) => {
		await page.setViewportSize({ width: 1440, height: 900 });
		await page.goto('/about', { waitUntil: 'networkidle' });

		// Open the theme menu and click "Dark"
		const themeButton = page.getByRole('button', { name: 'Theme settings' });
		await expect(themeButton).toBeVisible();
		await themeButton.click();

		const darkOption = page.getByRole('menuitem', { name: 'Dark' });
		await expect(darkOption).toBeVisible();
		await darkOption.click();

		// Verify data-mode attribute on <html>
		await expect(page.locator('html')).toHaveAttribute('data-mode', 'dark');

		// Take a dark mode screenshot for visual comparison
		await page.screenshot({
			path: 'test-results/visual-qa/homepage-dark-1440.png',
			fullPage: true,
		});
	});

	test('dark mode persists across navigation', async ({ page }) => {
		await page.setViewportSize({ width: 1440, height: 900 });
		await page.goto('/about', { waitUntil: 'networkidle' });

		// Switch to dark
		await page.getByRole('button', { name: 'Theme settings' }).click();
		await page.getByRole('menuitem', { name: 'Dark' }).click();
		await expect(page.locator('html')).toHaveAttribute('data-mode', 'dark');

		// Navigate to blog
		await page.goto('/blog', { waitUntil: 'networkidle' });
		await expect(page.locator('html')).toHaveAttribute('data-mode', 'dark');

		// Navigate to a post
		await page.goto(BLOG_POST_PATH, { waitUntil: 'networkidle' });
		await expect(page.locator('html')).toHaveAttribute('data-mode', 'dark');
	});
});
