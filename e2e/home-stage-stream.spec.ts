import { test, expect, type Page } from '@playwright/test';

// The home page behind ?flags=home (TIN-8657): the heading stage and the one mixed stream.
// Off, the home page is the one production serves today and asks for nothing new.

const STREAM_FILE = '/data/home-stream.v1.json';
const outside: string[] = [];

test.beforeEach(async ({ context, baseURL }) => {
	if (!baseURL) throw new Error('explicit loopback base URL required');
	const local = new URL(baseURL);
	if (local.protocol !== 'http:' || !['localhost', '127.0.0.1', '[::1]'].includes(local.hostname)) throw new Error('loopback only');
	outside.length = 0;
	await context.route('**/*', async route => {
		const url = new URL(route.request().url());
		if (url.origin === local.origin) await route.continue();
		else {
			// Nothing leaves the machine. A player frame is recorded and answered with an empty page.
			outside.push(url.href);
			if (route.request().resourceType() === 'document') await route.fulfill({ status: 200, contentType: 'text/html', body: '<!doctype html><title>player</title>' });
			else await route.abort();
		}
	});
});

const stage = (page: Page) => page.getByTestId('home-stage');
const items = (page: Page) => page.getByTestId('stream-item');

function recordPaths(page: Page): string[] {
	const paths: string[] = [];
	page.on('request', request => paths.push(new URL(request.url()).pathname));
	return paths;
}

async function noSidewaysScroll(page: Page) {
	const { scroll, client } = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, client: document.documentElement.clientWidth }));
	expect(scroll).toBeLessThanOrEqual(client);
}

test.describe('flag off: the home page is unchanged', () => {
	test('keeps the banner, the three sections, the side column and the footer, and asks for nothing new', async ({ page }) => {
		const paths = recordPaths(page);
		await page.goto('/');
		await expect(page.locator('.hero-banner')).toBeVisible();
		await expect(page.getByRole('heading', { name: 'Writing and notes.', level: 1 })).toBeVisible();
		for (const name of ['Latest', 'Pulse', 'Archive']) await expect(page.getByRole('heading', { name, exact: true })).toBeVisible();
		await expect(page.locator('footer')).toBeVisible();
		await expect(page.locator('aside')).toBeVisible();
		await expect(page.getByTestId('blob-background')).toBeAttached();
		await expect(page).toHaveTitle('Jess Sullivan — Latest, Pulse, Archive');
		await expect(stage(page)).toHaveCount(0);
		await expect(page.getByTestId('home-stream')).toHaveCount(0);
		await page.waitForLoadState('networkidle');
		const off = [...paths];
		expect(off).not.toContain(STREAM_FILE);
		expect(off.filter(path => /constellation|\/images\/video\//i.test(path))).toEqual([]);
		expect(await page.evaluate(() => localStorage.getItem('tss:flags:home'))).toBeNull();

		// With the flag on the page asks for more. None of those files were asked for above.
		paths.length = 0;
		await page.goto('/?flags=home');
		await expect(stage(page)).toBeVisible();
		await expect(items(page).first()).toBeVisible();
		await page.waitForLoadState('networkidle');
		const added = paths.filter(path => !off.includes(path));
		expect(added).toContain(STREAM_FILE);
		expect(added.filter(path => path.endsWith('.js')).length).toBeGreaterThan(0);
		expect(outside).toEqual([]);
	});

	test('inner pages keep the banner and the footer', async ({ page }) => {
		await page.goto('/about');
		await expect(page.locator('.hero-banner')).toBeVisible();
		await expect(page.locator('footer')).toBeVisible();
	});

	test('without scripts ?flags=home is the ordinary home page', async ({ browser, baseURL }) => {
		const context = await browser.newContext({ javaScriptEnabled: false, baseURL });
		try {
			const page = await context.newPage();
			await page.goto('/?flags=home');
			await expect(page.locator('#latest')).toBeVisible();
			await expect(page.locator('.hero-banner')).toBeVisible();
			await expect(page.getByTestId('home-stage')).toHaveCount(0);
		} finally {
			await context.close();
		}
	});
});

test.describe('flag on: the heading stage', () => {
	test('replaces the banner, the second heading, the side column, the footer and the blob background', async ({ page }) => {
		await page.goto('/?flags=home');
		await expect(stage(page)).toBeVisible();
		await expect(page.locator('.hero-banner')).toHaveCount(0);
		await expect(page.getByText('Writing and notes.')).toHaveCount(0);
		await expect(page.locator('footer')).toHaveCount(0);
		await expect(page.locator('aside')).toHaveCount(0);
		await expect(page.getByTestId('blob-background')).toHaveCount(0);
		for (const id of ['#latest', '#pulse', '#archive']) await expect(page.locator(id)).toHaveCount(0);
		await expect(page.getByText(/Generated 1970|policy|schema/i)).toHaveCount(0);
		// One h1, one main, and the stage is as wide as the window.
		await expect(page.locator('h1')).toHaveCount(1);
		await expect(page.locator('h1')).toHaveText('Jess Sullivan');
		await expect(page.locator('main')).toHaveCount(1);
		const box = await stage(page).boundingBox();
		const width = page.viewportSize()!.width;
		expect(box!.x).toBe(0);
		expect(Math.round(box!.width)).toBe(await page.evaluate(() => document.documentElement.clientWidth));
		expect(box!.height).toBeGreaterThan(page.viewportSize()!.height * 0.6);
		expect(width).toBeGreaterThan(0);
		await expect(page).toHaveTitle('Jess Sullivan | transscendsurvival.org');
	});

	test('opens on the sky and plays itself through the heron and a placed item, with no input', async ({ page }) => {
		await page.goto('/?flags=home&stage-pace=12');
		await expect(stage(page)).toHaveAttribute('data-scene', 'sky');
		await expect(stage(page)).toHaveAttribute('data-playing', 'true');
		await expect(page.getByTestId('constellation-panel')).toBeVisible();
		await expect(stage(page)).toHaveAttribute('data-scene', 'heron', { timeout: 8000 });
		await expect(page.getByTestId('scene-heron').getByText('Trans Scend Survival')).toBeVisible();
		await expect(page.getByTestId('scene-heron').getByText('Jess Sullivan')).toBeVisible();
		await expect(page.getByTestId('scene-heron').locator('.definition')).toHaveCount(3);
		await expect(page.getByTestId('scene-heron').getByRole('img', { name: 'Great Blue Heron' })).toBeVisible();
		await expect(stage(page)).not.toHaveAttribute('data-scene', 'heron', { timeout: 8000 });
		const placed = page.getByTestId('scene-placed').first();
		await expect(placed.getByRole('link')).toHaveAttribute('href', /^\/blog\//);
		// And round again to the sky.
		await expect(stage(page)).toHaveAttribute('data-scene', 'sky', { timeout: 15000 });
	});

	test('loads only the first scene at first paint', async ({ page }) => {
		const paths = recordPaths(page);
		await page.goto('/?flags=home&stage-pace=1');
		await expect(stage(page)).toBeVisible();
		await expect(page.getByTestId('scene-heron').locator('img')).toHaveCount(0);
		expect(paths.filter(path => path.startsWith('/images/header'))).toEqual([]);
		// The next scene's photograph comes when the browser is idle, well before its turn.
		await expect(page.getByTestId('scene-heron').locator('img')).toHaveCount(1, { timeout: 8000 });
		await expect(stage(page)).toHaveAttribute('data-scene', 'sky');
	});

	test('a press on the stage stops the play for the visit, and Play starts it again', async ({ page }) => {
		await page.goto('/?flags=home&stage-pace=12');
		await expect(stage(page)).toHaveAttribute('data-playing', 'true');
		await expect(stage(page)).toHaveAttribute('data-scene', 'heron', { timeout: 8000 });
		await page.getByTestId('scene-heron').click({ position: { x: 20, y: 20 } });
		await expect(stage(page)).toHaveAttribute('data-playing', 'false');
		await page.waitForTimeout(3000);
		await expect(stage(page)).toHaveAttribute('data-scene', 'heron');
		const play = page.getByRole('button', { name: 'Play', exact: true });
		await expect(play).toBeVisible();
		await play.click();
		await expect(stage(page)).toHaveAttribute('data-playing', 'true');
		await expect(stage(page)).not.toHaveAttribute('data-scene', 'heron', { timeout: 8000 });
	});

	test('a wheel over the stage stops the play and still scrolls the page', async ({ page }) => {
		await page.goto('/?flags=home&stage-pace=4');
		await expect(stage(page)).toHaveAttribute('data-playing', 'true');
		await page.mouse.move(400, 300);
		await page.mouse.wheel(0, 500);
		await expect(stage(page)).toHaveAttribute('data-playing', 'false');
		await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(300);
	});

	test('Pause holds until Play, and Next steps a scene', async ({ page }) => {
		await page.goto('/?flags=home&stage-pace=12');
		await expect(stage(page)).toHaveAttribute('data-playing', 'true');
		const pause = page.getByRole('button', { name: 'Pause', exact: true });
		await pause.click();
		await expect(stage(page)).toHaveAttribute('data-playing', 'false');
		await page.waitForTimeout(2500);
		await expect(stage(page)).toHaveAttribute('data-scene', 'sky');
		await page.getByRole('button', { name: 'Next', exact: true }).click();
		await expect(stage(page)).toHaveAttribute('data-scene', 'heron');
		await page.waitForTimeout(2500);
		await expect(stage(page)).toHaveAttribute('data-scene', 'heron');
		await expect(stage(page)).toHaveAttribute('data-playing', 'false');
	});

	test('the controls work by keyboard: arrows step the scenes, and every control has a name', async ({ page }) => {
		await page.goto('/?flags=home');
		await expect(stage(page)).toHaveAttribute('data-playing', 'true');
		const pause = page.getByTestId('stage-pause');
		await pause.focus();
		await expect(pause).toHaveAttribute('aria-label', 'Pause');
		await page.keyboard.press('ArrowRight');
		await expect(stage(page)).toHaveAttribute('data-scene', 'heron');
		await page.keyboard.press('ArrowLeft');
		await expect(stage(page)).toHaveAttribute('data-scene', 'sky');
		await page.keyboard.press('Enter');
		await expect(stage(page)).toHaveAttribute('data-playing', 'false');
		await expect(pause).toHaveAttribute('aria-label', 'Play');
		for (const button of await stage(page).getByRole('group', { name: 'Heading scenes' }).getByRole('button').all()) expect(await button.getAttribute('aria-label')).toBeTruthy();
		// Scenes that are not on show cannot take focus.
		await expect(page.getByTestId('scene-heron')).toHaveAttribute('inert', '');
	});

	test('with reduced motion nothing plays: the sky shows still and the controls step', async ({ browser, baseURL }) => {
		const context = await browser.newContext({ baseURL, reducedMotion: 'reduce' });
		try {
			const page = await context.newPage();
			await page.goto('/?flags=home&stage-pace=50');
			await expect(stage(page)).toHaveAttribute('data-scene', 'sky');
			await page.waitForTimeout(2500);
			await expect(stage(page)).toHaveAttribute('data-scene', 'sky');
			await expect(stage(page)).toHaveAttribute('data-playing', 'false');
			await expect(page.getByTestId('stage-pause')).toHaveCount(0);
			await page.getByRole('button', { name: 'Next', exact: true }).click();
			await expect(stage(page)).toHaveAttribute('data-scene', 'heron');
			const drift = await page.getByTestId('scene-heron').locator('img').evaluate(image => getComputedStyle(image).animationName);
			expect(drift).toBe('none');
			await page.getByRole('button', { name: 'Previous', exact: true }).click();
			await expect(stage(page)).toHaveAttribute('data-scene', 'sky');
		} finally {
			await context.close();
		}
	});

	test('?flags=none brings the ordinary home page back and forgets the preference', async ({ page }) => {
		await page.goto('/?flags=home');
		await expect(stage(page)).toBeVisible();
		expect(await page.evaluate(() => localStorage.getItem('tss:flags:home'))).toBe('on');
		await page.goto('/');
		await expect(stage(page)).toBeVisible();
		await page.goto('/about');
		// Inner pages get the slim top bar only.
		await expect(page.locator('.hero-banner')).toHaveCount(0);
		await expect(page.locator('footer')).toBeVisible();
		await page.goto('/?flags=none');
		await expect(page.locator('#latest')).toBeVisible();
		await expect(page.locator('.hero-banner')).toBeVisible();
		await expect(stage(page)).toHaveCount(0);
		expect(await page.evaluate(() => localStorage.getItem('tss:flags:home'))).toBeNull();
	});
});

test.describe('flag on: the one mixed stream', () => {
	test('shows mixed kinds newest first, with no card, border or label', async ({ page }) => {
		await page.goto('/?flags=home');
		await expect(items(page).first()).toBeVisible();
		// Reveal the stream to its end by the real More control.
		const more = page.getByTestId('stream-more');
		for (let i = 0; i < 40 && (await more.count()) > 0; i += 1) await more.click();
		const kinds = await items(page).evaluateAll(nodes => nodes.map(node => node.getAttribute('data-kind')));
		expect(new Set(kinds)).toEqual(new Set(['article', 'photos', 'recording', 'video']));
		expect(kinds.length).toBeGreaterThan(150);
		// Nothing in the stream draws a border or a filled panel behind an item.
		const boxed = await items(page).evaluateAll(nodes => nodes.filter(node => {
			const style = getComputedStyle(node);
			return parseFloat(style.borderTopWidth) + parseFloat(style.borderBottomWidth) + parseFloat(style.borderLeftWidth) > 0 || style.backgroundColor !== 'rgba(0, 0, 0, 0)' || style.boxShadow !== 'none';
		}).length);
		expect(boxed).toBe(0);
		await expect(page.getByTestId('home-stream').getByText(/💬|🐦/)).toHaveCount(0);
		// The end of the stream: back to the sky, and the plain list of all posts.
		const end = page.locator('.end a');
		await expect(end).toHaveText(['Back to the sky', 'All posts']);
		await expect(end.nth(1)).toHaveAttribute('href', '/blog');
	});

	test('a filter shows one kind, marks itself, and lives in the address', async ({ page }) => {
		await page.goto('/?flags=home');
		const filters = page.getByRole('navigation', { name: 'Show' });
		await expect(filters.getByRole('link')).toHaveText(['All', 'Writing', 'Photos', 'Recordings', 'Video']);
		await expect(filters.getByRole('link', { name: 'All', exact: true })).toHaveAttribute('aria-current', 'true');
		await filters.getByRole('link', { name: 'Photos', exact: true }).click();
		await expect(page).toHaveURL(/show=photos/);
		await expect(filters.getByRole('link', { name: 'Photos', exact: true })).toHaveAttribute('aria-current', 'true');
		await expect(items(page).first()).toHaveAttribute('data-kind', 'photos');
		expect(new Set(await items(page).evaluateAll(nodes => nodes.map(node => node.getAttribute('data-kind'))))).toEqual(new Set(['photos']));
		const lead = items(page).first().locator('a.lead');
		await expect(lead).toHaveAttribute('href', /^\/blog\//);
		const image = lead.locator('img');
		await expect(image).toHaveAttribute('width', /\d+/);
		await expect(image).toHaveAttribute('height', /\d+/);
		await expect.poll(() => image.evaluate((node: HTMLImageElement) => node.complete && node.naturalWidth)).toBeGreaterThan(0);
		// The address is shareable: a fresh load of it opens on the same filter.
		await page.goto('/?flags=home&show=recordings');
		await expect(filters.getByRole('link', { name: 'Recordings', exact: true })).toHaveAttribute('aria-current', 'true');
		await expect(items(page)).toHaveCount(3);
		await filters.getByRole('link', { name: 'All', exact: true }).click();
		await expect(page).not.toHaveURL(/show=/);
		await expect(items(page).first()).toHaveAttribute('data-kind', 'article');
	});

	test('a recording loads its SoundCloud player only on a press', async ({ page }) => {
		const paths = recordPaths(page);
		await page.goto('/?flags=home&show=recordings');
		const first = items(page).first();
		await expect(first).toHaveAttribute('data-kind', 'recording');
		await expect(page.locator('iframe')).toHaveCount(0);
		await page.waitForLoadState('networkidle');
		expect(outside).toEqual([]);
		await first.getByTestId('recording-play').click();
		const frame = first.locator('iframe');
		await expect(frame).toHaveAttribute('src', /^https:\/\/w\.soundcloud\.com\/player\/\?url=https%3A%2F%2Fsoundcloud\.com%2Fjesssullivan%2F/);
		await expect(page.locator('iframe')).toHaveCount(1);
		await expect.poll(() => outside.filter(url => url.startsWith('https://w.soundcloud.com/')).length).toBe(1);
		expect(paths.filter(path => path.includes('soundcloud'))).toEqual([]);
	});

	test('a video shows its poster and loads the YouTube no-cookie frame only on a press, in the same box', async ({ page }) => {
		await page.goto('/?flags=home&show=video');
		const first = items(page).first();
		await expect(first).toHaveAttribute('data-kind', 'video');
		await expect(page.locator('iframe')).toHaveCount(0);
		const poster = first.locator('.frame img');
		await expect(poster).toHaveAttribute('src', /^\/images\/video\/[A-Za-z0-9_-]{11}\.jpg$/);
		await expect.poll(() => poster.evaluate((node: HTMLImageElement) => node.complete && node.naturalWidth)).toBeGreaterThan(0);
		const before = await first.locator('.frame').boundingBox();
		await page.waitForLoadState('networkidle');
		expect(outside).toEqual([]);
		await first.getByTestId('video-play').click();
		await expect(first.locator('iframe')).toHaveAttribute('src', /^https:\/\/www\.youtube-nocookie\.com\/embed\/[A-Za-z0-9_-]{11}\?autoplay=1$/);
		expect(await first.locator('.frame').boundingBox()).toEqual(before);
		await expect.poll(() => outside.filter(url => url.startsWith('https://www.youtube-nocookie.com/')).length).toBe(1);
		expect(outside.every(url => url.startsWith('https://www.youtube-nocookie.com/'))).toBe(true);
	});

	test('a title shows its day and reading time on focus', async ({ page }) => {
		await page.goto('/?flags=home&show=writing');
		const title = items(page).first().locator('h2 a');
		await expect(title).toHaveAttribute('data-tip', /^[A-Z][a-z]{2} \d{1,2}, \d{4} · \d+ min read$/);
		await page.keyboard.press('Tab');
		await title.focus();
		const tip = await title.evaluate(node => getComputedStyle(node, '::after').content);
		expect(tip).toMatch(/min read/);
	});

	test('the link at the end of the stream goes back up to the sky', async ({ page }) => {
		await page.goto('/?flags=home&show=recordings');
		await page.getByTestId('stage-next').click();
		await expect(stage(page)).toHaveAttribute('data-scene', 'heron');
		await page.getByRole('link', { name: 'Back to the sky' }).click();
		await expect(stage(page)).toHaveAttribute('data-scene', 'sky');
		await expect.poll(() => stage(page).evaluate(node => Math.round(node.getBoundingClientRect().top))).toBeLessThan(200);
	});
});

test.describe('flag on: a phone', () => {
	test.use({ viewport: { width: 390, height: 844 } });

	test('has no sideways scroll on any scene or down the stream', async ({ page }) => {
		await page.goto('/?flags=home');
		await expect(stage(page)).toBeVisible();
		await expect(items(page).first()).toBeVisible();
		await noSidewaysScroll(page);
		const next = page.getByTestId('stage-next');
		for (let i = 0; i < 4; i += 1) {
			await next.click();
			await page.waitForTimeout(400);
			await noSidewaysScroll(page);
		}
		// The type of a photograph scene fits the screen.
		const scene = await stage(page).getAttribute('data-scene');
		const copy = page.locator('.scene.on .copy');
		if (scene !== 'sky') {
			const box = await copy.boundingBox();
			expect(box!.x).toBeGreaterThanOrEqual(0);
			expect(box!.x + box!.width).toBeLessThanOrEqual(390);
		}
		for (const show of ['photos', 'video', 'recordings', 'writing']) {
			await page.goto(`/?flags=home&show=${show}`);
			await expect(items(page).first()).toBeVisible();
			await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
			await noSidewaysScroll(page);
		}
		// Every control is big enough for a thumb.
		for (const button of await page.getByRole('group', { name: 'Heading scenes' }).getByRole('button').all()) {
			const box = await button.boundingBox();
			expect(Math.min(box!.width, box!.height)).toBeGreaterThanOrEqual(44);
		}
	});
});
