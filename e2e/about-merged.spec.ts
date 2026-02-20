import { test, expect } from '@playwright/test';

test.describe('About (merged) page', () => {
	test.beforeEach(async ({ page }) => {
		await page.goto('/about');
	});

	test('hero banner visible with correct image', async ({ page }) => {
		await expect(page.locator('section.hero-banner')).toBeVisible();
		await expect(page.locator('img[alt="Great Blue Heron"]')).toBeVisible();
		await expect(page.locator('.hero-banner-title')).toBeVisible();
		await expect(page.getByText('Jess Sullivan')).toBeVisible();
	});

	test('banner fades on scroll', async ({ page }) => {
		const banner = page.locator('section.hero-banner');
		// Initial opacity should be 1
		const initialOpacity = await banner.evaluate((el) => getComputedStyle(el).opacity);
		expect(Number(initialOpacity)).toBe(1);

		// Scroll down
		await page.evaluate(() => window.scrollBy(0, 500));
		await page.waitForTimeout(100);

		const fadedOpacity = await banner.evaluate((el) => getComputedStyle(el).opacity);
		expect(Number(fadedOpacity)).toBeLessThan(1);
	});

	test('banner fades even with prefers-reduced-motion (scroll-driven, not animated)', async ({ page }) => {
		await page.emulateMedia({ reducedMotion: 'reduce' });
		await page.goto('/about', { waitUntil: 'networkidle' });
		const banner = page.locator('section.hero-banner');

		await page.evaluate(() => window.scrollBy(0, 500));
		await page.waitForTimeout(500);

		const opacity = await banner.evaluate((el) => getComputedStyle(el).opacity);
		expect(Number(opacity)).toBeLessThan(1);
	});

	test('etymology description text present', async ({ page }) => {
		await expect(page.getByText('Latin prefix implying')).toBeVisible();
		await expect(page.getByText('Archaic word describing')).toBeVisible();
		await expect(page.getByText('existence only worth transcending')).toBeVisible();
	});

	test('has correct page title and meta', async ({ page }) => {
		await expect(page).toHaveTitle('About | transscendsurvival.org');
		const canonical = page.locator('link[rel="canonical"]');
		await expect(canonical).toHaveAttribute('href', 'https://transscendsurvival.org/about');
	});

	test('featured and recent posts render', async ({ page }) => {
		await expect(page.getByRole('heading', { name: 'Recent Posts' })).toBeVisible();
		const postLinks = page.locator('a[href^="/blog/"]');
		await expect(postLinks.first()).toBeVisible();
	});

	test('GitHub stats images present', async ({ page }) => {
		await expect(page.locator('img[alt="GitHub Stats"]')).toBeVisible();
		await expect(page.locator('img[alt="Top Languages"]')).toBeVisible();
	});

	test('ThemedImage swaps src on dark mode toggle', async ({ page }) => {
		const statsImg = page.locator('img[alt="GitHub Stats"]');
		const lightSrc = await statsImg.getAttribute('src');
		expect(lightSrc).toContain('github-stats.svg');

		// Toggle to dark mode
		await page.evaluate(() => {
			document.documentElement.setAttribute('data-mode', 'dark');
		});
		await page.waitForTimeout(200);

		const darkSrc = await statsImg.getAttribute('src');
		expect(darkSrc).toContain('github-stats-dark.svg');
	});

	test('experience section renders with bullet lists', async ({ page }) => {
		await expect(page.getByRole('heading', { name: 'Experience' })).toBeVisible();
		await expect(page.getByRole('heading', { name: /Bates College/ })).toBeVisible();
		await expect(page.getByRole('heading', { name: /Macaulay Library/ })).toBeVisible();
		await expect(page.getByRole('heading', { name: /Cornell CALS/ })).toBeVisible();
	});

	test('ventures section renders', async ({ page }) => {
		await expect(page.getByRole('heading', { name: 'Ventures' })).toBeVisible();
		await expect(page.getByRole('link', { name: 'Tinyland.dev, Inc' })).toBeVisible();
		await expect(page.getByRole('link', { name: 'xoxd.ai', exact: true }).first()).toBeVisible();
	});

	test('FOSS section with verified projects', async ({ page }) => {
		await expect(page.getByRole('heading', { name: 'FOSS', exact: true })).toBeVisible();
		await expect(page.getByText('quickchpl')).toBeVisible();
		await expect(page.getByText('GloriousFlywheel')).toBeVisible();
		await expect(page.getByText('XoxdWM')).toBeVisible();
		// Contributions
		await expect(page.getByRole('link', { name: 'Chapel' }).first()).toBeVisible();
		await expect(page.getByRole('link', { name: 'SearXNG' }).first()).toBeVisible();
		// No hallucinated entries
		const body = await page.textContent('body');
		expect(body).not.toContain('BrainFlow');
		expect(body).not.toContain('MeshCore');
	});

	test('community section renders', async ({ page }) => {
		await expect(page.getByRole('heading', { name: 'Community' })).toBeVisible();
		await expect(page.getByText('RESF')).toBeVisible();
		await expect(page.getByText('Ithaca Generator')).toBeVisible();
	});

	test('beyond code section renders', async ({ page }) => {
		await expect(page.getByRole('heading', { name: 'Beyond Code' })).toBeVisible();
		await expect(page.getByRole('heading', { name: 'Photography' })).toBeVisible();
		await expect(page.getByRole('heading', { name: 'Music' })).toBeVisible();
		await expect(page.getByRole('heading', { name: 'Hospitality' })).toBeVisible();
	});

	test('identity badges visible', async ({ page }) => {
		// Check for at least one shields.io badge in the identity section
		const badges = page.locator('img[src*="shields.io"]');
		const count = await badges.count();
		expect(count).toBeGreaterThan(5);
	});

	test('JSON-LD Person structured data present', async ({ page }) => {
		const jsonLd = await page.evaluate(() => {
			const scripts = document.querySelectorAll('script[type="application/ld+json"]');
			for (const s of scripts) {
				try {
					const data = JSON.parse(s.textContent || '');
					if (data['@type'] === 'Person') return data;
				} catch { /* skip */ }
			}
			return null;
		});
		expect(jsonLd).not.toBeNull();
		expect(jsonLd?.name).toBe('Jess Sullivan');
		expect(jsonLd?.jobTitle).toBe('Systems Analyst (DevSecOps)');
	});

	test('learning formula image present', async ({ page }) => {
		await expect(page.locator('img[alt*="Learning"]')).toBeVisible();
	});

	test('links section renders', async ({ page }) => {
		await expect(page.getByRole('heading', { name: 'Links' })).toBeVisible();
		await expect(page.getByRole('link', { name: 'GitHub', exact: true }).first()).toBeVisible();
		await expect(page.getByRole('link', { name: 'GitLab', exact: true })).toBeVisible();
	});

	test('nav links work from about page', async ({ page }) => {
		await page.getByRole('link', { name: 'Read the Blog' }).click();
		await page.waitForURL(/\/blog/);
	});
});
