import { readFileSync } from 'node:fs';
import { test, expect, type Page } from '@playwright/test';

// R53: the about page renders static/profile/facts.json (synced from
// spear_resumes); assert against the same file so a re-sync moves both.
type Facts = {
	identity: { name: string };
	roles: { title: string; org: string; end: number | string }[];
	ventures: { name: string; url?: string }[];
	merged_upstream: { project: string; url: string }[];
	community: string[];
	links: { label: string; url: string }[];
	images: { slot: string; alt: string }[];
};
const facts: Facts = JSON.parse(readFileSync(new URL('../static/profile/facts.json', import.meta.url), 'utf8'));

async function openThemeSettings(page: Page) {
	const trigger = page.getByRole('button', { name: 'Theme settings' });
	const darkOption = page.getByRole('button', { name: 'Set color mode to dark' });

	await expect(trigger).toBeVisible();
	for (let attempt = 0; attempt < 3; attempt++) {
		await trigger.click();
		try {
			await expect(darkOption).toBeVisible({ timeout: 2_000 });
			return;
		} catch {
			// The SSR button can be visible just before WebKit has hydrated the popover handler.
		}
	}

	await expect(darkOption).toBeVisible();
}

test.describe('About (merged) page', () => {
	test.beforeEach(async ({ page }) => {
		await page.addInitScript(() => {
			localStorage.setItem('color-mode', 'light');
		});
		await page.goto('/about', { waitUntil: 'domcontentloaded' });
		await expect(page.locator('section.hero-banner')).toBeVisible();
	});

	test('hero banner visible with correct image', async ({ page }) => {
		await expect(page.locator('section.hero-banner')).toBeVisible();
		await expect(page.locator('img[alt="Great Blue Heron"]')).toBeVisible();
		await expect(page.locator('.hero-banner-title')).toBeVisible();
		await expect(page.locator('section.hero-banner').getByText('Jess Sullivan')).toBeVisible();
	});

	test('banner fades on scroll', async ({ page, browserName }) => {
		test.skip(browserName === 'webkit', 'Scroll timing differs on WebKit');
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

	test('banner fades even with prefers-reduced-motion (scroll-driven, not animated)', async ({ page, browserName }) => {
		test.skip(browserName === 'webkit', 'Scroll-driven fade timing differs on WebKit');
		await page.emulateMedia({ reducedMotion: 'reduce' });
		await page.goto('/about', { waitUntil: 'domcontentloaded' });
		const banner = page.locator('section.hero-banner');
		await expect(banner).toBeVisible();

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

	test('facts charts present (project map, timeline, upstream, languages)', async ({ page }) => {
		const main = page.locator('#main-content');
		await expect(main.locator('img[src="/profile/svg/project-map-light.svg"]')).toBeVisible();
		await expect(main.locator('img[src="/profile/svg/timeline-light.svg"]')).toHaveCount(1);
		await expect(main.locator('img[src="/profile/svg/upstream-light.svg"]')).toHaveCount(1);
		await expect(main.locator('img[src="/profile/svg/languages-light.svg"]')).toHaveCount(1);
	});

	test('ThemedImage swaps src on dark mode toggle', async ({ page }) => {
		const mapImg = page.locator('#main-content').locator('img[src*="/profile/svg/project-map-"]');
		await expect(mapImg).toHaveAttribute('src', /project-map-light\.svg/);

		await openThemeSettings(page);
		await page.getByRole('button', { name: 'Set color mode to dark' }).click();
		await expect(page.locator('html')).toHaveAttribute('data-mode', 'dark');
		await expect(mapImg).toHaveAttribute('src', /project-map-dark\.svg/);
	});

	test('experience section renders every facts role', async ({ page }) => {
		const main = page.locator('#main-content');
		await expect(main.getByRole('heading', { name: 'Experience' })).toBeVisible();
		for (const role of facts.roles) {
			await expect(main.getByRole('heading', { name: `${role.title} \u2014 ${role.org}` })).toBeVisible();
		}
		await expect(main.getByRole('heading', { name: /Bates College/ })).toBeVisible();
		await expect(main.getByRole('heading', { name: /Macaulay Library/ })).toBeVisible();
		await expect(main.getByRole('heading', { name: /Cornell CALS/ })).toBeVisible();
	});

	test('ventures section renders facts ventures with xoxd.ai', async ({ page }) => {
		const ventures = page.locator('#ventures');
		await expect(ventures.getByRole('heading', { name: 'Ventures' })).toBeVisible();
		const xoxd = facts.ventures.find((v) => v.name === 'xoxd.ai');
		expect(xoxd?.url).toBe('https://xoxd.ai');
		await expect(ventures.getByRole('link', { name: 'Visit xoxd.ai' })).toHaveAttribute('href', 'https://xoxd.ai');
		for (const v of facts.ventures) {
			await expect(ventures.getByText(v.name, { exact: true }).or(ventures.getByRole('link', { name: `Visit ${v.name}` })).first()).toBeVisible();
		}
	});

	test('projects section renders the map table', async ({ page }) => {
		const projects = page.locator('#projects');
		await expect(projects.getByRole('heading', { name: 'Projects' })).toBeVisible();
		const rows = projects.locator('[data-testid="project-table"] tbody tr');
		expect(await rows.count()).toBeGreaterThan(40);
	});

	test('merged upstream lists every facts project with its PR link', async ({ page }) => {
		const upstream = page.locator('#upstream');
		await expect(upstream.getByRole('heading', { name: 'Merged Upstream' })).toBeVisible();
		for (const u of facts.merged_upstream) {
			await expect(upstream.getByRole('link', { name: u.project, exact: true })).toHaveAttribute('href', u.url);
		}
		for (const name of ['llama.cpp', 'KeePassXC', 'rspamd', 'nixpkgs']) {
			await expect(upstream.getByRole('link', { name, exact: true })).toBeVisible();
		}
	});

	test('community section renders facts community', async ({ page }) => {
		const community = page.locator('#community');
		await expect(community.getByRole('heading', { name: 'Community' })).toBeVisible();
		for (const line of facts.community) {
			await expect(community.getByText(line, { exact: true })).toBeVisible();
		}
		await expect(community.getByText(/Rocky Enterprise Linux Foundation/)).toBeVisible();
		await expect(community.getByText(/Ithaca Generator/)).toBeVisible();
	});

	test('no Tinyland venture or link, no counter badges, no RPM kernel', async ({ page }) => {
		// Facts-driven sections and Links only: post titles in the lists above
		// are blog content and may legitimately mention the Tinyland broker.
		const sections = ['#profile-intro', '#experience', '#ventures', '#projects', '#upstream', '#community', '#publications', '[data-testid="profile-links"]'];
		for (const sel of sections) {
			const section = page.locator(sel);
			await expect(section).toHaveCount(1);
			const text = (await section.textContent()) ?? '';
			expect(text, sel).not.toMatch(/Tinyland/i);
			expect(text, sel).not.toMatch(/RPM kernel/i);
			expect(await section.locator('a[href*="tinyland"]').count(), sel).toBe(0);
		}
		expect(await page.locator('img[src*="shields.io"]').count()).toBe(0);
		expect(await page.locator('img[src*="demolab"]').count()).toBe(0);
		expect(await page.locator('img[src*="komarev"]').count()).toBe(0);
		expect(await page.locator('img[src*="github-profile"]').count()).toBe(0);
		expect(facts.ventures.some((v) => /tinyland/i.test(v.name))).toBe(false);
	});

	test('beyond code section renders', async ({ page }) => {
		await expect(page.getByRole('heading', { name: 'Beyond Code' })).toBeVisible();
		await expect(page.getByRole('heading', { name: 'Photography' })).toBeVisible();
		await expect(page.getByRole('heading', { name: 'Music' })).toBeVisible();
		await expect(page.getByRole('heading', { name: 'Hospitality' })).toBeVisible();
	});

	test('JSON-LD Person structured data present', async ({ page }) => {
		const jsonLd = await page.evaluate(() => {
			const scripts = document.querySelectorAll('script[type="application/ld+json"]');
			for (const s of scripts) {
				try {
					const data = JSON.parse(s.textContent || '');
					if (data['@type'] === 'Person') return data;
				} catch {
					/* skip */
				}
			}
			return null;
		});
		expect(jsonLd).not.toBeNull();
		expect(jsonLd?.name).toBe('Jess Sullivan');
		expect(jsonLd?.name).toBe(facts.identity.name);
		expect(jsonLd?.jobTitle).toBe('Systems Analyst (DevSecOps)');
		const current = facts.roles.find((r) => r.end === 'present');
		expect(jsonLd?.jobTitle).toBe(current?.title);
		expect(jsonLd?.worksFor?.name).toBe(current?.org);
		const factUrls = new Set(facts.links.map((l) => l.url));
		expect(jsonLd?.sameAs.length).toBeGreaterThan(0);
		for (const url of jsonLd?.sameAs ?? []) expect(factUrls.has(url)).toBe(true);
		expect(jsonLd?.sameAs).toContain('https://github.com/Jesssullivan');
	});

	test('learning formula image present', async ({ page }) => {
		await expect(page.locator('#main-content').locator('img[alt*="Learning"]')).toBeVisible();
	});

	test('links section renders facts links first, then GitLab', async ({ page }) => {
		const main = page.locator('#main-content');
		await expect(main.getByRole('heading', { name: 'Links' })).toBeVisible();
		const links = main.locator('[data-testid="profile-links"] a');
		const hrefs = await links.evaluateAll((els) => els.map((el) => el.getAttribute('href')));
		// facts links, in order, lead the list
		expect(hrefs.slice(0, facts.links.length)).toEqual(facts.links.map((l) => l.url));
		expect(hrefs).toContain('https://gitlab.com/jesssullivan');
		expect(hrefs.indexOf('https://gitlab.com/jesssullivan')).toBeGreaterThanOrEqual(facts.links.length);
		// nothing a facts link provides is repeated
		for (const l of facts.links) expect(hrefs.filter((h) => h === l.url)).toHaveLength(1);
		expect(hrefs.some((h) => h && /tinyland/i.test(h))).toBe(false);
		await expect(main.getByRole('link', { name: 'GitHub', exact: true }).first()).toBeVisible();
		await expect(main.getByRole('link', { name: 'GitLab', exact: true })).toBeVisible();
		const aag = facts.links.find((l) => l.label === 'AAG poster');
		expect(aag?.url).toBe('https://transscendsurvival.org/aag');
		await expect(main.getByRole('link', { name: 'AAG poster', exact: true })).toHaveAttribute('href', aag!.url);
	});

	test('nav links work from about page', async ({ page }) => {
		await page.getByRole('link', { name: 'Read the Blog' }).click();
		await page.waitForURL(/\/blog/, { waitUntil: 'domcontentloaded' });
	});
});
