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

	test('tab switcher renders with Resume active by default', async ({ page }) => {
		const resumeBtn = page.getByRole('button', { name: 'Resume', exact: true });
		const targetedBtn = page.getByRole('button', { name: 'Resume — Targeted' });
		const cvBtn = page.getByRole('button', { name: 'Full CV' });
		await expect(resumeBtn).toBeVisible();
		await expect(targetedBtn).toBeVisible();
		await expect(cvBtn).toBeVisible();
		await expect(resumeBtn).toHaveClass(/preset-filled/);
		await expect(targetedBtn).toHaveClass(/preset-outlined/);
		await expect(cvBtn).toHaveClass(/preset-outlined/);
	});

	test('Resume download and source links visible by default', async ({ page }) => {
		await expect(page.getByRole('link', { name: 'Download Resume PDF' })).toBeVisible();
		await expect(page.getByRole('link', { name: 'View TeX Source' })).toBeVisible();
	});

	test('switching to Full CV tab updates links', async ({ page }) => {
		await page.getByRole('button', { name: 'Full CV' }).click();
		await expect(page.getByRole('link', { name: 'Download Full CV PDF' })).toBeVisible();
		await expect(page.getByRole('link', { name: 'View TeX Source' })).toBeVisible();
	});

	test('PDF iframe is present', async ({ page }) => {
		const iframe = page.locator('iframe[title="Jess Sullivan Resume"]');
		await expect(iframe).toBeVisible();
		await expect(iframe).toHaveAttribute('src', '/cv/jess_sullivan_resume.pdf');
	});

	test('build info mentions Tectonic', async ({ page }) => {
		await expect(page.getByRole('link', { name: 'Tectonic', exact: true })).toBeVisible();
	});
});
