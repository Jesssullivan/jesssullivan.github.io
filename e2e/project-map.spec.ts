import { readFileSync } from 'node:fs';
import { test, expect, type Page, type BrowserContext } from '@playwright/test';

// Profile v2 project map (Appendix A, workstream C). The page must work with
// the live host blocked (e2e runs on the static build), degrade to the
// server-rendered SVG + table when every fetch fails, and stay usable by
// keyboard, touch and with reduced motion.
type Repo = { id: string; label: string; link: string | null; category: string };
type Profile = { repos: Repo[]; categories: { id: string; label: string }[]; edges: { a: string; b: string }[] };
const profile: Profile = JSON.parse(
	readFileSync(new URL('../static/profile/v2/profile.v1.json', import.meta.url), 'utf8'),
);
const LIVE = 'https://jess.clients.xoxd.ai/**';
const COUNT_PATTERN = /\d+\s+(repos|projects)/i;

async function blockLive(context: BrowserContext | Page) {
	await context.route(LIVE, (route) => route.abort('blockedbyclient'));
}

async function openInteractive(page: Page, path = '/projects') {
	await blockLive(page);
	await page.goto(path, { waitUntil: 'domcontentloaded' });
	const map = page.locator('[data-testid="project-map"]').first();
	// The stage, not the figure: the figure also holds the long table.
	await map.locator('.pm-stage').scrollIntoViewIfNeeded();
	await expect(map).toHaveAttribute('data-state', 'interactive', { timeout: 15_000 });
	await expect(map).toHaveAttribute('data-assembled', 'true', { timeout: 10_000 });
	return map;
}

/** Centre of a node marker in page coordinates. */
async function nodeCenter(page: Page, index: number) {
	const box = await page.locator(`[data-node-index="${index}"] .pm-mark`).first().boundingBox();
	if (!box) throw new Error(`node ${index} has no box`);
	return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

test.describe('Project map (/projects)', () => {
	test('live host blocked: becomes interactive from the static copy', async ({ page }) => {
		const map = await openInteractive(page);
		await expect(map).toHaveAttribute('data-source', 'fallback');
		await expect(map.locator('canvas.pm-canvas')).toBeVisible();
		expect(['webgl2', 'canvas2d']).toContain(await map.getAttribute('data-layer'));
		await expect(map.locator('.pm-node')).toHaveCount(profile.repos.length);
		// The static SVG was swapped out, the table stays.
		await expect(map.locator('img.pm-static')).toHaveCount(0);
		await expect(map.locator('[data-testid="project-table"] tbody tr')).toHaveCount(profile.repos.length);
		await expect(page.locator('#main-content aside .pm-title')).toHaveText('Project similarity');
	});

	test('every fetch blocked: keeps the server-rendered SVG and the table', async ({ page }) => {
		await blockLive(page);
		await page.route('**/profile/v2/profile.v1.json', (route) => route.abort('blockedbyclient'));
		await page.goto('/projects', { waitUntil: 'domcontentloaded' });
		const map = page.locator('[data-testid="project-map"]');
		await expect(map).toHaveAttribute('data-state', 'failed', { timeout: 15_000 });
		await expect(map.locator('img.pm-static')).toBeVisible();
		await expect(map.locator('img.pm-static')).toHaveAttribute(
			'src',
			/\/profile\/v2\/svg\/project-map-(light|dark)\.svg$/,
		);
		await expect(map.locator('canvas')).toHaveCount(0);
		const labels = await map.locator('[data-testid="project-table"] .project-label').allInnerTexts();
		expect(new Set(labels)).toEqual(new Set(profile.repos.map((r) => r.label)));
	});

	test('JavaScript off: SVG and the full table, every public link real', async ({ browser }) => {
		const context = await browser.newContext({ javaScriptEnabled: false });
		const page = await context.newPage();
		await page.goto('/projects', { waitUntil: 'domcontentloaded' });
		const map = page.locator('[data-testid="project-map"]');
		await expect(map).toHaveAttribute('data-state', 'static');
		await expect(map.locator('img.pm-static')).toBeVisible();
		const rows = map.locator('[data-testid="project-table"] tbody tr');
		await expect(rows).toHaveCount(profile.repos.length);
		const hrefs = await map
			.locator('[data-testid="project-table"] a')
			.evaluateAll((els) => els.map((e) => e.getAttribute('href')));
		expect(hrefs.sort()).toEqual(
			profile.repos
				.map((r) => r.link)
				.filter((l): l is string => !!l)
				.sort(),
		);
		await context.close();
	});

	test('hover: nearest node goes data-state=near, neighbours light up, tooltip has no counts', async ({ page }) => {
		const map = await openInteractive(page);
		const degree = (i: number) =>
			profile.edges.filter((e) => e.a === profile.repos[i].id || e.b === profile.repos[i].id).length;
		const connected = profile.repos.map((_, i) => i).sort((a, b) => degree(b) - degree(a))[0];
		for (const index of [0, 5, connected]) {
			const { x, y } = await nodeCenter(page, index);
			await page.mouse.move(x, y);
			const node = map.locator(`[data-node-index="${index}"]`);
			await expect(node).toHaveAttribute('data-state', 'near');
			const tooltip = map.locator('[data-testid="map-tooltip"]');
			await expect(tooltip).toBeVisible();
			await expect(tooltip).toContainText(profile.repos[index].label);
			expect(await tooltip.innerText()).not.toMatch(COUNT_PATTERN);
		}
		expect(await map.locator('.pm-node[data-state="neighbor"]').count()).toBeGreaterThan(0);
		await page.mouse.move(2, 2);
		await expect(map.locator('.pm-node[data-state="near"]')).toHaveCount(0);
	});

	test('keyboard: Tab into the group, arrows follow edges, +/-/0 zoom, Escape clears', async ({ page }) => {
		const map = await openInteractive(page);
		let inside = false;
		for (let i = 0; i < 80 && !inside; i++) {
			await page.keyboard.press('Tab');
			inside = await page.evaluate(() => !!document.activeElement?.closest('[role="group"].pm-stage .pm-node'));
		}
		expect(inside).toBe(true);
		const first = await page.evaluate(() => document.activeElement!.getAttribute('data-node-index'));
		await expect(map.locator(`[data-node-index="${first}"]`)).toHaveAttribute('data-state', 'near');
		await expect(map.locator('[data-testid="map-tooltip"]')).toBeVisible();

		const visited = new Set([first]);
		for (const key of ['ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowUp', 'ArrowRight']) {
			await page.keyboard.press(key);
			visited.add(await page.evaluate(() => document.activeElement!.getAttribute('data-node-index')));
		}
		expect(visited.size).toBeGreaterThan(1);
		await expect(page.locator('[data-testid="map-detail"]')).not.toContainText('Hover, tap or Tab');

		const markBox = async () => (await map.locator('.pm-node[data-state="near"] .pm-mark').boundingBox())!;
		const neighborBefore = await map.locator('.pm-node[data-state="neighbor"]').first().boundingBox();
		await page.keyboard.press('+');
		await page.waitForTimeout(400);
		const neighborAfter = await map.locator('.pm-node[data-state="neighbor"]').first().boundingBox();
		expect(neighborBefore && neighborAfter).toBeTruthy();
		const near = await markBox();
		const spreadBefore = Math.hypot(neighborBefore!.x - near.x, neighborBefore!.y - near.y);
		const spreadAfter = Math.hypot(neighborAfter!.x - near.x, neighborAfter!.y - near.y);
		expect(spreadAfter).toBeGreaterThan(spreadBefore * 1.2);
		await page.keyboard.press('0');
		await page.waitForTimeout(400);

		await page.keyboard.press('Escape');
		await expect(map.locator('.pm-node[data-state="near"]')).toHaveCount(0);
		await expect(map.locator('[data-testid="map-tooltip"]')).toHaveCount(0);
	});

	test('Enter on a focused node opens its repository', async ({ page, context }) => {
		await context.route('https://github.com/**', (route) => route.fulfill({ status: 200, body: 'ok' }));
		const map = await openInteractive(page);
		const linked = profile.repos.findIndex((r) => r.link);
		await map.locator(`[data-node-index="${linked}"]`).focus();
		const [popup] = await Promise.all([context.waitForEvent('page'), page.keyboard.press('Enter')]);
		await popup.waitForURL(profile.repos[linked].link!);
		expect(popup.url()).toBe(profile.repos[linked].link);
	});

	test('legend toggles are aria-pressed and hide their category', async ({ page }) => {
		const map = await openInteractive(page);
		const cat = profile.categories[0];
		const toggle = map.locator(`.pm-legend-item[data-category="${cat.id}"]`);
		await expect(toggle).toHaveAttribute('aria-pressed', 'true');
		await toggle.click();
		await expect(toggle).toHaveAttribute('aria-pressed', 'false');
		const members = profile.repos.map((r, i) => (r.category === cat.id ? i : -1)).filter((i) => i >= 0);
		for (const i of members)
			await expect(map.locator(`[data-node-index="${i}"]`)).toHaveAttribute('data-state', 'hidden');
		await toggle.click();
		await expect(toggle).toHaveAttribute('aria-pressed', 'true');
		await expect(map.locator(`[data-node-index="${members[0]}"]`)).not.toHaveAttribute('data-state', 'hidden');
	});

	test('search highlights matches and Enter focuses the first', async ({ page }) => {
		const map = await openInteractive(page);
		const target = profile.repos[3];
		const word = target.label.split(/\s+/).find((w) => w.length > 5) ?? target.label;
		const search = page.getByLabel('Search projects');
		await search.fill(word);
		await expect(map.locator('[data-node-index="3"]')).toHaveAttribute('data-state', /match|near|neighbor/);
		expect(await map.locator('.pm-node[data-state="dim"]').count()).toBeGreaterThan(0);
		await search.press('Enter');
		expect(await page.evaluate(() => document.activeElement?.classList.contains('pm-node'))).toBe(true);
	});

	test('?focus=<id> selects that project', async ({ page }) => {
		const target = profile.repos[9];
		await openInteractive(page, `/projects?focus=${target.id}`);
		await expect(page.locator('[data-testid="map-detail"]')).toContainText(target.label);
		await expect(page.locator(`[data-node-index="9"]`)).toHaveAttribute('data-state', 'near');
	});

	test('reduced motion: no entrance animation, the map is complete at once', async ({ page }) => {
		await page.emulateMedia({ reducedMotion: 'reduce' });
		await blockLive(page);
		await page.goto('/projects', { waitUntil: 'domcontentloaded' });
		const map = page.locator('[data-testid="project-map"]');
		await expect(map).toHaveAttribute('data-state', 'interactive', { timeout: 15_000 });
		await expect(map).toHaveAttribute('data-motion', 'reduced');
		await expect(map).toHaveAttribute('data-assembled', 'true', { timeout: 1_000 });
		const opacities = await map
			.locator('.pm-nodes > g')
			.evaluateAll((els) => els.map((e) => Number(e.getAttribute('opacity'))));
		expect(opacities.every((o) => o === 1)).toBe(true);
	});

	test('touch: first tap selects, it does not navigate', async ({ browser }) => {
		const context = await browser.newContext({ hasTouch: true, isMobile: true, viewport: { width: 390, height: 844 } });
		const page = await context.newPage();
		const map = await openInteractive(page);
		const index = profile.repos.findIndex((r) => r.link);
		const { x, y } = await nodeCenter(page, index);
		await page.touchscreen.tap(x, y);
		await expect(page.locator('[data-testid="map-detail"]')).toContainText(profile.repos[index].label);
		expect(page.url()).toContain('/projects');
		expect(context.pages()).toHaveLength(1);
		await expect(map).toHaveAttribute('data-state', 'interactive');
		await context.close();
	});

	test('no page-wide horizontal overflow on a phone', async ({ browser }) => {
		const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
		const page = await context.newPage();
		await openInteractive(page);
		const overflow = await page.evaluate(
			() => document.documentElement.scrollWidth - document.documentElement.clientWidth,
		);
		expect(overflow).toBeLessThanOrEqual(0);
		await context.close();
	});

	test('sitemap lists /projects', async ({ request }) => {
		const xml = await (await request.get('/sitemap.xml')).text();
		expect(xml).toContain('<loc>https://transscendsurvival.org/projects</loc>');
	});
});
