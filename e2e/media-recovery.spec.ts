import { test, expect } from '@playwright/test';

test.describe('Media Recovery & Image Integrity', () => {
	test('no broken images on blog listing page', async ({ page }) => {
		await page.goto('/blog', { waitUntil: 'networkidle' });
		// Collect all img src values and check them via page.evaluate to handle
		// lazy-loaded and visibility-hidden images without Playwright timeout issues
		const brokenImages = await page.evaluate(async () => {
			const imgs = Array.from(document.querySelectorAll('img'));
			const broken: string[] = [];
			for (const img of imgs) {
				const src = img.getAttribute('src') || '';
				// Skip external images (can't load from local preview server)
				if (src.startsWith('http://') || src.startsWith('https://')) continue;
				// Skip hidden images (display:none, zero-size containers)
				if (img.offsetParent === null && getComputedStyle(img).position !== 'fixed') continue;
				img.loading = 'eager';
				// Force load by scrolling into view
				img.scrollIntoView({ block: 'center' });
				if (!img.complete || img.naturalWidth === 0) {
					const waitForTerminalState = new Promise<void>((resolve) => {
						const timeout = window.setTimeout(resolve, 5000);
						const done = () => {
							window.clearTimeout(timeout);
							resolve();
						};
						img.addEventListener('load', done, { once: true });
						img.addEventListener('error', done, { once: true });
					});
					const decode = typeof img.decode === 'function'
						? img.decode().catch(() => undefined)
						: waitForTerminalState;
					await Promise.race([decode, waitForTerminalState]);
				}
				if (img.naturalWidth === 0) {
					broken.push(img.currentSrc || src || '(no src)');
				}
			}
			return broken;
		});
		expect(brokenImages, `Broken images: ${brokenImages.join(', ')}`).toHaveLength(0);
	});

	test('no external WordPress CDN URLs in rendered blog posts', async ({ page }) => {
		await page.goto('/blog', { waitUntil: 'networkidle' });
		const firstPost = page.locator('article a[href^="/blog/"]').first();
		await firstPost.click();
		await page.waitForLoadState('networkidle');

		// Check page HTML for WordPress CDN URLs rather than iterating images
		const html = await page.content();
		expect(html).not.toContain('wp-content/uploads');
		expect(html).not.toMatch(/i[0-2]\.wp\.com/);
	});

	test('local post images load correctly', async ({ page }) => {
		// Navigate to a post that has images
		await page.goto('/blog', { waitUntil: 'networkidle' });
		const firstPost = page.locator('article a[href^="/blog/"]').first();
		await firstPost.click();
		await page.waitForLoadState('networkidle');

		const images = page.locator('.prose img');
		const count = await images.count();
		if (count > 0) {
			for (let i = 0; i < count; i++) {
				const img = images.nth(i);
				const naturalWidth = await img.evaluate((el: HTMLImageElement) => el.naturalWidth);
				const src = await img.getAttribute('src');
				expect(naturalWidth, `Broken image in post: ${src}`).toBeGreaterThan(0);
			}
		}
	});

	test('no requests to WordPress CDN domains during page load', async ({ page }) => {
		const wpRequests: string[] = [];
		page.on('request', (req) => {
			const url = req.url();
			if (
				url.includes('wp-content/uploads') ||
				/i[0-2]\.wp\.com/.test(url)
			) {
				wpRequests.push(url);
			}
		});

		await page.goto('/blog', { waitUntil: 'networkidle' });
		expect(wpRequests).toHaveLength(0);
	});

	test('header image loads correctly', async ({ page }) => {
		await page.goto('/', { waitUntil: 'networkidle' });
		const headerImg = page.locator('.hero-banner-img');
		await expect(headerImg).toBeVisible();
		const naturalWidth = await headerImg.evaluate((el: HTMLImageElement) => el.naturalWidth);
		expect(naturalWidth).toBeGreaterThan(0);
	});
});
