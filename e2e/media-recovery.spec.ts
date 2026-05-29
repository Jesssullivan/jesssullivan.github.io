import { test, expect, type Page } from '@playwright/test';

async function collectBrokenImages(page, selector: string): Promise<string[]> {
	return page.evaluate(async (imageSelector) => {
		const imgs = Array.from(document.querySelectorAll<HTMLImageElement>(imageSelector));
		const broken: string[] = [];

		for (const img of imgs) {
			const src = img.getAttribute('src') || '';
			// Skip external images (can't load from local preview server)
			if (src.startsWith('http://') || src.startsWith('https://')) continue;
			// Skip hidden images (display:none, zero-size containers)
			if (img.offsetParent === null && getComputedStyle(img).position !== 'fixed') continue;

			img.loading = 'eager';
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
				const decode = typeof img.decode === 'function' ? img.decode().catch(() => undefined) : waitForTerminalState;
				await Promise.race([decode, waitForTerminalState]);
			}

			if (img.naturalWidth === 0) {
				broken.push(img.currentSrc || src || '(no src)');
			}
		}

		return broken;
	}, selector);
}

test.describe('Media Recovery & Image Integrity', () => {
	test('no broken images on blog listing page', async ({ page }) => {
		await page.goto('/blog', { waitUntil: 'domcontentloaded' });
		const brokenImages = await collectBrokenImages(page, 'img');
		expect(brokenImages, `Broken images: ${brokenImages.join(', ')}`).toHaveLength(0);
	});

	test('no external WordPress CDN URLs in rendered blog posts', async ({ page }) => {
		await page.goto('/blog', { waitUntil: 'domcontentloaded' });
		const firstPost = page.locator('article a[href^="/blog/"]').first();
		await firstPost.click();
		await page.waitForURL(/\/blog\/.+/, { waitUntil: 'domcontentloaded' });

		// Check page HTML for WordPress CDN URLs rather than iterating images
		const html = await page.content();
		expect(html).not.toContain('wp-content/uploads');
		expect(html).not.toMatch(/i[0-2]\.wp\.com/);
	});

	test('local post images load correctly', async ({ page }) => {
		// Navigate to a post that has images
		await page.goto('/blog', { waitUntil: 'domcontentloaded' });
		const firstPost = page.locator('article a[href^="/blog/"]').first();
		await firstPost.click();
		await page.waitForURL(/\/blog\/.+/, { waitUntil: 'domcontentloaded' });

		const brokenImages = await collectBrokenImages(page, '.prose img');
		expect(brokenImages, `Broken images in post: ${brokenImages.join(', ')}`).toHaveLength(0);
	});

	test('no requests to WordPress CDN domains during page load', async ({ page }) => {
		const wpRequests: string[] = [];
		page.on('request', (req) => {
			const url = req.url();
			if (url.includes('wp-content/uploads') || /i[0-2]\.wp\.com/.test(url)) {
				wpRequests.push(url);
			}
		});

		await page.goto('/blog', { waitUntil: 'domcontentloaded' });
		expect(wpRequests).toHaveLength(0);
	});

	test('header image loads correctly', async ({ page }) => {
		await page.goto('/', { waitUntil: 'domcontentloaded' });
		const headerImg = page.locator('.hero-banner-img');
		await expect(headerImg).toBeVisible();
		const naturalWidth = await headerImg.evaluate((el: HTMLImageElement) => el.naturalWidth);
		expect(naturalWidth).toBeGreaterThan(0);
	});
});
