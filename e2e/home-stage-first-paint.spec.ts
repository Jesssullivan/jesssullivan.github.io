import { test, expect, type Page } from '@playwright/test';

// The home page as it launches (TIN-8657, ruling RM98: "Stage from first paint").
// A build made with BLOG_HOME_STAGE=on has the stage and the stream in the page as built.
// These tests hold that build ready: the old banner never paints, nothing moves, and the first
// screens of the stream are in the HTML. They read the page to learn which build this is, so they
// run by themselves on the day the build setting turns on, and are skipped on a build with it off.

let staged = false;

test.beforeAll(async ({ request, baseURL }) => {
	if (!baseURL) throw new Error('explicit loopback base URL required');
	const local = new URL(baseURL);
	if (local.protocol !== 'http:' || !['localhost', '127.0.0.1', '[::1]'].includes(local.hostname)) throw new Error('loopback only');
	staged = (await (await request.get('/')).text()).includes('data-testid="home-stage"');
});

test.beforeEach(async ({ context, baseURL }) => {
	test.skip(!staged, 'This build has BLOG_HOME_STAGE off: the stage arrives behind ?flags=home, which e2e/home-stage-stream.spec.ts covers.');
	const origin = new URL(baseURL!).origin;
	// Nothing leaves the machine.
	await context.route('**/*', route => (new URL(route.request().url()).origin === origin ? route.continue() : route.abort()));
});

/** Writes down, from before the first paint: every state of the page, every layout shift and the largest paint. */
async function watch(page: Page) {
	await page.addInitScript(() => {
		const seen: string[] = [];
		const log = { seen, shift: 0, moved: [] as string[], largest: '', paints: [] as string[] };
		(window as unknown as { __first: typeof log }).__first = log;
		const look = () => {
			const has = (selector: string) => (document.querySelector(selector) ? 1 : 0);
			const state = `${has('.hero-banner')}${has('#latest')}${has('[data-testid=home-stage]')}${has('[data-testid=stream-item]')}`;
			if (seen[seen.length - 1] !== state) seen.push(state);
		};
		new MutationObserver(look).observe(document, { childList: true, subtree: true });
		const name = (node: Node | null | undefined) => {
			const element = node?.nodeType === 1 ? (node as Element) : node?.parentElement;
			if (!element) return 'gone';
			const scene = element.closest('[data-testid^=scene-]')?.getAttribute('data-testid');
			const part = element.closest('[data-testid=home-stage]') ? 'stage' : element.closest('[data-testid=home-stream]') ? 'stream' : 'page';
			return `${part}${scene ? ` ${scene}` : ''} ${element.tagName.toLowerCase()}`;
		};
		new PerformanceObserver(list => {
			for (const entry of list.getEntries() as (PerformanceEntry & { hadRecentInput: boolean; value: number; sources: { node: Node | null }[] })[]) {
				if (entry.hadRecentInput) continue;
				log.shift += entry.value;
				log.moved.push(`${entry.value.toFixed(4)} ${entry.sources.slice(0, 3).map(source => name(source.node)).join(', ')}`);
			}
		}).observe({ type: 'layout-shift', buffered: true });
		new PerformanceObserver(list => {
			for (const entry of list.getEntries() as (PerformanceEntry & { element: Element | null })[]) log.largest = name(entry.element);
		}).observe({ type: 'largest-contentful-paint', buffered: true });
	});
}
const first = (page: Page) => page.evaluate(() => (window as unknown as { __first: { seen: string[]; shift: number; moved: string[]; largest: string } }).__first);

test.describe('a build with the stage on: first paint', () => {
	test('the page as built holds the stage, the first screens of the stream and the folded years, and no banner', async ({ browser, baseURL }) => {
		// With no script, what shows is what was built.
		const context = await browser.newContext({ javaScriptEnabled: false, baseURL });
		try {
			const page = await context.newPage();
			await page.goto('/');
			await expect(page.getByTestId('home-stage')).toBeVisible();
			await expect(page.locator('.hero-banner')).toHaveCount(0);
			await expect(page.getByText('Writing and notes.')).toHaveCount(0);
			await expect(page.locator('#latest, #pulse, #archive')).toHaveCount(0);
			await expect(page.locator('footer').filter({ hasText: 'Dedicated to the public domain' })).toHaveCount(0);
			await expect(page.locator('aside')).toHaveCount(0);
			await expect(page.locator('h1')).toHaveText('Jess Sullivan');
			// The first part of the stream stands open: a screen or two of it, with its first pictures sized.
			const open = page.locator('.flow').first().getByTestId('stream-item');
			expect(await open.count()).toBeGreaterThanOrEqual(12);
			await expect(open.first().locator('h2 a')).toHaveAttribute('href', /^\/blog\//);
			for (const img of await open.locator('img').all()) {
				await expect(img).toHaveAttribute('width', /^\d+$/);
				await expect(img).toHaveAttribute('height', /^\d+$/);
			}
			// Without scripts More is a plain link to every post, and an older year opens on a press.
			await expect(page.getByTestId('stream-more')).toHaveAttribute('href', '/blog');
			const years = page.getByTestId('stream-year');
			expect(await years.count()).toBeGreaterThanOrEqual(4);
			const year = years.first();
			await expect(year.getByTestId('stream-item').first()).toBeHidden();
			await year.locator('summary').click();
			await expect(year.getByTestId('stream-item').first()).toBeVisible();
			// A moving picture is its first frame, and nothing here plays.
			await expect(page.getByTestId('moving').first().locator('img')).toHaveAttribute('src', /-still\.webp$/);
			await expect(page.locator('iframe')).toHaveCount(0);
			// An inner page has the slim top bar from its first paint, and no banner.
			await page.goto('/about');
			await expect(page.locator('.hero-banner')).toHaveCount(0);
		} finally {
			await context.close();
		}
	});

	for (const [width, height] of [[1440, 900], [390, 844]] as const) {
		test(`at ${width} by ${height} the banner never paints, nothing moves, and the largest paint is in the stage`, async ({ page }) => {
			await page.setViewportSize({ width, height });
			await watch(page);
			await page.goto('/');
			await expect(page.getByTestId('home-stage')).toBeVisible();
			await expect(page.getByTestId('stream-item').first()).toBeAttached();
			// Alive: the stage has its controls and plays itself.
			await expect(page.getByTestId('home-stage')).toHaveAttribute('data-playing', 'true');
			await page.waitForLoadState('networkidle');
			await page.waitForTimeout(1500);
			const log = await first(page);
			// From its first state to its last the page never holds the banner or the old sections, and it ends as the stage and the stream.
			expect(log.seen.filter(state => !state.startsWith('00'))).toEqual([]);
			expect(log.seen[log.seen.length - 1]).toBe('0011');
			await expect(page.locator('footer').filter({ hasText: 'Dedicated to the public domain' })).toHaveCount(0);
			await expect(page.locator('aside')).toHaveCount(0);
			expect(log.shift, log.moved.join(' | ')).toBeLessThan(0.02);
			expect(log.largest).toMatch(/^stage /);
			// The stage did not arrive late: it was in the page, so it does not fade in over an old one.
			await expect(page.getByTestId('home-stage')).not.toHaveClass(/arrives/);
			expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
		});
	}

	test('the page stands when its first two asks for the stream fail, as on a phone that changes network', async ({ page }) => {
		// The stream's data file is read as the page comes alive. A failed read used to take the prerendered page away and show the error page.
		let failed = 0;
		await page.route(/\/home-stream\.v1\.[^/]*\.json$/, route => {
			if (failed < 2) {
				failed += 1;
				return route.abort('internetdisconnected');
			}
			return route.continue();
		});
		await watch(page);
		await page.goto('/');
		await expect(page.getByTestId('home-stage')).toHaveAttribute('data-playing', 'true', { timeout: 20_000 });
		expect(failed).toBe(2);
		await expect(page.getByTestId('stream-item').first()).toBeAttached();
		await expect(page.getByText("This page doesn't exist")).toHaveCount(0);
		const log = await first(page);
		expect(log.seen[log.seen.length - 1]).toBe('0011');
	});
});
