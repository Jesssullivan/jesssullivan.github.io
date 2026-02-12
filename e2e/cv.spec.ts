import { test, expect } from '@playwright/test';

test.describe('CV page', () => {
	test.beforeEach(async ({ page }) => {
		await page.goto('/cv');
	});

	test('has correct title and meta', async ({ page }) => {
		await expect(page).toHaveTitle('CV | transscendsurvival.org');
		const canonical = page.locator('link[rel="canonical"]');
		await expect(canonical).toHaveAttribute('href', 'https://transscendsurvival.org/cv');
	});

	test('tab switcher renders with CV active by default', async ({ page }) => {
		const cvBtn = page.getByRole('button', { name: 'Full CV' });
		const resumeBtn = page.getByRole('button', { name: 'One-Page Resume' });
		await expect(cvBtn).toBeVisible();
		await expect(resumeBtn).toBeVisible();
		// CV tab is active by default
		await expect(cvBtn).toHaveClass(/preset-filled/);
		await expect(resumeBtn).toHaveClass(/preset-outlined/);
	});

	test('CV download and source links visible by default', async ({ page }) => {
		await expect(page.getByRole('link', { name: 'Download CV PDF' })).toBeVisible();
		await expect(page.getByRole('link', { name: 'View TeX Source' })).toBeVisible();
	});

	test('switching to resume tab updates links', async ({ page }) => {
		await page.getByRole('button', { name: 'One-Page Resume' }).click();
		await expect(page.getByRole('link', { name: 'Download Resume PDF' })).toBeVisible();
		await expect(page.getByRole('link', { name: 'View TeX Source' })).toBeVisible();
	});

	test('PDF iframe is present', async ({ page }) => {
		const iframe = page.locator('iframe[title="Jess Sullivan CV"]');
		await expect(iframe).toBeVisible();
		await expect(iframe).toHaveAttribute('src', '/cv/jess_sullivan_cv.pdf');
	});

	test('build info mentions Tectonic', async ({ page }) => {
		await expect(page.getByText('Tectonic')).toBeVisible();
	});
});
