import { readFileSync } from 'node:fs';
import { test, expect, type Page } from '@playwright/test';

// R53: the about page renders static/profile/facts.json (synced from
// spear_resumes); assert against the same file so a re-sync moves both.
type Facts = {
	identity: { name: string };
	roles: { title: string; org: string; end: number | string }[];
	ventures: { name: string; url?: string }[];
	merged_upstream: { project: string; url: string }[];
	relations: { project: string; relation: string; url?: string }[];
	projects: { category: string; label: string }[];
	taxonomy: { id: string; label: string }[];
	publications: { authors: string; title: string; year: number; url?: string; venue?: string }[];
	community: string[];
	links: { label: string; url: string }[];
	images: { slot: string; alt: string; url?: string }[];
};
const facts: Facts = JSON.parse(readFileSync(new URL('../static/profile/facts.json', import.meta.url), 'utf8'));
const SITE = 'https://transscendsurvival.org';

// Profile v2: the map, upstream ribbon and activity rhythm read profile.v1
// (static/profile/v2, copied from spear_resumes profile/out-v2).
type V2 = {
	repos: { id: string; label: string; category: string; link: string | null }[];
	categories: { id: string; label: string }[];
	merged_upstream: { project: string; repo: string; number: number; merged: string; relation: string }[];
};
const v2: V2 = JSON.parse(readFileSync(new URL('../static/profile/v2/profile.v1.json', import.meta.url), 'utf8'));
/** Latest merge per project, as the ribbon renders it. */
const v2Upstream = (() => {
	const latest = new Map<string, V2['merged_upstream'][number]>();
	for (const u of v2.merged_upstream) {
		const seen = latest.get(u.project);
		if (!seen || u.merged > seen.merged) latest.set(u.project, u);
	}
	return [...latest.values()].map((u) => ({ ...u, url: `https://github.com/${u.repo}/pull/${u.number}` }));
})();

// Facts links as the page renders them: same-site URLs root-relative, and the
// site-root link dropped (the reader is already on the site).
const renderedFactLinks = facts.links
	.map((l) => ({ label: l.label, url: l.url === SITE || l.url.startsWith(`${SITE}/`) ? l.url.slice(SITE.length) : l.url }))
	.filter((l) => l.url !== '' && l.url !== '/');

/** Visible text of the about page's own content, without the blog post lists. */
async function aboutText(page: Page): Promise<string> {
	return page.locator('#main-content').evaluate((main) => {
		const clone = main.cloneNode(true) as HTMLElement;
		clone.querySelectorAll('#featured-posts, #recent-posts').forEach((el) => el.remove());
		document.body.appendChild(clone);
		clone.style.position = 'absolute';
		const text = clone.innerText;
		clone.remove();
		return text;
	});
}

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

	test('server render carries the v2 map SVG, timeline and languages, and no upstream image', async ({ request }) => {
		const html = await (await request.get('/about')).text();
		expect(html).toContain('src="/profile/v2/svg/project-map-light.svg"');
		expect(html).toContain('src="/profile/svg/timeline-light.svg"');
		expect(html).toContain('src="/profile/svg/languages-light.svg"');
		expect(html).not.toContain('upstream-light.svg');
		// R111: the language heatmap is held; nothing on the page consumes it.
		expect(html).not.toMatch(/language-heatmap|language_months/);
	});

	test('ThemedImage swaps src on dark mode toggle', async ({ page }) => {
		const timeline = page.locator('#main-content').locator('img[src*="/profile/svg/timeline-"]');
		await expect(timeline).toHaveAttribute('src', /timeline-light\.svg/);

		await openThemeSettings(page);
		await page.getByRole('button', { name: 'Set color mode to dark' }).click();
		await expect(page.locator('html')).toHaveAttribute('data-mode', 'dark');
		await expect(timeline).toHaveAttribute('src', /timeline-dark\.svg/);
	});

	test('project map embed links to the full map and becomes interactive', async ({ page }) => {
		const projects = page.locator('#projects');
		await expect(projects.getByRole('link', { name: /Open the full map/ })).toHaveAttribute('href', '/projects');
		const map = projects.locator('[data-testid="project-map"]');
		await map.locator('.pm-stage').scrollIntoViewIfNeeded();
		await expect(map).toHaveAttribute('data-state', 'interactive', { timeout: 15_000 });
		await expect(map.locator('.pm-node')).toHaveCount(v2.repos.length);
		// Scrolled into view, the clusters assemble; the embed keeps the SVG's box.
		await expect(map).toHaveAttribute('data-assembled', 'true', { timeout: 10_000 });
		const box = (await map.locator('.pm-stage').boundingBox())!;
		expect(box.height / box.width).toBeCloseTo(1226 / 960, 1);
	});

	test('activity rhythm hatches unknown days and never draws them as zero', async ({ page }) => {
		const activity = page.locator('#activity');
		await expect(activity.getByRole('heading', { name: 'Activity' })).toBeVisible();
		const rhythm = activity.locator('[data-testid="activity-rhythm"]');
		await expect(rhythm.locator('svg[role="img"] desc')).toContainText('unknown days are hatched, never shown as zero');
		const unknownCells = rhythm.locator('.ar-cell:not([data-unknown="0"])');
		expect(await unknownCells.count()).toBeGreaterThan(0);
		// A wholly unknown week carries no activity value and a hatch fill.
		const allUnknown = rhythm.locator('.ar-cell[data-active=""]');
		expect(await allUnknown.count()).toBeGreaterThan(0);
		await expect(allUnknown.first().locator('rect')).toHaveAttribute('fill', /^url\(#/);
		await expect(rhythm).toContainText('GitHub contribution connection cap');
		expect(await activity.innerText()).not.toMatch(/total/i);
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

	test('GFTB venture does not repeat its description as an infra line (R70)', async ({ page }) => {
		const ventures = page.locator('#ventures');
		const raw = JSON.parse(readFileSync(new URL('../static/profile/facts.json', import.meta.url), 'utf8'));
		const gftb = raw.ventures.find((v: { name: string }) => v.name === 'Great Falls Tool Bus');
		expect(gftb?.infra).toBeTruthy();
		await expect(ventures.getByText(gftb.description, { exact: false })).toBeVisible();
		await expect(ventures.getByText(gftb.infra, { exact: true })).toHaveCount(0);
		// Other venture lines still render (xoxd.ai product line).
		const xoxd = raw.ventures.find((v: { name: string }) => v.name === 'xoxd.ai');
		await expect(ventures.getByText(xoxd.product_line, { exact: true })).toBeVisible();
	});

	test('projects section renders the map table', async ({ page }) => {
		const projects = page.locator('#projects');
		await expect(projects.getByRole('heading', { name: 'Projects' })).toBeVisible();
		// Exactly the profile.v1 repositories, in the producer's category order,
		// labels sorted within a category (describe-don't-name applied upstream).
		const order = v2.categories.map((c) => c.id);
		const label = new Map(v2.categories.map((c) => [c.id, c.label]));
		const expected = [...v2.repos].sort(
			(a, b) => order.indexOf(a.category) - order.indexOf(b.category) || a.label.localeCompare(b.label),
		);
		const table = projects.locator('[data-testid="project-table"]');
		expect(await table.locator('.project-label').allInnerTexts()).toEqual(expected.map((e) => e.label));
		expect((await table.locator('.project-category').allInnerTexts()).map((t) => t.trim())).toEqual(
			expected.map((e) => label.get(e.category)),
		);
	});

	test('other upstream involvement is separate and never says "engagement"', async ({ page }) => {
		const merged = new Set(v2.merged_upstream.map((u) => u.project));
		const others = facts.relations.filter((r) => !merged.has(r.project) && r.url);
		// R60: FFT.js now has a merged PR, so only ggplot2 is left here.
		expect(others.map((r) => r.project).sort()).toEqual(['ggplot2']);
		const upstream = page.locator('#upstream');
		const section = page.locator('#other-upstream');
		await expect(section.getByRole('heading', { name: 'Other upstream involvement' })).toBeVisible();
		for (const r of others) {
			await expect(upstream.getByText(r.project)).toHaveCount(0);
			await expect(section.getByRole('link', { name: r.project, exact: true })).toHaveAttribute('href', r.url!);
		}
		const text = (await section.innerText()) ?? '';
		await expect(section.getByRole('listitem')).toHaveCount(others.length);
		expect(text).not.toContain('FFT.js');
		expect(text).not.toMatch(/engagement/i);
		expect(text).not.toMatch(/ggplot2 \(/);
		// The Budgie DE relation is render = false: it never shows as upstream
		// work (a facts project label may still mention the Budgie desktop).
		expect(text).not.toMatch(/Budgie/);
		expect(await upstream.innerText()).not.toMatch(/Budgie/);
	});

	test('publications render from facts', async ({ page }) => {
		const pubs = page.locator('#publications');
		await expect(pubs.getByRole('heading', { name: 'Publications' })).toBeVisible();
		const text = await pubs.innerText();
		for (const pub of facts.publications) {
			expect(text).toContain(pub.title);
			expect(text).toContain(`${pub.authors} (${pub.year})`);
			if (pub.venue) expect(text).toContain(pub.venue);
			if (pub.url) await expect(pubs.getByRole('link', { name: pub.title, exact: true })).toHaveAttribute('href', pub.url);
		}
		await expect(pubs.locator('li')).toHaveCount(facts.publications.length);
	});

	test('merged upstream lists every profile.v1 project with its latest PR link', async ({ page }) => {
		const upstream = page.locator('#upstream');
		await expect(upstream.getByRole('heading', { name: 'Merged Upstream' })).toBeVisible();
		const list = upstream.locator('[data-testid="upstream-list"]');
		await expect(list.locator('li')).toHaveCount(v2Upstream.length);
		for (const u of v2Upstream) {
			await expect(list.getByRole('link', { name: u.project, exact: true })).toHaveAttribute('href', u.url);
		}
		// The ribbon replaces the static upstream image; its marks are real links too.
		await expect(upstream.locator('img')).toHaveCount(0);
		await expect(upstream.locator('[data-testid="upstream-ribbon"] a.ur-mark')).toHaveCount(v2Upstream.length);
		expect(await list.innerText()).not.toMatch(/engagement/i);
		for (const name of ['llama.cpp', 'KeePassXC', 'rspamd', 'nixpkgs', 'FFT.js', 'Joplin']) {
			await expect(list.getByRole('link', { name, exact: true })).toBeVisible();
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
		const sections = ['#profile-intro', '#experience', '#ventures', '#projects', '#upstream', '#other-upstream', '#activity', '#community', '#publications', '[data-testid="profile-links"]'];
		for (const sel of sections) {
			const section = page.locator(sel);
			await expect(section).toHaveCount(1);
			const text = (await section.textContent()) ?? '';
			expect(text, sel).not.toMatch(/Tinyland/i);
			expect(text, sel).not.toMatch(/RPM kernel/i);
			expect(await section.locator('a[href*="tinyland"]').count(), sel).toBe(0);
		}
		// No remote images at all (counters, badges, stats services), only
		// same-origin assets.
		expect(await page.locator('img[src^="http"]').count()).toBe(0);
		expect(await page.locator('img[src^="//"]').count()).toBe(0);
		expect(await page.locator('img[src*="github-profile"]').count()).toBe(0);
		expect(facts.ventures.some((v) => /tinyland/i.test(v.name))).toBe(false);
	});

	test('no invented entries, no coinage names, no phone number', async ({ page }) => {
		const text = await aboutText(page);
		// Entries once hallucinated into the page.
		expect(text).not.toContain('BrainFlow');
		expect(text).not.toContain('MeshCore');
		// Describe, don't name (R32): Jess's coinages never show as visible text;
		// they may still appear inside link URLs.
		for (const coinage of ['GloriousFlywheel', 'XoxdWM', 'tummycrypt', 'oauth-mux', 'hexstrunk']) {
			expect(text, coinage).not.toMatch(new RegExp(coinage, 'i'));
		}
		// R47: the phone number never renders.
		expect(await page.locator('a[href^="tel:"]').count()).toBe(0);
		expect(text).not.toMatch(/(\+?1[\s.-]?)?\(?\d{3}\)?[\s.-]\d{3}[\s.-]\d{4}/);
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
		for (const url of jsonLd?.sameAs ?? []) {
			expect(factUrls.has(url)).toBe(true);
			expect(url.startsWith(SITE)).toBe(false);
		}
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
		// R54 order: facts links, then the facts IDL badge, then blog extras.
		const n = renderedFactLinks.length;
		expect(hrefs.slice(0, n)).toEqual(renderedFactLinks.map((l) => l.url));
		const badge = facts.images.find((i) => i.slot === 'links');
		expect(hrefs[n]).toBe(badge?.url);
		await expect(links.nth(n).locator('img')).toHaveAttribute('alt', badge!.alt);
		expect(hrefs.indexOf('https://gitlab.com/jesssullivan')).toBeGreaterThan(n);
		// nothing a facts link provides is repeated
		for (const l of renderedFactLinks) expect(hrefs.filter((h) => h === l.url)).toHaveLength(1);
		expect(hrefs.some((h) => h && /tinyland/i.test(h))).toBe(false);
		// same-site links are root-relative, same tab; the site-root Blog link is dropped
		expect(hrefs.some((h) => h && h.startsWith(SITE))).toBe(false);
		await expect(main.locator('[data-testid="profile-links"]').getByRole('link', { name: 'Blog', exact: true })).toHaveCount(0);
		for (const path of ['/cv', '/aag']) {
			const link = main.locator(`[data-testid="profile-links"] a[href="${path}"]`);
			await expect(link).toHaveCount(1);
			await expect(link).not.toHaveAttribute('target', /.*/);
		}
		await expect(main.getByRole('link', { name: 'AAG poster', exact: true })).toHaveAttribute('href', '/aag');
		await expect(main.getByRole('link', { name: 'GitHub', exact: true }).first()).toBeVisible();
		await expect(main.getByRole('link', { name: 'GitLab', exact: true })).toBeVisible();
	});

	test('nav links work from about page', async ({ page }) => {
		await page.getByRole('link', { name: 'Read the Blog' }).click();
		await page.waitForURL(/\/blog/, { waitUntil: 'domcontentloaded' });
	});
});
