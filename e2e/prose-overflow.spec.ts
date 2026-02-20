import { test, expect } from '@playwright/test';

/**
 * Verify blog post prose content does not overflow the viewport horizontally.
 * Tests posts known to contain wide tables, long code blocks, and inline headers.
 */

const OVERFLOW_TEST_POSTS = [
	'/blog/tmpui-the-merlin-sound-id-project',
	'/blog/840-watts-of-solar-power',
	'/blog/example-photo-work',
];

const VIEWPORTS = [
	{ width: 375, height: 667, label: 'mobile' },
	{ width: 768, height: 1024, label: 'tablet' },
	{ width: 1280, height: 800, label: 'desktop' },
];

for (const vp of VIEWPORTS) {
	test.describe(`Prose overflow (${vp.label} ${vp.width}px)`, () => {
		test.use({ viewport: { width: vp.width, height: vp.height } });

		for (const slug of OVERFLOW_TEST_POSTS) {
			test(`${slug} does not overflow`, async ({ page }) => {
				await page.goto(slug);
				await page.waitForLoadState('domcontentloaded');

				const overflow = await page.evaluate(() => {
					return document.documentElement.scrollWidth > document.documentElement.clientWidth;
				});
				expect(overflow, `Page scrollWidth exceeds clientWidth at ${vp.width}px`).toBe(false);
			});
		}
	});
}
