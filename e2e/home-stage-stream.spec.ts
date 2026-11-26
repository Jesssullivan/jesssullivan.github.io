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
		// Every scene the stage shows is written down as it changes. At this pace the sky is on for three quarters of a second, which a look once a second can miss.
		await page.addInitScript(() => {
			const shown: string[] = [];
			(window as unknown as { __shown: string[] }).__shown = shown;
			new MutationObserver(() => {
				const scene = document.querySelector('[data-testid=home-stage]')?.getAttribute('data-scene');
				if (scene && shown[shown.length - 1] !== scene) shown.push(scene);
			}).observe(document, { subtree: true, childList: true, attributes: true, attributeFilter: ['data-scene'] });
		});
		await page.goto('/?flags=home&stage-pace=12');
		await expect.poll(() => page.evaluate(() => (window as unknown as { __shown: string[] }).__shown[0])).toBe('sky');
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
		// And round again to the sky, after every scene has had its turn in order.
		await expect.poll(() => page.evaluate(() => (window as unknown as { __shown: string[] }).__shown.indexOf('sky', 1)), { timeout: 15000 }).toBeGreaterThan(0);
		const shown = await page.evaluate(() => (window as unknown as { __shown: string[] }).__shown);
		// One round: the sky, the heron, each placed item once, and the sky again.
		const round = shown.slice(0, shown.indexOf('sky', 1) + 1);
		expect(round[0]).toBe('sky');
		expect(round[1]).toBe('heron');
		expect(round.length).toBeGreaterThanOrEqual(4);
		expect(new Set(round).size).toBe(round.length - 1);
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
		const controls = [page.getByTestId('stage-pause'), page.getByTestId('stage-next'), plays.first(), plays.last()];
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

// RM66: one row of controls. The sky draws no control of its own on this page, and its legend lies along the top edge.
const SKY_NAMES = { reset: 'Reset', zoomOut: 'Zoom out', zoomIn: 'Zoom in', list: 'Show as a list', help: 'How it works' } as const;
const row = (page: Page) => page.getByTestId('home-row');
const skyControl = (page: Page, id: keyof typeof SKY_NAMES) => page.getByTestId(`stage-sky-${id}`);
const filterWords = (page: Page) => page.getByRole('navigation', { name: 'Show' }).getByRole('link');
const boxOf = async (locator: ReturnType<Page['locator']>) => {
	const box = await locator.boundingBox();
	if (!box) throw new Error('no box');
	return { x: Math.round(box.x), y: Math.round(box.y), width: Math.round(box.width), height: Math.round(box.height) };
};
/** A control comes to rest at a place. The page's gutter is a fraction of the window, so a place may round one pixel either way. */
const comesTo = (locator: ReturnType<Page['locator']>, x: number) => expect.poll(async () => Math.abs((await boxOf(locator)).x - x)).toBeLessThanOrEqual(1);
/** The sky scene, live and held, so nothing changes under a test. */
async function openSky(page: Page, query = '') {
	await page.goto(`/?flags=home${query}`);
	await expect(page.locator('.constellation.live')).toBeVisible();
	// The map is ready once Zoom in can act. On a phone that control is in the help, so its class is read and not its place.
	await expect(page.locator('[data-testid=stage-sky-zoomIn].can')).toHaveCount(1);
	await page.getByTestId('stage-pause').click();
	await expect(stage(page)).toHaveAttribute('data-scene', 'sky');
}
const pickStar = async (page: Page, slug: string) => {
	const at = await page.locator(`.stars a[data-slug="${slug}"]`).evaluate(node => {
		const box = node.getBoundingClientRect();
		return { x: box.left + box.width / 2, y: box.top + box.height / 2 };
	});
	await page.mouse.click(at.x, at.y);
};

test.describe('flag on: one row of controls', () => {
	test('the sky scene has one row: the filters, the sky\'s controls, the progress line, Pause and Next', async ({ page }) => {
		await openSky(page);
		// The sky draws no control of its own, and nothing greyed stands in for one.
		await expect(page.getByRole('toolbar', { name: 'Map controls' })).toHaveCount(0);
		await expect(page.locator('.constellation .controls')).toHaveCount(0);
		await expect(stage(page).locator('[aria-disabled]')).toHaveCount(0);
		await expect(skyControl(page, 'zoomOut')).toBeHidden();
		await expect(skyControl(page, 'reset')).toBeHidden();
		// One line, in this order from the page's left edge to its right one.
		const line = await boxOf(row(page));
		expect(line.height).toBe(44);
		const parts = [...(await filterWords(page).all()), skyControl(page, 'zoomIn'), skyControl(page, 'list'), skyControl(page, 'help'), row(page).locator('.progress'), page.getByTestId('stage-pause'), page.getByTestId('stage-next')];
		const boxes = await Promise.all(parts.map(part => boxOf(part)));
		for (const box of boxes) {
			expect(box.y).toBeGreaterThanOrEqual(line.y);
			expect(box.y + box.height).toBeLessThanOrEqual(line.y + line.height);
		}
		for (let i = 1; i < boxes.length; i += 1) expect(boxes[i].x).toBeGreaterThanOrEqual(boxes[i - 1].x + boxes[i - 1].width - 1);
		// It is the only line of controls: the row ends the stage, and every button of the stage outside it belongs to the map.
		const stageBox = await boxOf(stage(page));
		expect(line.y + line.height).toBe(stageBox.y + stageBox.height);
		expect(await stage(page).locator('button:visible').evaluateAll(nodes => nodes.filter(node => !node.closest('[data-testid=home-row], .legend, .names')).length)).toBe(0);
		// Each of the sky's controls says the name the sky gives it, as its label and as its tooltip.
		for (const id of ['zoomIn', 'list', 'help'] as const) {
			await expect(skyControl(page, id)).toHaveAttribute('aria-label', SKY_NAMES[id]);
			await expect(skyControl(page, id)).toHaveAttribute('data-tip', SKY_NAMES[id]);
		}
		await skyControl(page, 'zoomIn').hover();
		await expect.poll(() => skyControl(page, 'zoomIn').evaluate(node => getComputedStyle(node, '::after').opacity)).toBe('1');
		await noSidewaysScroll(page);
	});

	test('the legend lies along the top edge of the stage as one line, on the page\'s left edge', async ({ page }) => {
		await openSky(page);
		const legend = page.getByRole('toolbar', { name: 'Show one category' });
		const box = await boxOf(legend);
		const top = (await boxOf(stage(page))).y;
		expect(box.y - top).toBeLessThanOrEqual(24);
		expect(box.height).toBeLessThanOrEqual(36);
		// The stars start under it and run down to the row.
		const field = await boxOf(page.locator('.constellation .field'));
		expect(field.y).toBeGreaterThanOrEqual(box.y + box.height);
		expect((await boxOf(row(page))).y - (field.y + field.height)).toBeLessThanOrEqual(64);
		// Its first dot stands where the first filter word starts.
		const dot = await boxOf(legend.locator('.dot').first());
		const word = await filterWords(page).first().evaluate(node => {
			const range = document.createRange();
			range.selectNodeContents(node);
			return Math.round(range.getBoundingClientRect().left);
		});
		expect(Math.abs(dot.x - word)).toBeLessThanOrEqual(2);
		// It still filters: a press marks the category.
		await legend.getByRole('button', { name: /^Music/ }).click();
		await expect(legend.getByRole('button', { name: /^Music/ })).toHaveAttribute('aria-pressed', 'true');
	});

	test('Zoom out and Reset are in the row only while they can act, and nothing else moves', async ({ page }) => {
		await openSky(page);
		const fixed = [skyControl(page, 'zoomIn'), skyControl(page, 'list'), skyControl(page, 'help'), page.getByTestId('stage-pause'), page.getByTestId('stage-next'), filterWords(page).last()];
		const places = () => Promise.all(fixed.map(part => boxOf(part)));
		const atRest = await places();
		// A picked star: Reset alone, next to Zoom in.
		await pickStar(page, 'boutique-everything-when-the-hobby-grows-up');
		await expect(page.getByTestId('constellation-card')).toBeVisible();
		await expect(skyControl(page, 'reset')).toBeVisible();
		await expect(skyControl(page, 'zoomOut')).toBeHidden();
		await comesTo(skyControl(page, 'reset'), atRest[0].x - 44);
		expect(await places()).toEqual(atRest);
		// Zoomed in: Reset, Zoom out, Zoom in, from left to right.
		await skyControl(page, 'zoomIn').click();
		await expect(skyControl(page, 'zoomOut')).toBeVisible();
		await comesTo(skyControl(page, 'zoomOut'), atRest[0].x - 44);
		await comesTo(skyControl(page, 'reset'), atRest[0].x - 88);
		for (const id of ['reset', 'zoomOut'] as const) {
			await expect(skyControl(page, id)).toHaveAttribute('aria-label', SKY_NAMES[id]);
			await expect(skyControl(page, id)).toHaveAttribute('data-tip', SKY_NAMES[id]);
			expect((await boxOf(skyControl(page, id))).height).toBe(44);
		}
		expect(await places()).toEqual(atRest);
		await noSidewaysScroll(page);
		// Reset: the map is at rest, nothing is picked, and both are gone.
		await skyControl(page, 'reset').click();
		await expect(skyControl(page, 'reset')).toBeHidden();
		await expect(skyControl(page, 'zoomOut')).toBeHidden();
		await expect(page.getByTestId('constellation-card')).toHaveCount(0);
		expect(await places()).toEqual(atRest);
	});

	test('focus runs the way the eye does, and a control that leaves hands its focus on', async ({ page }) => {
		await openSky(page);
		// The stage's own row comes after its scenes: the legend, then the map, then the row.
		const order = await stage(page).evaluate(node => {
			const at = (selector: string) => Array.from(node.querySelectorAll('*')).indexOf(node.querySelector(selector)!);
			return [at('.legend'), at('[data-testid=constellation-map]'), at('[data-testid=home-row]')];
		});
		expect(order).toEqual([...order].sort((a, b) => a - b));
		const walk = async (count: number) => {
			const seen: Array<{ name: string; x: number }> = [];
			for (let i = 0; i < count; i += 1) {
				seen.push(await page.evaluate(() => ({ name: document.activeElement?.getAttribute('aria-label') ?? document.activeElement?.textContent?.trim() ?? '', x: Math.round(document.activeElement!.getBoundingClientRect().left) })));
				await page.keyboard.press('Tab');
			}
			return seen;
		};
		await filterWords(page).first().focus();
		const rest = await walk(10);
		expect(rest.map(entry => entry.name)).toEqual(['All', 'Writing', 'Photos', 'Recordings', 'Video', 'Zoom in', 'Show as a list', 'How it works', 'Play', 'Next']);
		for (let i = 1; i < rest.length; i += 1) expect(rest[i].x).toBeGreaterThan(rest[i - 1].x);
		// Zoomed in by keyboard: Reset and Zoom out come before Zoom in, as they stand.
		await skyControl(page, 'zoomIn').focus();
		await page.keyboard.press('Enter');
		await expect(skyControl(page, 'zoomOut')).toBeVisible();
		// Both have come to rest in their places.
		const zoomInAt = (await boxOf(skyControl(page, 'zoomIn'))).x;
		await comesTo(skyControl(page, 'reset'), zoomInAt - 88);
		await comesTo(skyControl(page, 'zoomOut'), zoomInAt - 44);
		await filterWords(page).last().focus();
		const zoomed = await walk(4);
		expect(zoomed.map(entry => entry.name)).toEqual(['Video', 'Reset', 'Zoom out', 'Zoom in']);
		for (let i = 1; i < zoomed.length; i += 1) expect(zoomed[i].x).toBeGreaterThan(zoomed[i - 1].x);
		// Zoom out, pressed until it can do no more, leaves the row. Focus goes to a control beside it.
		await skyControl(page, 'zoomOut').focus();
		await page.keyboard.press('Enter');
		await expect(skyControl(page, 'zoomOut')).toBeHidden();
		await expect(skyControl(page, 'zoomIn')).toBeFocused();
		// Reached by keyboard, a control draws a ring.
		await page.keyboard.press('Shift+Tab');
		await page.keyboard.press('Tab');
		expect(await skyControl(page, 'zoomIn').evaluate(node => getComputedStyle(node).outlineStyle)).toBe('solid');
	});

	test('the help opens from the row by keyboard, takes focus and gives it back', async ({ page }) => {
		await openSky(page);
		const help = page.locator('#constellation-help');
		const control = skyControl(page, 'help');
		await expect(control).toHaveAttribute('aria-controls', 'constellation-help');
		await expect(control).toHaveAttribute('aria-expanded', 'false');
		await control.focus();
		await page.keyboard.press('Enter');
		await expect(help).toBeVisible();
		await expect(control).toHaveAttribute('aria-expanded', 'true');
		await expect(help).toBeFocused();
		await expect(help).toContainText('Each star is a post.');
		// It opens just above the row, inside the stage.
		const box = await boxOf(help);
		expect(box.y + box.height).toBeLessThanOrEqual((await boxOf(row(page))).y);
		expect(box.y).toBeGreaterThanOrEqual((await boxOf(stage(page))).y);
		await page.keyboard.press('Escape');
		await expect(help).toBeHidden();
		await expect(control).toBeFocused();
		// A press opens it and a second press closes it. A press elsewhere closes it too.
		await control.click();
		await expect(help).toBeVisible();
		await control.click();
		await expect(help).toBeHidden();
		await control.click();
		await expect(help).toBeVisible();
		await page.getByTestId('constellation-map').click({ position: { x: 30, y: 200 } });
		await expect(help).toBeHidden();
	});

	test('the list opens from the row by keyboard, takes focus at its head and gives it back on Escape', async ({ page }) => {
		await openSky(page);
		const list = page.getByTestId('constellation-list');
		await skyControl(page, 'list').focus();
		await page.keyboard.press('Enter');
		await expect(list).toBeVisible();
		await expect(list).toBeFocused();
		// The same control now shows the map, and Zoom in cannot act on a list, so it is not there.
		await expect(skyControl(page, 'list')).toHaveAttribute('aria-label', 'Show the map');
		await expect(skyControl(page, 'list')).toHaveAttribute('data-tip', 'Show the map');
		await expect(skyControl(page, 'zoomIn')).toBeHidden();
		// The list lies between the legend and the row.
		const box = await boxOf(list);
		const legend = await boxOf(page.getByRole('toolbar', { name: 'Show one category' }));
		expect(box.y).toBeGreaterThanOrEqual(legend.y + legend.height);
		expect(box.y + box.height).toBeLessThanOrEqual((await boxOf(row(page))).y);
		await page.keyboard.press('Tab');
		await expect(list.getByRole('link').first()).toBeFocused();
		await page.keyboard.press('Escape');
		await expect(skyControl(page, 'list')).toBeFocused();
		await page.keyboard.press('Enter');
		await expect(page.getByTestId('constellation-map')).toBeVisible();
		await expect(skyControl(page, 'list')).toHaveAttribute('aria-label', 'Show as a list');
		await expect(skyControl(page, 'zoomIn')).toBeVisible();
	});

	test('in every other scene the row keeps the filters, the progress line, Pause and Next where they are', async ({ page }) => {
		await openSky(page);
		const kept = [filterWords(page).first(), filterWords(page).last(), row(page).locator('.progress'), page.getByTestId('stage-pause'), page.getByTestId('stage-next')];
		const places = () => Promise.all(kept.map(part => boxOf(part)));
		const onSky = await places();
		const count = await page.locator('.scenes > .scene').count();
		for (let i = 1; i < count; i += 1) {
			await page.getByTestId('stage-next').click();
			await expect(stage(page)).not.toHaveAttribute('data-scene', 'sky');
			for (const id of ['zoomIn', 'list', 'help'] as const) await expect(skyControl(page, id)).toBeHidden();
			await expect(page.getByTestId('stage-sky-controls')).toHaveAttribute('inert', '');
			expect(await places()).toEqual(onSky);
			expect((await boxOf(row(page))).height).toBe(44);
		}
		// Back on the sky they return.
		await page.getByTestId('stage-next').click();
		await expect(stage(page)).toHaveAttribute('data-scene', 'sky');
		await expect(skyControl(page, 'zoomIn')).toBeVisible();
	});

	test('a star reached by Tab draws an outline, on this page and on the constellation\'s own', async ({ page }) => {
		// The constellation's own page first: the home flag is remembered once it is given.
		for (const address of ['/?flags=constellation', '/?flags=home']) {
			await page.goto(address);
			await expect(page.locator('.constellation.live')).toBeVisible();
			await expect(row(page)).toHaveCount(address.endsWith('home') ? 1 : 0);
			const legend = page.getByRole('toolbar', { name: 'Show one category' });
			await legend.getByRole('button').first().focus();
			await page.keyboard.press('Tab');
			const link = page.locator('.stars a:focus');
			await expect(link).toHaveAttribute('aria-label', /^Succession, Warblers, and GIS\./);
			const ring = await link.evaluate(node => {
				const style = getComputedStyle(node);
				const box = node.getBoundingClientRect();
				return { style: style.outlineStyle, width: parseFloat(style.outlineWidth), radius: box.width / 2 + parseFloat(style.outlineOffset) + parseFloat(style.outlineWidth) };
			});
			expect(ring.style).toBe('solid');
			expect(ring.width).toBeCloseTo(3, 1);
			// The outline is a ring around the star, not a box around the whole map: its outer edge is 8 to 20 pixels from the star's centre.
			expect(ring.radius).toBeGreaterThan(8);
			expect(ring.radius).toBeLessThan(20);
		}
	});

	test('a sky that does not load says so, and names Latest and Archive only on the page that has them', async ({ page }) => {
		await page.route(/\/constellation\.v1\.[\w-]+\.json$/, route => route.abort());
		const notice = page.locator('.constellation .notice');
		// The constellation's own page first: the home flag is remembered once it is given.
		await page.goto('/?flags=constellation');
		await expect(notice).toHaveText('The map did not load. Latest and Archive below have every post.');
		await expect(row(page)).toHaveCount(0);
		await page.goto('/?flags=home');
		await expect(row(page)).toHaveCount(1);
		await expect(notice).toHaveText('The map did not load.');
		await expect(stage(page).getByText(/Latest|Archive/)).toHaveCount(0);
	});

	test('the constellation\'s own page keeps its five controls and its legend at the foot', async ({ page }) => {
		await page.goto('/?flags=constellation');
		await expect(page.locator('.constellation.live')).toBeVisible();
		const controls = page.getByRole('toolbar', { name: 'Map controls' }).getByRole('button');
		await expect(controls).toHaveCount(5);
		expect(await controls.evaluateAll(nodes => nodes.map(node => node.getAttribute('aria-label')))).toEqual(['Show as a list', 'Zoom in', 'Zoom out', 'Reset', 'How it works']);
		const field = await boxOf(page.locator('.constellation .field'));
		const legend = await boxOf(page.getByRole('toolbar', { name: 'Show one category' }));
		expect(legend.y).toBeGreaterThanOrEqual(field.y + field.height);
		expect((await boxOf(controls.first())).y).toBeGreaterThanOrEqual(field.y + field.height);
		for (const name of ['head', 'bare', 'plain', 'inset']) await expect(page.locator('.constellation')).not.toHaveClass(new RegExp(`\\b${name}\\b`));
		await expect(page.getByTestId('home-row')).toHaveCount(0);
	});
});

test.describe('flag on: one row of controls on a phone', () => {
	test.use({ viewport: { width: 390, height: 844 } });

	test('the row fits 390 pixels on one line, and every control in it is 44 pixels square or more', async ({ page }) => {
		await openSky(page);
		await noSidewaysScroll(page);
		const line = await boxOf(row(page));
		expect(line.height).toBe(44);
		const pick = page.getByTestId('stream-filter-pick');
		await expect(pick).toHaveText('All');
		const shown = [pick, skyControl(page, 'list'), skyControl(page, 'help'), page.getByTestId('stage-pause'), page.getByTestId('stage-next')];
		const check = async (parts: typeof shown) => {
			const boxes = await Promise.all(parts.map(part => boxOf(part)));
			for (const box of boxes) {
				expect(Math.min(box.width, box.height)).toBeGreaterThanOrEqual(44);
				expect(box.x).toBeGreaterThanOrEqual(0);
				expect(box.x + box.width).toBeLessThanOrEqual(390);
				expect(box.y).toBe(line.y);
			}
			// Two controls side by side may round to share one pixel.
			for (let i = 1; i < boxes.length; i += 1) expect(boxes[i].x).toBeGreaterThanOrEqual(boxes[i - 1].x + boxes[i - 1].width - 1);
			return boxes;
		};
		const atRest = await check(shown);
		// The zoom pair is not in the row here. Two fingers zoom, and the help holds the pair by name.
		await expect(skyControl(page, 'zoomIn')).toBeHidden();
		await expect(skyControl(page, 'zoomOut')).toBeHidden();
		await skyControl(page, 'help').click();
		const folded = page.getByTestId('stage-sky-folded');
		await expect(folded.getByRole('button', { name: 'Zoom in' })).toBeVisible();
		await expect(folded.getByRole('button', { name: 'Zoom out' })).toBeHidden();
		await folded.getByRole('button', { name: 'Zoom in' }).click();
		await expect(folded.getByRole('button', { name: 'Zoom out' })).toBeVisible();
		for (const name of ['Zoom in', 'Zoom out']) expect((await boxOf(folded.getByRole('button', { name }))).height).toBeGreaterThanOrEqual(44);
		await skyControl(page, 'help').click();
		await expect(page.locator('#constellation-help')).toBeHidden();
		// Zoomed in, Reset is in the row, to the left of the list, and nothing else has moved.
		await expect(skyControl(page, 'reset')).toBeVisible();
		await comesTo(skyControl(page, 'reset'), atRest[1].x - 44);
		expect((await check([pick, skyControl(page, 'reset'), ...shown.slice(1)])).slice(2)).toEqual(atRest.slice(1));
		await noSidewaysScroll(page);
		await skyControl(page, 'reset').click();
		await expect(skyControl(page, 'reset')).toBeHidden();
	});

	test('the filter shows as its one word, and a press lays the words out across the row', async ({ page }) => {
		await openSky(page);
		const pick = page.getByTestId('stream-filter-pick');
		await expect(pick).toHaveAttribute('aria-expanded', 'false');
		await expect(filterWords(page)).toHaveCount(0);
		await pick.click();
		await expect(filterWords(page)).toHaveText(['All', 'Writing', 'Photos', 'Recordings', 'Video']);
		const line = await boxOf(row(page));
		for (const word of await filterWords(page).all()) {
			const box = await boxOf(word);
			expect(Math.min(box.width, box.height)).toBeGreaterThanOrEqual(44);
			expect(box.x).toBeGreaterThanOrEqual(0);
			expect(box.x + box.width).toBeLessThanOrEqual(390);
			expect(box.y).toBe(line.y);
		}
		// The controls give the words the room, and the current word has the focus.
		await expect(page.getByTestId('stage-next')).toBeHidden();
		await expect(filterWords(page).first()).toBeFocused();
		await noSidewaysScroll(page);
		// Escape puts the one word back, with the focus on it.
		await page.keyboard.press('Escape');
		await expect(pick).toBeVisible();
		await expect(pick).toBeFocused();
		await expect(page.getByTestId('stage-next')).toBeVisible();
		// A chosen word filters the stream and becomes the one word.
		await pick.click();
		await filterWords(page).filter({ hasText: 'Recordings' }).click();
		await expect(page).toHaveURL(/show=recordings/);
		await expect(pick).toHaveText('Recordings');
		await expect(items(page)).toHaveCount(3);
		await expect(page.getByTestId('stage-next')).toBeVisible();
		await noSidewaysScroll(page);
	});

	test('the legend takes the top of the stage, and a picked post docks there', async ({ page }) => {
		await openSky(page);
		const legend = page.getByRole('toolbar', { name: 'Show one category' });
		const field = await boxOf(page.locator('.constellation .field'));
		const box = await boxOf(legend);
		expect(box.y - (await boxOf(stage(page))).y).toBeLessThanOrEqual(16);
		expect(box.y + box.height).toBeLessThanOrEqual(field.y);
		expect(box.x).toBeGreaterThanOrEqual(0);
		expect(box.x + box.width).toBeLessThanOrEqual(390);
		// Nothing lies between the stars and the row.
		expect((await boxOf(row(page))).y - (field.y + field.height)).toBeLessThanOrEqual(48);
		const before = await page.locator('.stars a[data-slug="mega-langdon"]').evaluate(node => Math.round(node.getBoundingClientRect().top));
		await pickStar(page, 'mega-langdon');
		const card = page.getByTestId('constellation-card');
		await expect(card).toBeVisible();
		const docked = await boxOf(card);
		expect(docked.y + docked.height).toBeLessThanOrEqual(field.y);
		await expect(legend).toBeHidden();
		// At rest the map does not move for the card.
		expect(await page.locator('.stars a[data-slug="mega-langdon"]').evaluate(node => Math.round(node.getBoundingClientRect().top))).toBe(before);
		await expect(skyControl(page, 'reset')).toBeVisible();
		await skyControl(page, 'reset').click();
		await expect(card).toHaveCount(0);
		await expect(legend).toBeVisible();
	});
});
