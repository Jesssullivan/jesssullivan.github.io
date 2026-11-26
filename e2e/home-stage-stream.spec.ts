import { test, expect, type Page } from '@playwright/test';

// The home page behind ?flags=home (TIN-8657): the heading stage and the one mixed stream.
// Off, the home page is the one production serves today and asks for nothing new.

// Everything the page brings with it is named by its content, so a browser may keep it.
const STREAM_FILE = /^\/_app\/immutable\/assets\/home-stream\.v1\.[\w-]+\.json$/;
const HERON_FILE = /^\/_app\/immutable\/assets\/heron-1200\.[\w-]+\.(?:avif|webp)$/;
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
// The site footer. The mobile drawer and the Pulse section have footers of their own.
const siteFooter = (page: Page) => page.locator('footer').filter({ hasText: 'Dedicated to the public domain' });

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
		await expect(siteFooter(page)).toBeVisible();
		await expect(page.locator('aside')).toBeVisible();
		await expect(page.getByTestId('blob-background')).toBeAttached();
		await expect(page).toHaveTitle('Jess Sullivan — Latest, Pulse, Archive');
		await expect(stage(page)).toHaveCount(0);
		await expect(page.getByTestId('home-stream')).toHaveCount(0);
		await page.waitForLoadState('networkidle');
		const off = [...paths];
		expect(off.filter(path => /home-stream|heron-|constellation|\/images\/video\/|\/assets\/Home\./i.test(path))).toEqual([]);
		expect(await page.evaluate(() => localStorage.getItem('tss:flags:home'))).toBeNull();
		// No file of its own for the flag, and none of the sky's or the stage's code: the page asks for the scripts it asks for on main.
		const scripts = [...new Set(off.filter(path => path.endsWith('.js')))];
		const texts = await Promise.all(scripts.map(async path => ({ path, text: await (await page.request.get(path)).text() })));
		expect(texts.filter(file => file.text.includes('tss:flags:home')).map(file => file.path.replace(/\.[\w-]+\.js$/, ''))).toEqual(['/_app/immutable/nodes/0']);
		expect(texts.filter(file => /constellation-panel|home-stage-stream|stage-pace/.test(file.text)).map(file => file.path)).toEqual([]);

		// With the flag on the page asks for more. None of those files were asked for above.
		paths.length = 0;
		await page.goto('/?flags=home');
		await expect(stage(page)).toBeVisible();
		await expect(items(page).first()).toBeVisible();
		await page.waitForLoadState('networkidle');
		const added = paths.filter(path => !off.includes(path));
		expect(added.filter(path => STREAM_FILE.test(path))).toHaveLength(1);
		expect(added).not.toContain('/data/home-stream.v1.json');
		expect(added.filter(path => path.endsWith('.js')).length).toBeGreaterThan(0);
		expect(outside).toEqual([]);
	});

	test('inner pages keep the banner and the footer', async ({ page }) => {
		await page.goto('/about');
		await expect(page.locator('.hero-banner')).toBeVisible();
		await expect(siteFooter(page)).toBeVisible();
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
		await expect(siteFooter(page)).toHaveCount(0);
		await expect(page.locator('aside')).toHaveCount(0);
		await expect(page.getByTestId('blob-background')).toHaveCount(0);
		for (const id of ['#latest', '#pulse', '#archive']) await expect(page.locator(id)).toHaveCount(0);
		await expect(page.getByText(/Generated 1970|Reviewed public Pulse details/i)).toHaveCount(0);
		await expect(page.getByText(/policy|schema/i).filter({ visible: true })).toHaveCount(0);
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
		await expect(page.getByTestId('scene-placed').locator('img')).toHaveCount(0);
		// The next scene's photograph comes when the browser is idle, well before its turn. The ones after it wait.
		await expect(page.getByTestId('scene-heron').locator('img')).toHaveCount(1, { timeout: 8000 });
		await expect(page.getByTestId('scene-placed').locator('img')).toHaveCount(0);
		await expect(stage(page)).toHaveAttribute('data-scene', 'sky');
		// The heron comes at its own size, under a name with a content hash in it.
		await expect.poll(() => paths.filter(path => HERON_FILE.test(path)).length).toBe(1);
		const heron = page.getByTestId('scene-heron').locator('img');
		await expect.poll(() => heron.evaluate((node: HTMLImageElement) => node.naturalWidth)).toBe(1200);
		expect(await heron.evaluate((node: HTMLImageElement) => new URL(node.currentSrc).pathname)).toMatch(HERON_FILE);
	});

	test('the ordinary page and the new one change places in one step', async ({ page }) => {
		// What is on the page at each change: the banner, the Latest section, the stage, the stream.
		await page.addInitScript(() => {
			const seen: string[] = [];
			(window as unknown as { __seen: string[] }).__seen = seen;
			const look = () => {
				const has = (selector: string) => (document.querySelector(selector) ? 1 : 0);
				const state = `${has('.hero-banner')}${has('#latest')}${has('[data-testid=home-stage]')}${has('[data-testid=stream-item]')}`;
				if (seen[seen.length - 1] !== state) seen.push(state);
			};
			new MutationObserver(look).observe(document, { childList: true, subtree: true });
		});
		await page.goto('/?flags=home');
		await expect(stage(page)).toBeVisible();
		const seen = await page.evaluate(() => (window as unknown as { __seen: string[] }).__seen);
		// Never the ordinary page with its banner taken off, and never the stage without its stream.
		expect(seen.slice(seen.indexOf('1100'))).toEqual(['1100', '0011']);
		await expect(stage(page)).toHaveClass(/arrives/);
	});

	test('a mouse that moves over a scene holds it, and it goes on when the mouse leaves or rests', async ({ page }) => {
		await page.goto('/?flags=home&stage-pace=4');
		await expect(stage(page)).toHaveAttribute('data-playing', 'true');
		const box = (await page.locator('.stage .scenes').boundingBox())!;
		await page.mouse.move(box.x + 200, box.y + 30);
		await expect(stage(page)).toHaveAttribute('data-playing', 'false');
		// The play only waits, so the control still offers Pause.
		await expect(page.getByTestId('stage-pause')).toHaveAttribute('aria-label', 'Pause');
		// Three seconds of reading, past the sky's hold at this pace.
		for (let i = 0; i < 15; i += 1) {
			await page.mouse.move(box.x + 200 + i * 6, box.y + 30);
			await page.waitForTimeout(200);
		}
		await expect(stage(page)).toHaveAttribute('data-scene', 'sky');
		await page.mouse.move(box.x + 200, box.y + box.height + 20);
		await expect(stage(page)).toHaveAttribute('data-playing', 'true');
		await expect(stage(page)).toHaveAttribute('data-scene', 'heron', { timeout: 8000 });
		// A mouse that comes back and then rests holds the scene only for a moment.
		await page.mouse.move(box.x + 200, box.y + 30);
		await expect(stage(page)).toHaveAttribute('data-playing', 'false');
		await expect(stage(page)).toHaveAttribute('data-playing', 'true', { timeout: 3000 });
	});

	test('a device that misses the frame budget gets a plain fade: no blur and no drift', async ({ page }) => {
		await page.goto('/?flags=home');
		await expect(stage(page)).toHaveAttribute('data-still', 'false');
		await expect(items(page).first()).toBeAttached();
		// Every frame from here on reports itself 80 milliseconds late, as a slow device would.
		await page.evaluate(() => {
			const real = window.requestAnimationFrame.bind(window);
			let late = 0;
			window.requestAnimationFrame = run => real(now => run(now + (late += 80)));
		});
		const next = page.getByTestId('stage-next');
		await next.focus();
		await page.keyboard.press('ArrowRight');
		await expect(stage(page)).toHaveAttribute('data-scene', 'heron');
		await expect(stage(page)).toHaveAttribute('data-still', 'true');
		await expect(page.getByTestId('home-stage-stream')).toHaveClass(/calm/);
		const heron = page.getByTestId('scene-heron');
		expect(await heron.locator('img').evaluate(node => getComputedStyle(node).filter)).toBe('none');
		expect(await heron.locator('img').evaluate(node => getComputedStyle(node).animationPlayState)).toBe('paused');
		// The type just shows.
		expect(await heron.locator('.heron-title').evaluate(node => getComputedStyle(node).transform)).toBe('none');
	});

	test('every icon control has a tooltip and a focus ring', async ({ page }) => {
		await page.goto('/?flags=home&show=recordings');
		await expect(stage(page)).toBeVisible();
		const plays = page.getByTestId('recording-play');
		const controls = [...(await page.getByRole('group', { name: 'Heading scenes' }).getByRole('button').all()), plays.first(), plays.last()];
		expect(controls.length).toBe(4);
		// A stage control and a recording of its own say what they do. A recording a post holds says what plays.
		for (const control of controls.slice(0, 2)) await expect(control).toHaveAttribute('data-tip', /^(?:Pause|Play|Next)$/);
		await expect(controls[2]).toHaveAttribute('data-tip', 'Morning Metal 4.22.21 "Sleepish"');
		await expect(controls[3]).toHaveAttribute('data-tip', 'Play');
		// Reached by keyboard, a control draws a ring and shows its tooltip.
		const reach = async (control: (typeof controls)[number]) => {
			await control.focus();
			await page.keyboard.press('Shift+Tab');
			await page.keyboard.press('Tab');
			await expect(control).toBeFocused();
			expect(await control.evaluate(node => getComputedStyle(node).outlineStyle)).toBe('solid');
		};
		for (const control of controls) {
			expect(await control.getAttribute('aria-label')).toContain((await control.getAttribute('data-tip'))!);
			await reach(control);
			await expect.poll(() => control.evaluate(node => getComputedStyle(node, '::after').opacity)).toBe('1');
		}
		// A video's poster is its play control: the ring is on the poster, and the tooltip on the sign that lies on it.
		const poster = page.getByTestId('video-play').first();
		const sign = poster.locator('[data-tip]');
		await expect(sign).toHaveAttribute('data-tip', 'Morning Metal 04.23.21');
		expect(await poster.getAttribute('aria-label')).toBe('Play Morning Metal 04.23.21');
		await reach(poster);
		await expect.poll(() => sign.evaluate(node => getComputedStyle(node, '::after').opacity)).toBe('1');
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
		// The stream gives the page somewhere to scroll to.
		await expect(items(page).first()).toBeAttached();
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
		// Focus alone leaves the play running, so Tab can reach Pause, and Enter on it pauses.
		await pause.focus();
		await expect(pause).toHaveAttribute('aria-label', 'Pause');
		await expect(stage(page)).toHaveAttribute('data-playing', 'true');
		await page.keyboard.press('Enter');
		await expect(stage(page)).toHaveAttribute('data-playing', 'false');
		await expect(pause).toHaveAttribute('aria-label', 'Play');
		await page.keyboard.press('ArrowRight');
		await expect(stage(page)).toHaveAttribute('data-scene', 'heron');
		await page.keyboard.press('ArrowLeft');
		await expect(stage(page)).toHaveAttribute('data-scene', 'sky');
		await expect(stage(page)).toHaveAttribute('data-playing', 'false');
		for (const button of await stage(page).getByRole('group', { name: 'Heading scenes' }).getByRole('button').all()) expect(await button.getAttribute('aria-label')).toBeTruthy();
		// Scenes that are not on show cannot take focus.
		await expect(page.getByTestId('scene-heron')).toHaveAttribute('inert', '');
	});

	// Three loads and three waits of four seconds are three tests, so a busy host has thirty seconds for each.
	test('a key pressed on a control stops the play for the visit, and Play starts it again', async ({ page }) => {
		// Any key with a control in focus.
		await page.goto('/?flags=home&stage-pace=20');
		await expect(stage(page)).toHaveAttribute('data-playing', 'true');
		const pause = page.getByTestId('stage-pause');
		await pause.focus();
		await page.keyboard.press('a');
		await expect(stage(page)).toHaveAttribute('data-playing', 'false');
		await expect(pause).toHaveAttribute('aria-label', 'Play');
		const stoppedOn = await stage(page).getAttribute('data-scene');
		// Four seconds at this pace is more than every scene's hold.
		await page.waitForTimeout(4000);
		await expect(stage(page)).toHaveAttribute('data-scene', stoppedOn!);
		// Play is the visitor's word: the stage moves again.
		await page.keyboard.press('Enter');
		await expect(stage(page)).toHaveAttribute('data-playing', 'true');
		await expect(stage(page)).not.toHaveAttribute('data-scene', stoppedOn!, { timeout: 8000 });
	});

	test('an arrow key on Next steps one scene and the play stops there', async ({ page }) => {
		await page.goto('/?flags=home&stage-pace=20');
		await expect(stage(page)).toHaveAttribute('data-playing', 'true');
		await page.getByTestId('stage-next').focus();
		await page.keyboard.press('ArrowRight');
		await expect(stage(page)).toHaveAttribute('data-playing', 'false');
		const steppedTo = await stage(page).getAttribute('data-scene');
		await page.waitForTimeout(4000);
		await expect(stage(page)).toHaveAttribute('data-scene', steppedTo!);
	});

	test('a press on Next steps one scene and the play stops there', async ({ page }) => {
		await page.goto('/?flags=home&stage-pace=20');
		await expect(stage(page)).toHaveAttribute('data-playing', 'true');
		await page.getByTestId('stage-next').click();
		await expect(stage(page)).toHaveAttribute('data-playing', 'false');
		const pressedTo = await stage(page).getAttribute('data-scene');
		await page.waitForTimeout(4000);
		await expect(stage(page)).toHaveAttribute('data-scene', pressedTo!);
		await expect(page.getByTestId('stage-pause')).toHaveAttribute('aria-label', 'Play');
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

	test('a visitor who also kept the older sky flag sees the page move once: the sky\'s room goes as the two pages change places', async ({ page }) => {
		await page.addInitScript(() => {
			localStorage.setItem('tss:flags:constellation', 'on');
			localStorage.setItem('tss:flags:home', 'on');
			const seen: string[] = [];
			(window as unknown as { __seen: string[] }).__seen = seen;
			const look = () => {
				const room = document.documentElement.hasAttribute('data-sky') ? 'room' : 'none';
				// Until the ordinary page's own sections are in the document there is nothing to move.
				const state = `${room}:${document.querySelector('[data-testid=home-stage]') ? 'stage' : document.querySelector('#latest') ? 'old' : 'empty'}`;
				if (seen[seen.length - 1] !== state) seen.push(state);
			};
			new MutationObserver(look).observe(document, { childList: true, subtree: true, attributes: true, attributeFilter: ['data-sky'] });
		});
		await page.goto('/');
		await expect(stage(page)).toBeVisible();
		await expect(page.locator('html')).not.toHaveAttribute('data-sky');
		const seen = await page.evaluate(() => (window as unknown as { __seen: string[] }).__seen);
		// The ordinary page never loses the room it painted with while it waits.
		expect(seen).not.toContain('none:old');
		expect(await page.locator('#main-content').evaluate(node => getComputedStyle(node).paddingTop)).toBe('0px');
		// The older flag stands down: its section is not on the page, and it asks no other host for anything.
		await expect(page.getByTestId('home-reader-broker-state')).toHaveCount(0);
		expect(outside).toEqual([]);
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
		await expect(siteFooter(page)).toBeVisible();
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
		// Each press is one step in the page: find the control and press it. The control moves down as a part
		// arrives and leaves with the last part, so a press that first waits for it to rest, or to be there, can wait for good.
		await expect.poll(async () => {
			await page.evaluate(() => document.querySelector<HTMLElement>('[data-testid=stream-more]')?.click());
			return more.count();
		}, { timeout: 25_000, intervals: [150] }).toBe(0);
		const kinds = await items(page).evaluateAll(nodes => nodes.map(node => node.getAttribute('data-kind')));
		expect(new Set(kinds)).toEqual(new Set(['article', 'recording', 'video']));
		expect(kinds.length).toBeGreaterThan(140);
		// A post holds its own photographs, its recording and its video, so every kind is here though no item is only photographs.
		const held = await items(page).evaluateAll(nodes => nodes.flatMap(node => (node.getAttribute('data-kinds') ?? '').split(' ')));
		expect(new Set(held)).toEqual(new Set(['article', 'photos', 'recording', 'video']));
		// One subject shows once: no title is in the stream twice.
		const titles = await items(page).evaluateAll(nodes => nodes.map(node => node.querySelector('h2')?.textContent?.trim() ?? ''));
		expect(titles.filter((title, index) => titles.indexOf(title) !== index)).toEqual([]);
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
		// Chosen from the first screen, the filter brings the stream up, so the choice shows.
		await expect.poll(() => filters.evaluate(node => Math.round(node.getBoundingClientRect().top))).toBeLessThan(120);
		await expect(filters.getByRole('link', { name: 'Photos', exact: true })).toHaveAttribute('aria-current', 'true');
		await expect(items(page).first()).toHaveAttribute('data-kinds', /\bphotos\b/);
		// Every item under the filter holds photographs, and shows them with its title.
		expect(await items(page).evaluateAll(nodes => nodes.every(node => (node.getAttribute('data-kinds') ?? '').split(' ').includes('photos') && node.querySelector('.show img') && node.querySelector('h2')))).toBe(true);
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

	test('a set of photographs is counted only when the post holds more than the set shows', async ({ page }) => {
		await page.goto('/?flags=home&show=photos');
		await expect(items(page).first()).toHaveAttribute('data-kinds', /\bphotos\b/);
		await expect.poll(async () => {
			await page.evaluate(() => document.querySelector<HTMLElement>('[data-testid=stream-more]')?.click());
			return page.getByTestId('stream-more').count();
		}, { timeout: 25_000, intervals: [150] }).toBe(0);
		const sets = await items(page).evaluateAll(nodes => nodes.map(node => ({
			shown: node.querySelectorAll('.show img').length,
			total: Number(node.querySelector('[data-testid=set-total]')?.textContent?.match(/^(\d+) photographs$/)?.[1] ?? 0),
		})));
		expect(sets.length).toBeGreaterThan(8);
		// A count says there are more photographs in the post than on screen. It never says what the reader can see.
		for (const set of sets) expect(set.total === 0 || set.total > set.shown, JSON.stringify(set)).toBe(true);
		expect(sets.some(set => set.total > set.shown)).toBe(true);
		expect(sets.some(set => set.total === 0 && set.shown > 1)).toBe(true);
		await expect(page.getByTestId('home-stream').getByText(/^\d+ photographs$/)).toHaveCount(sets.filter(set => set.total).length);
	});

	test('a recording loads its SoundCloud player only on a press', async ({ page }) => {
		const paths = recordPaths(page);
		await page.goto('/?flags=home&show=recordings');
		const first = items(page).first();
		await expect(first).toHaveAttribute('data-kinds', /\brecording\b/);
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
		await expect(first).toHaveAttribute('data-kinds', /\bvideo\b/);
		await expect(page.locator('iframe')).toHaveCount(0);
		const poster = first.locator('.frame img');
		await expect(poster).toHaveAttribute('src', /\/_app\/immutable\/assets\/[A-Za-z0-9_-]{11}\.[\w-]+\.jpg$/);
		await expect.poll(() => poster.evaluate((node: HTMLImageElement) => node.complete && node.naturalWidth)).toBeGreaterThan(0);
		// The frame's place within its item, whatever the page has scrolled to.
		const place = () => first.evaluate(node => {
			const item = node.getBoundingClientRect();
			const frame = node.querySelector('.frame')!.getBoundingClientRect();
			return [frame.left - item.left, frame.top - item.top, frame.width, frame.height].map(Math.round);
		});
		const before = await place();
		await page.waitForLoadState('networkidle');
		expect(outside).toEqual([]);
		await first.getByTestId('video-play').click();
		await expect(first.locator('iframe')).toHaveAttribute('src', /^https:\/\/www\.youtube-nocookie\.com\/embed\/[A-Za-z0-9_-]{11}\?autoplay=1$/);
		expect(await place()).toEqual(before);
		await expect.poll(() => outside.filter(url => url.startsWith('https://www.youtube-nocookie.com/')).length).toBe(1);
		expect(outside.every(url => url.startsWith('https://www.youtube-nocookie.com/'))).toBe(true);
	});

	test('a post, its video and its recording show as one item, under each kind it holds', async ({ page }) => {
		// A title is found by its text. Its tooltip is drawn by the style sheet, and a role's name would count it.
		const title = 'Morning Metal 4.22.21 \u201cSleepish\u201d';
		for (const show of ['video', 'recordings', 'writing']) {
			await page.goto(`/?flags=home&show=${show}`);
			await expect(items(page).first()).toBeVisible();
			if (show === 'writing') {
				await expect.poll(async () => {
					await page.evaluate(() => document.querySelector<HTMLElement>('[data-testid=stream-more]')?.click());
					return page.getByTestId('stream-more').count();
				}, { timeout: 25_000, intervals: [150] }).toBe(0);
			}
			const item = items(page).filter({ has: page.locator('h2', { hasText: title }) });
			await expect(item, show).toHaveCount(1);
			await expect(item).toHaveAttribute('data-kinds', 'article recording video');
			// One title and one summary, with a play control for the video and one for the recording, each under its own name.
			await expect(item.getByRole('heading')).toHaveCount(1);
			await expect(item.getByRole('button', { name: 'Play Morning Metal 04.23.21' })).toHaveCount(1);
			await expect(item.getByRole('button', { name: 'Play Morning Metal 4.22.21 "Sleepish"' })).toHaveCount(1);
			await expect(item.locator('iframe')).toHaveCount(0);
		}
		// Each player loads on its own press, and the other stays as it was.
		const item = items(page).filter({ has: page.locator('h2', { hasText: title }) });
		await item.getByTestId('recording-play').click();
		await expect(item.locator('iframe')).toHaveCount(1);
		await expect(item.locator('iframe')).toHaveAttribute('src', /^https:\/\/w\.soundcloud\.com\/player\//);
		await item.getByTestId('video-play').click();
		await expect(item.locator('iframe')).toHaveCount(2);
		await expect(item.locator('.frame iframe')).toHaveAttribute('src', /^https:\/\/www\.youtube-nocookie\.com\/embed\/JVusudpKTF8\?autoplay=1$/);
		// Two videos of one title and one day are one item with two posters.
		await page.goto('/?flags=home&show=video');
		await expect(items(page)).toHaveCount(3);
		const pair = items(page).filter({ has: page.locator('h2', { hasText: 'Shortest Morning Metal 7 8 20' }) });
		await expect(pair).toHaveCount(1);
		await expect(pair.getByTestId('video-play')).toHaveCount(2);
	});

	test('on a wide screen the words and what there is to see start on two lines, and a picture is in the first screen of the stream', async ({ page }) => {
		for (const [width, height] of [[1440, 900], [1920, 1080]]) {
			await page.setViewportSize({ width, height });
			await page.goto('/?flags=home');
			await expect(items(page).first()).toBeVisible();
			await page.getByTestId('home-stream').evaluate(node => node.scrollIntoView({ block: 'start', behavior: 'instant' }));
			const seen = await items(page).evaluateAll(nodes => nodes.map(node => {
				const box = (selector: string) => node.querySelector(selector)?.getBoundingClientRect();
				const [title, summary, show] = [box('h2'), box('.summary'), box('.show')];
				return { title: title && Math.round(title.left), summary: summary && Math.round(summary.left), show: show && { left: Math.round(show.left), right: Math.round(show.right), top: Math.round(show.top) }, measure: summary ? Math.round(summary.width) : 0 };
			}));
			// Every title starts on one line.
			expect(new Set(seen.map(item => item.title)).size, `${width}`).toBe(1);
			// What there is to see starts on a second line, and so does the summary of a piece with nothing to show.
			const second = new Set([...seen.filter(item => item.show).map(item => item.show!.left), ...seen.filter(item => !item.show && item.summary).map(item => item.summary!)]);
			expect(second.size, `${width}`).toBe(1);
			expect([...second][0]).toBeGreaterThan(width * 0.45);
			// A wide picture runs out to the edge of the screen. Nothing runs past it.
			expect(Math.max(...seen.filter(item => item.show).map(item => item.show!.right))).toBeGreaterThan(width - 20);
			await noSidewaysScroll(page);
			// The first picture is in the first screen of the stream.
			expect(Math.min(...seen.filter(item => item.show).map(item => item.show!.top))).toBeLessThan(height - 120);
			// Text keeps a readable measure.
			for (const item of seen.filter(item => item.measure)) expect(item.measure).toBeLessThanOrEqual(640);
		}
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
