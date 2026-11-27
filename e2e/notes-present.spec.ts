import { readFileSync, readdirSync, realpathSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { gunzipSync } from 'node:zlib';
import { test, expect, type Page } from '@playwright/test';
import { attachmentHeaders, noteFromEntry, noteView, parseEntry, type Note } from '../src/lib/notes';

// TIN-8654: runs only in //:playwright_notes_e2e, which builds the site from
// the xoxd-projection/v3 valid blog fixture after the projection step
// verified it with the contract's fixture public key. The fixture holds one
// note (/notes/first-light), two articles (/blog/drawing-orbits and
// /blog/marsh-dawn) and one announcement (/announcements/office-hours).

const NOTE_URL = 'https://transscendsurvival.org/notes/first-light';
const NOTE_TEXT = 'The hub signed this note and the blog built it from the manifest.';
const PROJECTION_DATA = join(process.cwd(), 'src', 'lib', 'projection-data');

test('the navigation links to Notes and /notes shows the note whole, with no card around it', async ({ page }) => {
	await page.goto('/');
	await expect(page.locator('nav a[href="/notes"]').first()).toBeVisible();
	await page.goto('/notes');
	await expect(page.getByRole('heading', { level: 1, name: 'Notes' })).toBeVisible();
	await expect(page.getByText('1 note', { exact: true })).toBeVisible();
	const list = page.getByTestId('notes-list');
	await expect(list.locator('h2 a[href="/notes/first-light"]')).toHaveText('First light');
	await expect(list.locator('.note-body > p')).toHaveText(NOTE_TEXT);
	const item = list.getByTestId('notes-list-item');
	await expect(item).not.toHaveClass(/card|glass/);
	expect(await boxStyle(item)).toEqual(NO_BOX);
});

test('/notes/first-light renders the verified HTML inside the article chrome', async ({ page }) => {
	const response = await page.goto('/notes/first-light');
	expect(response?.status()).toBe(200);
	const article = page.getByTestId('note-article');
	await expect(article.getByRole('heading', { level: 1 })).toHaveText('First light');
	await expect(article.locator('[data-document-root] .note-body > p')).toHaveText(NOTE_TEXT);
	await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', NOTE_URL);
	await expect(article.locator('nav[aria-label="Breadcrumb"] a[href="/notes"]')).toBeVisible();
});

test('entries with a /blog path or another path are not built', async ({ request }) => {
	for (const path of [
		'/blog/drawing-orbits',
		'/blog/marsh-dawn',
		'/blog/marsh-dawn/ripple.mp4',
		'/notes/drawing-orbits',
		'/notes/marsh-dawn',
		'/announcements/office-hours',
	]) {
		expect((await request.get(path)).status(), path).toBe(404);
	}
	const feed = await (await request.get('/feed.json')).json();
	const ids = feed.items.map((item: { id: string }) => item.id);
	expect(ids).not.toContain('https://transscendsurvival.org/blog/drawing-orbits');
	expect(ids).not.toContain('https://transscendsurvival.org/blog/marsh-dawn');
});

test('the note joins the feeds and the sitemap under its canonical URL', async ({ request }) => {
	const feed = await (await request.get('/feed.json')).json();
	const items = feed.items.filter((item: { id: string }) => item.id === NOTE_URL);
	expect(items).toHaveLength(1);
	expect(items[0].content_html).toBe(`<p>${NOTE_TEXT}</p>`);
	expect(items[0].date_published).toBe('2026-11-20T00:00:00.000Z');
	const rss = await (await request.get('/feed.xml')).text();
	expect(rss).toContain(`<guid isPermaLink="true">${NOTE_URL}</guid>`);
	const sitemap = await (await request.get('/sitemap.xml')).text();
	expect(sitemap).toContain(`<loc>${NOTE_URL}</loc>`);
	expect(sitemap).toContain('<loc>https://transscendsurvival.org/notes</loc>');
});

test('/.well-known/projection.json serves the v3 receipt and webfinger is unchanged', async ({ request }) => {
	const receipt = await request.get('/.well-known/projection.json');
	expect(receipt.status()).toBe(200);
	expect(await receipt.json()).toEqual({
		contract: 'xoxd-projection/v3',
		target: 'blog',
		seq: 1,
		manifest: 'fcd2527570c858ebba8cec820b5349152507cce72c344e65a205c5c0fa97f80e',
	});
	const webfinger = await request.get('/.well-known/webfinger');
	expect((await webfinger.json()).subject).toBe('acct:jess@transscendsurvival.org');
});

test('the note has no attachment, so the build writes no headers file', async ({ request }) => {
	expect((await request.get('/_headers')).status()).toBe(404);
});

test('the built search index holds the note page by its words, and not the list', () => {
	// The page policy lets no WebAssembly run in this test browser, so the
	// test reads the index the build wrote, as the search reads it.
	const dir = join(process.cwd(), 'build', 'pagefind', 'fragment');
	const fragments = readdirSync(dir).map((name) => {
		const bytes = readFileSync(join(dir, name));
		const text = (bytes[0] === 0x1f && bytes[1] === 0x8b ? gunzipSync(bytes) : bytes).toString('utf8');
		return JSON.parse(text.slice(text.indexOf('{'))) as { url: string; content: string };
	});
	const notes = fragments.filter((fragment) => /^\/notes(\/|\.html|$)/.test(fragment.url));
	expect(notes.map((fragment) => fragment.url.replace(/(\.html|\/)$/, ''))).toEqual(['/notes/first-light']);
	expect(notes[0].content).toContain(NOTE_TEXT);
});

// ---------------------------------------------------------------------------
// The media blocks. The fixture's one note is a paragraph. Its recording, its
// photo set, its video by reference and its clip are in the article at
// /blog/marsh-dawn, which this site verifies and does not build. So these
// tests show that article's verified post file on the real note page: they
// answer the page data request of /notes/first-light with it, as the build
// would have written it for a note. The component, the page script and the
// styles are the ones the build shipped. Each file the page then asks for is
// answered with its verified bytes and the headers the site gives it.
// ---------------------------------------------------------------------------

const PHONE = { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 3 };
const NO_BOX = { border: '0px', shadow: 'none', background: 'rgba(0, 0, 0, 0)', radius: '0px' };

/** The box a rule could have added around an element. */
async function boxStyle(locator: ReturnType<Page['locator']>) {
	return locator.first().evaluate((element) => {
		const style = getComputedStyle(element);
		return {
			border: style.borderTopWidth,
			shadow: style.boxShadow,
			background: style.backgroundColor,
			radius: style.borderTopLeftRadius,
		};
	});
}

function fixturePost(id: string): Note {
	const file = join(PROJECTION_DATA, 'posts', `${id}.json`);
	return noteFromEntry(parseEntry(JSON.parse(readFileSync(file, 'utf8')), file));
}

/** SvelteKit's own data format, from the copy the kit depends on. */
async function loadDevalue(): Promise<{ unflatten(values: unknown[]): Record<string, unknown>; stringify(value: unknown): string }> {
	const fromRoot = createRequire(join(process.cwd(), 'package.json'));
	const kit = realpathSync(fromRoot.resolve('@sveltejs/kit/package.json'));
	return import(pathToFileURL(createRequire(kit).resolve('devalue')).href);
}

/**
 * Answers the page data of /notes/first-light and of /notes with the fixture
 * article, and its files with their verified bytes. Returns the video
 * hosts the page asked, in order.
 */
async function showFixtureArticle(page: Page): Promise<{ note: Note; playerHosts: string[] }> {
	const note = fixturePost('marsh-dawn');
	const devalue = await loadDevalue();
	const playerHosts: string[] = [];
	const swap = (change: (data: Record<string, unknown>) => void) => async (route: import('@playwright/test').Route) => {
		const response = await route.fetch();
		const body = (await response.json()) as { nodes: Array<{ type: string; data?: unknown[] } | null> };
		for (const node of body.nodes) {
			if (node?.type !== 'data' || !Array.isArray(node.data)) continue;
			const data = devalue.unflatten(node.data);
			if (!('note' in data) && !('notes' in data)) continue;
			change(data);
			node.data = JSON.parse(devalue.stringify(data));
		}
		await route.fulfill({ response, json: body });
	};
	await page.route('**/notes/first-light/__data.json*', swap((data) => (data.note = noteView(note))));
	await page.route('**/notes/__data.json*', swap((data) => (data.notes = [noteView(note)])));
	await page.route('**/blog/marsh-dawn/*', async (route) => {
		const path = new URL(route.request().url()).pathname;
		const attachment = note.attachments.find((candidate) => candidate.path === path);
		if (!attachment) return route.fulfill({ status: 404 });
		await route.fulfill({ status: 200, headers: attachmentHeaders(attachment), body: readFileSync(join(PROJECTION_DATA, attachment.file)) });
	});
	// The player frame is answered here, so the test never reaches the video host.
	const PLAYER_HOST = /(^|\.)(youtube(-nocookie)?\.com|ytimg\.com|googlevideo\.com)$/;
	await page.route(
		(url) => PLAYER_HOST.test(url.hostname),
		(route) => route.fulfill({ status: 200, contentType: 'text/html', body: '<!doctype html><title>player</title>' }),
	);
	page.on('request', (request) => {
		const { hostname } = new URL(request.url());
		if (PLAYER_HOST.test(hostname)) playerHosts.push(hostname);
	});
	return { note, playerHosts };
}

/**
 * The fixture clip is a 24 byte file that no browser can play. So the test
 * stands in for the video element's play and pause, counts the calls and
 * sends the events a playing video sends. It also holds back the error the
 * browser raises for the real file, since the stand-in plays in its place.
 * The page script under test is unchanged. A sound is left alone.
 */
async function standInForVideoPlayback(page: Page) {
	await page.addInitScript(() => {
		const playing = new WeakSet<HTMLVideoElement>();
		const calls = { plays: 0, pauses: 0 };
		Object.assign(window, { __clipCalls: calls });
		window.addEventListener(
			'error',
			(event) => {
				if (event.target instanceof HTMLSourceElement) event.stopImmediatePropagation();
			},
			true,
		);
		Object.defineProperty(HTMLVideoElement.prototype, 'paused', {
			configurable: true,
			get(this: HTMLVideoElement) {
				return !playing.has(this);
			},
		});
		HTMLVideoElement.prototype.play = function play(this: HTMLVideoElement) {
			calls.plays += 1;
			playing.add(this);
			this.dispatchEvent(new Event('play'));
			return Promise.resolve();
		};
		HTMLVideoElement.prototype.pause = function pause(this: HTMLVideoElement) {
			if (!playing.has(this)) return;
			calls.pauses += 1;
			playing.delete(this);
			this.dispatchEvent(new Event('pause'));
		};
	});
}

const clipCalls = (page: Page) => page.evaluate(() => (window as unknown as { __clipCalls: { plays: number; pauses: number } }).__clipCalls);

/** Opens the note page by a press on its link in the list, so the page reads its data from the data request. */
async function openArticleAsNote(page: Page) {
	await page.goto('/notes');
	await page.getByTestId('notes-list').locator('h2 a[href="/notes/first-light"]').click();
	await expect(page.getByTestId('note-article').getByRole('heading', { level: 1 })).toHaveText('Dawn at the marsh');
	return page.getByTestId('note-article').locator('.note-body');
}

test.describe('the media blocks on a phone', () => {
	test.use(PHONE);

	test('a figure, a photo set and a decorative cover show as plain images with their alt text', async ({ page }) => {
		await showFixtureArticle(page);
		const body = await openArticleAsNote(page);
		const figure = body.locator('figure#fig-reeds');
		await expect(figure.locator('img')).toHaveAttribute('alt', 'A single dot for the reeds');
		await expect(figure.locator('figcaption')).toHaveText('Figure 1. The reeds, drawn small.');
		await expect(body.locator('a.figure-ref')).toHaveAttribute('href', '#fig-reeds');
		const photos = body.locator('figure.embed-photos figure.embed-photo');
		await expect(photos).toHaveCount(2);
		await expect(photos.nth(0).locator('img')).toHaveAttribute('alt', 'A single dot for a heron');
		await expect(photos.nth(1).locator('figcaption')).toHaveText('The egret came second.');
		const cover = page.getByTestId('note-article').locator('.note-cover img');
		await expect(cover).toHaveAttribute('alt', '');
		await expect(page.getByTestId('note-article').locator('figure.note-cover')).toHaveCount(0);
		// Every image loaded from its verified bytes under the attachment headers.
		for (const image of await body.locator('img').all()) {
			await image.scrollIntoViewIfNeeded();
			await expect.poll(() => image.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0)).toBe(true);
		}
		for (const block of ['figure.embed-figure', 'figure.embed-photos', 'figure.embed-recording', 'figure.embed-youtube', 'figure.embed-clip']) {
			expect(await boxStyle(body.locator(block)), block).toEqual(NO_BOX);
		}
		// Nothing is wider than the phone.
		expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
	});

	test('a recording is an inline player with controls that asks for the sound and fits the phone', async ({ page }) => {
		// The fixture sound is one MP3 frame, which this browser's reader does
		// not open. So the test checks the player, its controls, its place on
		// the screen and the request for the file with its headers. It cannot
		// check that the sound plays.
		const sound = page.waitForResponse((response) => new URL(response.url()).pathname === '/blog/marsh-dawn/dawn.mp3');
		await showFixtureArticle(page);
		const body = await openArticleAsNote(page);
		const audio = body.locator('figure.embed-recording audio');
		await audio.scrollIntoViewIfNeeded();
		await expect(audio).toBeVisible();
		await expect(audio).toHaveAttribute('controls', '');
		await expect(audio).toHaveAttribute('title', 'Dawn chorus');
		await expect(body.locator('figure.embed-recording figcaption')).toHaveText('Dawn chorus');
		await expect(body.locator('figure.embed-recording .embed-description')).toHaveText('Invented birdsong over still water.');
		expect(await audio.evaluate((element: HTMLAudioElement) => new URL(element.currentSrc).pathname)).toBe('/blog/marsh-dawn/dawn.mp3');
		const response = await sound;
		expect(response.status()).toBe(200);
		expect(response.headers()).toMatchObject({
			'content-type': 'audio/mpeg',
			'x-content-type-options': 'nosniff',
			'content-security-policy': "default-src 'none'; sandbox",
		});
		const box = await audio.boundingBox();
		expect(box?.width).toBeGreaterThan(250);
		expect((box?.x ?? 0) + (box?.width ?? 0)).toBeLessThanOrEqual(390);
		expect(box?.height).toBeGreaterThanOrEqual(40);
	});

	test('a video by reference shows its poster and loads the no-cookie player only after a press', async ({ page }) => {
		const { playerHosts } = await showFixtureArticle(page);
		const body = await openArticleAsNote(page);
		const figure = body.locator('figure.embed-youtube');
		await figure.scrollIntoViewIfNeeded();
		await expect(figure.locator('a.embed-play img')).toHaveAttribute('alt', 'A single dot for the boardwalk');
		await expect(figure.locator('.embed-play-label')).toHaveText('Play video');
		await expect(figure.locator('iframe')).toHaveCount(0);
		await page.waitForLoadState('networkidle');
		expect(playerHosts, 'the video host is asked for nothing before the press').toEqual([]);

		await figure.locator('a.embed-play').tap();
		const frame = figure.locator('iframe.embed-player');
		await expect(frame).toHaveAttribute('src', 'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?autoplay=1');
		await expect(frame).toHaveAttribute('title', 'A walk along the boardwalk');
		await expect(figure.locator('a.embed-play')).toHaveCount(0);
		await expect(page).toHaveURL(/\/notes\/first-light$/);
		await expect.poll(() => [...new Set(playerHosts)]).toEqual(['www.youtube-nocookie.com']);
		const box = await frame.boundingBox();
		expect((box?.width ?? 0) / (box?.height ?? 1)).toBeCloseTo(16 / 9, 1);
	});

	test('a clip starts muted, looping and inline, and its button pauses and plays it', async ({ page }) => {
		await standInForVideoPlayback(page);
		await showFixtureArticle(page);
		const body = await openArticleAsNote(page);
		const video = body.locator('figure.embed-clip video');
		const button = body.locator('figure.embed-clip button.clip-toggle');
		await button.scrollIntoViewIfNeeded();
		expect(
			await video.evaluate((element: HTMLVideoElement) => ({
				muted: element.muted,
				loop: element.loop,
				inline: element.playsInline,
				controls: element.controls,
				autoplay: element.hasAttribute('autoplay'),
				label: element.getAttribute('aria-label'),
				poster: element.getAttribute('poster'),
			})),
		).toEqual({
			muted: true,
			loop: true,
			inline: true,
			controls: false,
			autoplay: false,
			label: 'Ripples spread across the water',
			poster: '/blog/marsh-dawn/walk.png',
		});
		// It started without a press, and the button says what a press does.
		await expect(button).toBeVisible();
		await expect(button).toHaveText('Pause the clip');
		expect(await clipCalls(page)).toEqual({ plays: 1, pauses: 0 });
		expect((await button.boundingBox())?.height).toBeGreaterThanOrEqual(44);

		await button.tap();
		await expect(button).toHaveText('Play the clip');
		expect(await clipCalls(page)).toEqual({ plays: 1, pauses: 1 });
		await button.tap();
		await expect(button).toHaveText('Pause the clip');
		expect(await clipCalls(page)).toEqual({ plays: 2, pauses: 1 });

		// A reader who switches reduced motion on while it plays: it stops.
		await page.emulateMedia({ reducedMotion: 'reduce' });
		await expect(button).toHaveText('Play the clip');
		expect(await clipCalls(page)).toEqual({ plays: 2, pauses: 2 });
		await expect(body.locator('figure.embed-clip figcaption')).toHaveText('A loop of the water.');
	});

	test('a reader who asks for reduced motion sees the poster and a play control, and nothing moves until a press', async ({ page }) => {
		await page.emulateMedia({ reducedMotion: 'reduce' });
		await standInForVideoPlayback(page);
		await showFixtureArticle(page);
		const body = await openArticleAsNote(page);
		const video = body.locator('figure.embed-clip video');
		const button = body.locator('figure.embed-clip button.clip-toggle');
		await button.scrollIntoViewIfNeeded();
		await expect(button).toBeVisible();
		await expect(button).toHaveText('Play the clip');
		await expect(video).toHaveAttribute('poster', '/blog/marsh-dawn/walk.png');
		expect(await video.evaluate((element: HTMLVideoElement) => element.paused)).toBe(true);
		expect(await clipCalls(page)).toEqual({ plays: 0, pauses: 0 });

		await button.tap();
		await expect(button).toHaveText('Pause the clip');
		expect(await clipCalls(page)).toEqual({ plays: 1, pauses: 0 });
	});

	test('the real clip file stands still on its poster when the browser cannot play it', async ({ page }) => {
		// No stand-in here. The browser refuses the 24 byte file, the page puts
		// the video back to rest, and the button then says Play. The test
		// counts the errors the browser raises for the file, so it knows when
		// each try has ended.
		await page.addInitScript(() => {
			const seen = { errors: 0 };
			Object.assign(window, { __sourceErrors: seen });
			window.addEventListener(
				'error',
				(event) => {
					if (event.target instanceof HTMLSourceElement) seen.errors += 1;
				},
				true,
			);
		});
		const sourceErrors = () => page.evaluate(() => (window as unknown as { __sourceErrors: { errors: number } }).__sourceErrors.errors);
		await showFixtureArticle(page);
		const body = await openArticleAsNote(page);
		const video = body.locator('figure.embed-clip video');
		const button = body.locator('figure.embed-clip button.clip-toggle');
		await button.scrollIntoViewIfNeeded();
		await expect(button).toBeVisible();
		await expect.poll(sourceErrors).toBe(1);
		await expect(button).toHaveText('Play the clip');
		expect(await video.evaluate((element: HTMLVideoElement) => element.paused)).toBe(true);
		// A press tries again, fails again, and the button says Play again.
		await button.tap();
		await expect.poll(sourceErrors).toBe(2);
		await expect(button).toHaveText('Play the clip');
		expect(await video.evaluate((element: HTMLVideoElement) => element.paused)).toBe(true);
	});

	test('the notes list shows the same blocks, and its clip has the same control', async ({ page }) => {
		await standInForVideoPlayback(page);
		await showFixtureArticle(page);
		await page.goto('/notes/first-light');
		await page.getByTestId('note-article').locator('nav[aria-label="Breadcrumb"] a[href="/notes"]').click();
		const list = page.getByTestId('notes-list');
		await expect(list.locator('h2')).toHaveText('Dawn at the marsh');
		const body = list.locator('.note-body');
		await expect(body.locator('figure.embed-recording audio')).toHaveAttribute('controls', '');
		await expect(body.locator('figure.embed-photos img')).toHaveCount(2);
		await expect(body.locator('figure.embed-youtube iframe')).toHaveCount(0);
		const button = body.locator('figure.embed-clip button.clip-toggle');
		await button.scrollIntoViewIfNeeded();
		await expect(button).toHaveText('Pause the clip');
		await button.tap();
		await expect(button).toHaveText('Play the clip');
		expect(await boxStyle(list.getByTestId('notes-list-item'))).toEqual(NO_BOX);
		expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
	});
});
