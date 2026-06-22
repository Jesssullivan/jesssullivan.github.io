import { test, expect } from '@playwright/test';

test.describe('Signal Boosts Page', () => {
	test.beforeEach(async ({ page }) => {
		await page.goto('/signal-boosts');
	});

	test('page loads with correct title', async ({ page }) => {
		await expect(page).toHaveTitle(/Signal Boosts/);
	});

	test('has heading', async ({ page }) => {
		await expect(page.getByRole('heading', { name: /Signal Boosts/, level: 1 })).toBeVisible();
	});

	test('shows person cards with links', async ({ page }) => {
		const cards = page.locator('a.card');
		const count = await cards.count();
		expect(count).toBeGreaterThanOrEqual(1);
	});

	test('cards have names and descriptions', async ({ page }) => {
		const headings = page.locator('a.card h2');
		const count = await headings.count();
		expect(count).toBeGreaterThanOrEqual(1);
	});

	test('no horizontal overflow at 375px', async ({ page }) => {
		await page.setViewportSize({ width: 375, height: 812 });
		await page.goto('/signal-boosts');
		const body = page.locator('body');
		const box = await body.boundingBox();
		expect(box?.width).toBeLessThanOrEqual(375);
	});

	for (const width of [320, 375, 390]) {
		test(`avatars stay circular at ${width}px`, async ({ page }) => {
			await page.setViewportSize({ width, height: 900 });
			await page.goto('/signal-boosts');

			const avatars = await page.locator('a.card [data-scope="avatar"][data-part="root"]').evaluateAll((nodes) =>
				nodes.map((node) => {
					const rect = node.getBoundingClientRect();
					return { width: rect.width, height: rect.height };
				}),
			);

			expect(avatars.length).toBeGreaterThanOrEqual(1);
			for (const avatar of avatars) {
				expect(avatar.width).toBeGreaterThanOrEqual(47);
				expect(avatar.height).toBeGreaterThanOrEqual(47);
				expect(Math.abs(avatar.width - avatar.height)).toBeLessThanOrEqual(1);
			}
		});
	}

	test('avatar images fill the circular frame on mobile', async ({ page }) => {
		await page.setViewportSize({ width: 375, height: 900 });
		await page.goto('/signal-boosts');

		const imageBoxes = await page.locator('a.card [data-scope="avatar"][data-part="image"]').evaluateAll((nodes) =>
			nodes.map((node) => {
				const rect = node.getBoundingClientRect();
				return { width: rect.width, height: rect.height };
			}),
		);

		expect(imageBoxes.length).toBeGreaterThanOrEqual(1);
		for (const image of imageBoxes) {
			expect(image.width).toBeGreaterThanOrEqual(47);
			expect(image.height).toBeGreaterThanOrEqual(47);
			expect(Math.abs(image.width - image.height)).toBeLessThanOrEqual(1);
		}
	});
});
