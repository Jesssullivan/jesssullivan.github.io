import { test, expect, type Page } from '@playwright/test';

// TIN-5680, TIN-8628: the constellation is a default-off experiment. Its layout is built ahead of time.
// The page paints a silhouette at once and fetches the interactive layer and one hashed data file later.
// The sky runs edge to edge of the viewport, with nothing printed above it.
const brokerUrls = [
	'https://hub.tinyland.dev/projections/jesssullivan-github-io/blog/broker-stream.v1.json',
	'https://hub.tinyland.dev/projections/jesssullivan-github-io/pulse/public-snapshot.v2.json',
];
// `published: false` in src/posts and listed in static/blog-publication-holds.json.
const HELD_SLUG = 'hello-world';
// Two published posts whose own summary is a web address, alone and before real words.
const ADDRESS_ONLY_SLUG = 'quick-fix-254-character-limit-in-esri-story-map';
const ADDRESS_FIRST_SLUG = 'new-business-site-up-and-running';
const DATA_FILE = /\/constellation\.v1\.[\w-]+\.json$/;
// How long the interactive map may take to appear after a page load (TIN-8867). The site's animated
// background has an SVG filter. Without a graphics card each frame of it is about half a second of
// main-thread work at 1920 by 1080. Under a two-CPU limit on sting the first star then came 3 to 4.7
// seconds after load, against 1 second at 390 wide. The gate runner is slower still.
const LIVE = { timeout: 15_000 };

test.beforeEach(async ({ context, baseURL }) => {
	if (!baseURL) throw new Error('explicit loopback base URL required');
	const local = new URL(baseURL);
	if (local.protocol !== 'http:' || !['localhost', '127.0.0.1', '[::1]'].includes(local.hostname)) throw new Error('loopback only');
	await context.route('**/*', async route => {
		const request = route.request();
		const url = new URL(request.url());
		if (url.origin === local.origin && !url.username && !url.password && ['GET', 'HEAD'].includes(request.method())) {
			const response = await route.fetch({ maxRedirects: 0 });
			if (response.status() >= 300 && response.status() < 400) await route.abort();
			else await route.fulfill({ response });
		} else if (brokerUrls.includes(url.href)) {
			await route.fulfill({ status: 503, contentType: 'application/json', body: '{}' });
		} else await route.abort();
	});
});

// Tests that end on a post page can close while its images are still routed.
test.afterEach(async ({ context }) => {
	await context.unrouteAll({ behavior: 'ignoreErrors' });
});

function recordDataRequests(page: Page): string[] {
	const requests: string[] = [];
	page.on('request', request => { if (/constellation|posts-projection/i.test(new URL(request.url()).pathname)) requests.push(request.url()); });
	return requests;
}

type Box = { x: number; y: number; width: number; height: number };
const map = (page: Page) => page.getByTestId('constellation-map');
const sky = (page: Page) => page.getByTestId('constellation-panel');
const stars = (page: Page) => map(page).locator('a[data-slug]');
const star = (page: Page, slug: string) => map(page).locator(`a[data-slug="${slug}"]`);
const names = (page: Page) => map(page).locator('.names button');
const card = (page: Page) => page.getByTestId('constellation-card');
const tip = (page: Page) => page.getByTestId('constellation-tip');
const openControl = (page: Page) => page.getByTestId('constellation-open');
const control = (page: Page, name: string) => page.getByRole('toolbar', { name: 'Map controls' }).getByRole('button', { name, exact: true });
const legend = (page: Page) => page.getByRole('toolbar', { name: 'Show one category' }).getByRole('button');
const activeSlug = (page: Page) => page.evaluate(() => (document.activeElement as Element | null)?.getAttribute('data-slug') ?? null);
const noHorizontalScroll = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth);
const inside = (box: Box, x: number, y: number, pad = 0) => x > box.x - pad && x < box.x + box.width + pad && y > box.y - pad && y < box.y + box.height + pad;
const boxOf = async (locator: ReturnType<typeof map>): Promise<Box> => {
	const box = await locator.boundingBox();
	if (!box) throw new Error('no box');
	return box;
};

/** Open the home page with the flag and wait for the interactive map. */
async function openMap(page: Page, query = '') {
	await page.goto(`/?flags=constellation${query}`);
	await expect(stars(page).first()).toBeAttached(LIVE);
	await map(page).scrollIntoViewIfNeeded();
	// The names appear once the sky has assembled.
	await expect(map(page)).toHaveClass(/assembled/);
	await expect(names(page).first()).toBeVisible();
}

// Each star has a link centred on it. Pointers never hit the link: the map picks the nearest star.
async function allCentres(page: Page): Promise<Array<{ slug: string; x: number; y: number }>> {
	return stars(page).evaluateAll(links => links.map(link => {
		const box = link.getBoundingClientRect();
		return { slug: link.getAttribute('data-slug') ?? '', x: box.x + box.width / 2, y: box.y + box.height / 2 };
	}));
}

/** The star with the most room around it, away from the edges of the sky, so a pointer on it is unambiguous. */
async function loneStar(page: Page): Promise<{ slug: string; x: number; y: number }> {
	const centres = await allCentres(page);
	const panel = await boxOf(map(page));
	const room = (a: { x: number; y: number }) => Math.min(...centres.filter(b => b !== a).map(b => Math.hypot(a.x - b.x, a.y - b.y)));
	const within = centres.filter(a => a.x > panel.x + 80 && a.x < panel.x + panel.width - 80 && a.y > panel.y + 80 && a.y < panel.y + panel.height - 120);
	if (within.length === 0) throw new Error('no star away from the edges');
	return within.sort((a, b) => room(b) - room(a))[0];
}

/** A point on the map itself with no star within a finger of it: a tap there picks nothing. */
async function emptySpot(page: Page): Promise<{ x: number; y: number }> {
	const centres = await allCentres(page);
	const panel = await boxOf(map(page));
	const points: Array<{ x: number; y: number }> = [];
	for (let y = panel.y + 80; y < panel.y + panel.height - 140; y += 24) {
		for (let x = panel.x + 40; x < panel.x + panel.width - 40; x += 24) {
			if (centres.every(centre => Math.hypot(centre.x - x, centre.y - y) > 48)) points.push({ x, y });
		}
	}
	const onMap = await page.evaluate(candidates => candidates.map(point => document.elementFromPoint(point.x, point.y)?.tagName === 'CANVAS'), points);
	const found = points.find((_, index) => onMap[index]);
	if (!found) throw new Error('no empty spot on the map');
	return found;
}

test('flag off: no section, no silhouette, no data request, even with a focus link', async ({ page }) => {
	const requests = recordDataRequests(page);
	await page.goto('/?focus=some-post');
	await expect(page.locator('#latest')).toBeVisible();
	await expect(page.locator('.constellation')).toHaveCount(0);
	await expect(sky(page)).toHaveCount(0);
	// No room is kept for a sky: the document is not marked and both columns are where the layout puts them.
	expect(await page.evaluate(() => [document.documentElement.hasAttribute('data-sky'), getComputedStyle(document.querySelector('#main-content') as Element).paddingTop, getComputedStyle(document.querySelector('#main-content + aside') as Element).paddingTop])).toEqual([false, '0px', '0px']);
	await page.waitForLoadState('networkidle');
	expect(requests).toEqual([]);
});

test('first paint is the silhouette, the sky keeps its size, and the data is one hashed file', async ({ page, context }) => {
	// Hold the data back so the state before the interactive layer can be seen.
	let release: () => void = () => {};
	const held = new Promise<void>(resolve => { release = resolve; });
	await context.route(DATA_FILE, async route => {
		await held;
		await route.fulfill({ response: await route.fetch() });
	});
	const requests = recordDataRequests(page);
	await page.goto('/?flags=constellation');
	await expect(sky(page)).toBeVisible();
	const wide = page.getByTestId('constellation-silhouette-wide');
	await expect(wide).toBeVisible();
	const before = { sky: await sky(page).boundingBox(), latest: await page.locator('#latest').boundingBox() };
	// Every star is already drawn, and nothing interactive exists yet.
	const dots = await wide.locator('path').evaluateAll(paths => paths.reduce((sum, path) => sum + (path.getAttribute('d')?.match(/M/g)?.length ?? 0), 0));
	expect(dots).toBeGreaterThan(100);
	await expect(page.locator('.constellation canvas')).toHaveCount(0);
	// The list is on offer before the map is live, and the zoom controls say they cannot act yet.
	await expect(control(page, 'Show as a list')).toBeEnabled();
	await expect(control(page, 'Zoom in')).toBeDisabled();

	release();
	await expect(stars(page)).toHaveCount(dots, LIVE);
	await expect(wide).toBeHidden();
	await expect(control(page, 'Zoom in')).toBeEnabled();
	// No layout shift: the sky and the section below it are where they were.
	expect(await sky(page).boundingBox()).toEqual(before.sky);
	expect(await page.locator('#latest').boundingBox()).toEqual(before.latest);
	// One data file, with a content hash in its name, under the immutable directory.
	expect(requests.filter(url => DATA_FILE.test(new URL(url).pathname))).toHaveLength(1);
	expect(requests.every(url => new URL(url).pathname.startsWith('/_app/immutable/'))).toBe(true);
	// The canvas draws each star where the silhouette had it.
	const centres = await allCentres(page);
	const field = await boxOf(page.locator('.constellation .field'));
	for (const centre of centres) expect(inside(field, centre.x, centre.y, 1), centre.slug).toBe(true);
});

// Her words on round three: the constellation is full bleed. The sky runs edge to edge of the viewport,
// takes most of its height, has no box of its own, and the stars use the whole width.
for (const viewport of [{ width: 1920, height: 1080 }, { width: 1440, height: 900 }, { width: 1024, height: 768 }, { width: 768, height: 1024 }, { width: 390, height: 844 }, { width: 320, height: 568 }]) {
	test(`full bleed at ${viewport.width} by ${viewport.height}: edge to edge, no box, no horizontal scroll`, async ({ page }) => {
		await page.setViewportSize(viewport);
		await openMap(page);
		const client = await page.evaluate(() => ({ width: document.documentElement.clientWidth, height: window.innerHeight }));
		const panel = await boxOf(sky(page));
		expect(panel.x).toBe(0);
		expect(panel.width).toBe(client.width);
		expect(await noHorizontalScroll(page)).toBe(true);
		const header = await page.locator('[data-scope="app-bar"][data-part="root"]').evaluate(bar => bar.getBoundingClientRect().height);
		if (viewport.width >= 768) {
			// A desktop or a tablet: 80 to 90 percent of the viewport's height.
			expect(panel.height / client.height).toBeGreaterThanOrEqual(0.8);
			expect(panel.height / client.height).toBeLessThanOrEqual(0.9);
		} else {
			// A phone: the visible height below the site header, or the least height the map needs.
			// The page's styles carry the header's height, so the room is right before any script runs. The header gains a one pixel edge once the page has scrolled past the banner.
			expect(Math.abs(panel.height - Math.max(448, client.height - header))).toBeLessThanOrEqual(1.5);
		}
		// Nothing is printed above the sky: it starts where the section starts, and the heading is for a screen reader only.
		const section = await boxOf(page.locator('.constellation'));
		expect(panel.y).toBeCloseTo(section.y, 0);
		const heading = page.getByRole('heading', { name: 'The constellation' });
		await expect(heading).toHaveCount(1);
		expect((await boxOf(heading)).width).toBeLessThanOrEqual(1);
		// No box: nothing in the section draws a border, an outline or a solid fill around the sky.
		const boxed = await page.locator('.constellation, .constellation .sky, .constellation .field, .constellation .stage, .constellation canvas').evaluateAll(nodes => nodes.filter(node => {
			const style = getComputedStyle(node);
			return style.borderTopWidth !== '0px' || style.borderLeftWidth !== '0px' || style.boxShadow !== 'none' || style.outlineStyle !== 'none' || !/rgba\(0, 0, 0, 0\)|transparent/.test(style.backgroundColor);
		}).map(node => node.className));
		expect(boxed).toEqual([]);
		// The stars use the whole width: the outermost ones are close to both edges of the viewport.
		const xs = (await allCentres(page)).map(centre => centre.x);
		expect(Math.min(...xs)).toBeLessThan(client.width * 0.08 + 8);
		expect(Math.max(...xs)).toBeGreaterThan(client.width * 0.92 - 8);
		// The profile column, where the layout shows one, starts below the sky and covers none of it.
		const aside = page.locator('#main-content + aside > div');
		if (await aside.isVisible()) expect((await boxOf(aside)).y).toBeGreaterThanOrEqual(panel.y + panel.height);
		// The legend and the controls lie over the sky, not above it, and cover no star.
		const centres = await allCentres(page);
		for (const overlay of [page.getByRole('toolbar', { name: 'Map controls' }), page.getByRole('toolbar', { name: 'Show one category' })]) {
			const box = await boxOf(overlay);
			expect(inside(panel, box.x + 1, box.y + 1) && inside(panel, box.x + box.width - 1, box.y + box.height - 1)).toBe(true);
			expect(centres.filter(centre => inside(box, centre.x, centre.y))).toEqual([]);
		}
	});
}

// The flag is read in the browser, so the section is not in the page as built (TIN-8628). The page keeps
// the sky's room from its first paint: a script in the document head marks the document, and the page's
// own styles pad both columns by the sky's height. The section then loads into that room. Nothing moves,
// in either motion mode, and with reduced motion nothing fades or slides either.
// The case reads every frame the page draws while the section arrives: from the frame it is put in until
// the sky is live, its fade has ended and half a second has passed. How many frames that is depends on the
// machine: with no graphics card the site's moving background alone holds a 1440 wide page to two to four
// frames a second, with or without the sky. What each frame shows is the page's.
for (const reducedMotion of ['no-preference', 'reduce'] as const) {
	for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
		test(`the page keeps the sky's room from its first paint and the section loads into it (motion: ${reducedMotion}, ${viewport.width} wide)`, async ({ page }) => {
			await page.setViewportSize(viewport);
			await page.emulateMedia({ reducedMotion });
			await page.addInitScript(() => {
				type Arrival = { shifts: Array<{ value: number; nodes: Node[] }>; built: { marked: boolean; section: boolean; room: number } | null; frames: Array<{ inside: number; outside: number; opacity: string }>; arrived: boolean };
				const state = window as unknown as { arrival: Arrival };
				state.arrival = { shifts: [], built: null, frames: [], arrived: false };
				new PerformanceObserver(list => {
					for (const entry of list.getEntries() as unknown as Array<{ value: number; hadRecentInput: boolean; sources?: Array<{ node: Node | null }> }>) {
						if (!entry.hadRecentInput) state.arrival.shifts.push({ value: entry.value, nodes: (entry.sources ?? []).map(source => source.node).filter((node): node is Node => node !== null) });
					}
				}).observe({ type: 'layout-shift', buffered: true });
				const room = () => {
					const main = document.querySelector('#main-content');
					const column = main?.querySelector(':scope > .container');
					return main && column ? column.getBoundingClientRect().top - main.getBoundingClientRect().top : -1;
				};
				// The page as built, before any module has run.
				document.addEventListener('DOMContentLoaded', () => {
					state.arrival.built = { marked: document.documentElement.hasAttribute('data-sky'), section: document.querySelector('.constellation') !== null, room: room() };
				});
				// From the frame the section is put in, in every frame: the animations inside the section, the animations on the page's two columns and on the blocks that fill them, and the section's opacity.
				// It ends on what a visitor sees, not on a count: the sky is live and the section's fade has ended. Half a second is the least it reads, which is 30 frames where a screen gives 60 a second.
				const seen = new MutationObserver(() => {
					const section = document.querySelector('.constellation');
					if (!section) return;
					seen.disconnect();
					const put = performance.now();
					const sample = () => {
						const targets = document.getAnimations().map(animation => (animation.effect as KeyframeEffect | null)?.target).filter((target): target is Element => target instanceof Element);
						const inside = targets.filter(target => section.contains(target)).length;
						const outside = targets.filter(target => target.matches('#main-content, #main-content > .container, #main-content + aside, #main-content + aside > div')).length;
						const opacity = getComputedStyle(section).opacity;
						state.arrival.frames.push({ inside, outside, opacity });
						if (section.classList.contains('live') && opacity === '1' && performance.now() - put >= 500) state.arrival.arrived = true;
						else requestAnimationFrame(sample);
					};
					sample();
				});
				seen.observe(document, { childList: true, subtree: true });
			});
			await page.goto('/?flags=constellation');
			await expect(stars(page).first()).toBeAttached(LIVE);
			await page.waitForLoadState('networkidle');
			await expect.poll(() => page.evaluate(() => (window as unknown as { arrival: { arrived: boolean } }).arrival.arrived)).toBe(true);
			const arrival = await page.evaluate(() => {
				const main = document.querySelector('#main-content') as Element;
				const aside = document.querySelector('#main-content + aside');
				const state = (window as unknown as { arrival: { shifts: Array<{ value: number; nodes: Node[] }>; built: { marked: boolean; section: boolean; room: number } | null; frames: Array<{ inside: number; outside: number; opacity: string }> } }).arrival;
				return {
					built: state.built,
					frames: state.frames,
					// Shifts of the main column, of the profile column, or of anything inside them. The banner above has its own and is not judged here.
					moved: state.shifts.filter(shift => shift.nodes.some(node => main.contains(node) || aside?.contains(node))).map(shift => ({ value: shift.value, nodes: shift.nodes.map(node => node.nodeName) })),
					room: (main.querySelector(':scope > .container') as Element).getBoundingClientRect().top - main.getBoundingClientRect().top,
				};
			});
			const panel = await boxOf(sky(page));
			// Before any module ran, the room was already there, at the height the sky then takes.
			expect(arrival.built?.marked).toBe(true);
			expect(arrival.built?.section).toBe(false);
			expect(arrival.built?.room).toBeCloseTo(panel.height, 1);
			expect(arrival.room).toBeCloseTo(panel.height, 1);
			expect(arrival.moved).toEqual([]);
			// The sky fills the room: it starts where the main column starts and the page's own column follows it.
			const main = await boxOf(page.locator('#main-content'));
			expect(panel.y).toBeCloseTo(main.y, 1);
			expect((await boxOf(page.locator('#latest'))).y).toBeGreaterThan(panel.y + panel.height);
			// The frame the section was put in was read, and at least one frame after it.
			expect(arrival.frames.length).toBeGreaterThan(1);
			// Nothing slides: no animation ever runs on the page's two columns or on the blocks that fill them.
			expect(arrival.frames.filter(frame => frame.outside > 0)).toEqual([]);
			// With reduced motion there is no entrance at all: the section is there at once, at full opacity, and nothing in it animates.
			if (reducedMotion === 'reduce') expect(arrival.frames.filter(frame => frame.inside > 0 || frame.opacity !== '1')).toEqual([]);
			const transforms = await page.locator('#main-content, #main-content > .container, #main-content + aside, #main-content + aside > div').evaluateAll(nodes => nodes.map(node => getComputedStyle(node).transform));
			expect(transforms.every(value => value === 'none')).toBe(true);
		});
	}
}

// The section is set in Inter at 600 and 700 and in the body face, which the default page already loads.
// A heading for a screen reader once asked for Inter at 400, a file the default page never fetches.
test('the section asks for no font file the default page does not already load', async ({ page }) => {
	const fonts = { off: new Set<string>(), on: new Set<string>() };
	let flag: 'off' | 'on' = 'off';
	page.on('request', request => { if (request.resourceType() === 'font') fonts[flag].add(new URL(request.url()).pathname); });
	// The site's once-a-day theme hint has type of its own and shows on its own clock: it is not part of either page here.
	await page.addInitScript(() => {
		const now = new Date();
		localStorage.setItem('theme-switcher-nudge-last-shown', `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`);
	});
	await page.goto('/');
	await expect(page.locator('#latest')).toBeVisible();
	await page.waitForLoadState('networkidle');
	await page.evaluate(() => document.fonts.ready.then(() => null));
	expect(fonts.off.size).toBeGreaterThan(0);
	flag = 'on';
	await openMap(page);
	// Everything the section can print: a tooltip, the card, the help and the list.
	const { x, y } = await loneStar(page);
	await page.mouse.move(x, y);
	await expect(tip(page)).toBeVisible();
	await page.mouse.click(x, y);
	await expect(card(page)).toBeVisible();
	await control(page, 'How it works').click();
	await expect(page.locator('#constellation-help')).toBeVisible();
	await control(page, 'Show as a list').click();
	await expect(page.getByTestId('constellation-list')).toBeVisible();
	await page.waitForLoadState('networkidle');
	await page.evaluate(() => document.fonts.ready.then(() => null));
	expect([...fonts.on].filter(font => !fonts.off.has(font))).toEqual([]);
});

/**
 * The lowest contrast any star has against the sky as it is drawn behind it: the page, its moving
 * background, and the sky's band and tints. The map's two canvases are hidden, the page is photographed,
 * and the pixel behind each star is read from the picture. The colour of a star is the colour the canvas
 * is given. A star's own halo and its constellation's glow are tints of that same colour and are left out.
 */
async function lowestStarContrast(page: Page): Promise<{ lowest: number; stars: number }> {
	// The silhouette draws every star once more under the canvas until the canvas has faded in over it: wait until it is gone.
	await expect(page.locator('.constellation')).toHaveClass(/live/);
	await expect(page.locator('.constellation .silhouette:visible')).toHaveCount(0);
	await page.evaluate(() => {
		const box = (document.querySelector('.constellation') as Element).getBoundingClientRect();
		window.scrollTo({ top: box.top + window.scrollY - (window.innerHeight - box.height), behavior: 'instant' });
	});
	const read = await page.evaluate(() => {
		const section = document.querySelector('.constellation') as HTMLElement;
		const probe = document.createElement('span');
		probe.style.cssText = 'position:absolute;width:0;height:0;visibility:hidden;transition:none!important';
		section.append(probe);
		const colours: string[] = [];
		for (let index = 0; index < 8; index += 1) {
			probe.style.color = `color-mix(in srgb, var(--star-${index}) 100%, transparent)`;
			colours.push(getComputedStyle(probe).color);
		}
		probe.remove();
		const labels = [...section.querySelectorAll('.legend button')].map(button => button.textContent?.trim() ?? '');
		const points = [...section.querySelectorAll('a[data-slug]')].map(link => {
			const box = link.getBoundingClientRect();
			return { x: box.x + box.width / 2, y: box.y + box.height / 2, category: labels.findIndex(label => link.getAttribute('aria-label')?.endsWith(`, ${label}`)) };
		});
		for (const canvas of section.querySelectorAll<HTMLElement>('.stage canvas')) canvas.style.visibility = 'hidden';
		return { colours, points };
	});
	const picture = (await page.screenshot()).toString('base64');
	return page.evaluate(async ({ picture, read }) => {
		const image = new Image();
		image.src = `data:image/png;base64,${picture}`;
		await image.decode();
		const canvas = document.createElement('canvas');
		canvas.width = image.naturalWidth;
		canvas.height = image.naturalHeight;
		const context = canvas.getContext('2d');
		if (!context) throw new Error('no canvas');
		context.drawImage(image, 0, 0);
		const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
		const ratio = canvas.width / window.innerWidth;
		const channel = (value: number) => (value / 255 <= 0.04045 ? value / 255 / 12.92 : ((value / 255 + 0.055) / 1.055) ** 2.4);
		const luminance = (r: number, g: number, b: number) => 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
		const colours = read.colours.map(value => {
			const parts = (value.match(/-?\d*\.?\d+(?:e[-+]?\d+)?/gi) ?? []).map(Number);
			const scale = value.startsWith('color(') ? 255 : 1;
			return luminance(parts[0] * scale, parts[1] * scale, parts[2] * scale);
		});
		let lowest = Infinity;
		let stars = 0;
		for (const point of read.points) {
			if (point.category < 0 || point.y < 0 || point.y >= window.innerHeight) continue;
			const at = (Math.round(point.y * ratio) * canvas.width + Math.round(point.x * ratio)) * 4;
			const behind = luminance(pixels[at], pixels[at + 1], pixels[at + 2]);
			const star = colours[point.category];
			lowest = Math.min(lowest, (Math.max(behind, star) + 0.05) / (Math.min(behind, star) + 0.05));
			stars += 1;
		}
		for (const drawn of document.querySelectorAll<HTMLElement>('.constellation .stage canvas')) drawn.style.visibility = '';
		return { lowest, stars };
	}, { picture, read });
}

// A star is a graphic: it needs 3 to 1 against what is behind it, as drawn. The figure in the design
// note was once taken against the theme's paper colour, and the drawn sky is darker than that in a light theme.
for (const theme of ['pine', 'catppuccin', 'rose', 'pride', 'trans']) {
	test(`every star has at least 3 to 1 against the sky as drawn (${theme}, light and dark, desktop and phone)`, async ({ page }) => {
		test.setTimeout(120_000);
		await page.goto('/');
		for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
			await page.setViewportSize(viewport);
			for (const mode of ['light', 'dark']) {
				await page.evaluate(([theme, mode]) => {
					localStorage.setItem('skeleton-theme', theme);
					localStorage.setItem('color-mode', mode);
					// The site's once-a-day theme hint is not part of the sky.
					const now = new Date();
					localStorage.setItem('theme-switcher-nudge-last-shown', `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`);
				}, [theme, mode]);
				await openMap(page);
				await expect(page.locator('html')).toHaveAttribute('data-mode', mode);
				await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
				const { lowest, stars: counted } = await lowestStarContrast(page);
				expect(counted, `${theme} ${mode} ${viewport.width}`).toBeGreaterThan(100);
				expect(lowest, `${theme} ${mode} ${viewport.width}`).toBeGreaterThanOrEqual(3);
			}
		}
	});
}

test('when the data does not load the silhouette stays and the reader is told where to read', async ({ page, context }) => {
	await context.route(DATA_FILE, route => route.abort());
	await page.goto('/?flags=constellation');
	await expect(page.getByTestId('constellation-silhouette-wide')).toBeVisible();
	await expect(sky(page)).toContainText('The map did not load.');
	await expect(page.locator('#latest')).toBeVisible();
});

test('every routeable placed post is a keyboard-reachable star and a list item', async ({ page }) => {
	await openMap(page);

	// The ordinary reader archive lists every routeable post.
	const routeable = new Set(await page.locator('#archive a[href^="/blog/"]').evaluateAll(links => links.map(link => (link as HTMLAnchorElement).pathname.replace(/^\/blog\//, '').replace(/\/$/, ''))));
	expect(routeable.has(HELD_SLUG)).toBe(false);
	const slugs = await stars(page).evaluateAll(links => links.map(link => link.getAttribute('data-slug') ?? ''));
	expect(slugs.length).toBeGreaterThan(100);
	expect(new Set(slugs).size).toBe(slugs.length);
	for (const slug of slugs) expect(routeable.has(slug), slug).toBe(true);
	expect(slugs).not.toContain(HELD_SLUG);

	// The map has a name and a role, and the how-to and the method note are in the help.
	await expect(page.getByRole('group', { name: 'Map of posts' })).toBeVisible();
	await control(page, 'How it works').click();
	await expect(page.locator('#constellation-help')).toContainText('Each star is a post.');
	await expect(page.locator('#constellation-help')).toContainText('not measurements');
	await page.keyboard.press('Escape');
	await expect(page.locator('#constellation-help')).toBeHidden();

	// One roving tab stop. Arrows walk the map, and a tooltip beside the star names it.
	await expect(map(page).locator('a[data-slug][tabindex="0"]')).toHaveCount(1);
	await map(page).locator('a[data-slug][tabindex="0"]').focus();
	await page.keyboard.press('ArrowRight');
	const visited = new Set([await activeSlug(page)]);
	for (const key of ['ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowDown', 'ArrowRight']) {
		await page.keyboard.press(key);
		const current = await activeSlug(page);
		expect(current).not.toBeNull();
		visited.add(current);
	}
	expect(visited.size).toBeGreaterThan(1);
	const current = await activeSlug(page) as string;
	await expect(map(page).locator('a[data-slug][tabindex="0"]')).toHaveAttribute('data-slug', current);
	// The tooltip is a real one, and the star's accessible name carries the same words: the title, the date, the category.
	await expect(tip(page)).toHaveRole('tooltip');
	const title = (await tip(page).locator('strong').textContent()) ?? '';
	const meta = (await tip(page).locator('span').textContent()) ?? '';
	expect(title.length).toBeGreaterThan(0);
	expect(meta).toMatch(/^[A-Z][a-z]{2} \d{1,2}, \d{4} · [A-Za-z]+$/);
	await expect(star(page, current)).toHaveAttribute('aria-label', `${title}. ${meta.replace(' · ', ', ')}`);
	// Focus alone pins nothing.
	await expect(card(page)).toHaveCount(0);
	await expect(star(page, current)).not.toHaveAttribute('aria-current', 'true');
	// Space pins the star: the small card names the post and offers Open and the nearest posts as next steps.
	await page.keyboard.press('Space');
	await expect(star(page, current)).toHaveAttribute('aria-current', 'true');
	await expect(openControl(page)).toHaveAttribute('href', `/blog/${current}`);
	await expect(card(page).locator('h3')).toHaveText(title);
	await expect(card(page).locator('time')).toHaveAttribute('datetime', /^\d{4}-\d{2}-\d{2}/);
	await expect(card(page).getByRole('list', { name: 'Nearby posts' }).getByRole('button').first()).toBeVisible();
	await expect(tip(page)).toHaveCount(0);
	// Escape clears the pin.
	await page.keyboard.press('Escape');
	await expect(card(page)).toHaveCount(0);
	await page.keyboard.press('ArrowRight');
	const next = await activeSlug(page) as string;
	await page.keyboard.press('Enter');
	await expect(page).toHaveURL(new RegExp(`/blog/${next}/?$`));
});

// Its own test, so each test loads the page at most twice. With the map test above it made three
// page loads, more than the 30 second budget holds on the two-CPU gate runner (TIN-8867).
test('the list is the first tab stop of the section, and holds the same posts as the map', async ({ page }) => {
	await page.goto('/?flags=constellation');
	await expect(stars(page).first()).toBeAttached(LIVE);
	const slugs = await stars(page).evaluateAll(links => links.map(link => link.getAttribute('data-slug') ?? ''));
	expect(slugs.length).toBeGreaterThan(100);
	expect(await page.locator('.constellation').evaluate(section => section.querySelector('button, a[href], [tabindex="0"]')?.getAttribute('data-testid'))).toBe('constellation-view');
	await control(page, 'Show as a list').focus();
	// Arrow keys move inside the controls, which are one tab stop.
	await page.keyboard.press('ArrowRight');
	await expect(control(page, 'Zoom in')).toBeFocused();
	await page.keyboard.press('ArrowLeft');
	await page.keyboard.press('Enter');
	await expect(control(page, 'Show the map')).toBeFocused();
	await expect(page.getByTestId('constellation-list').locator('> li')).toHaveCount(slugs.length);
	await expect(page.getByTestId('constellation-list').locator('> li > a').first()).toHaveAttribute('href', /^\/blog\//);
	await page.keyboard.press('Enter');
	await expect(stars(page).first()).toBeAttached();
});

test('?focus=<slug> opens the map on that post', async ({ page }) => {
	await openMap(page);
	const target = await stars(page).nth(7).getAttribute('data-slug');
	expect(target).toBeTruthy();
	await page.goto(`/?flags=constellation&focus=${target}`);
	await expect(control(page, 'Show as a list')).toBeVisible();
	await expect.poll(() => activeSlug(page)).toBe(target);
	await expect(openControl(page)).toHaveAttribute('href', `/blog/${target}`);
});

test('mouse: hover shows a tooltip beside the star, a click pins a small card, a second click opens the post', async ({ page }) => {
	await openMap(page);
	const { slug, x, y } = await loneStar(page);
	await page.mouse.move(x, y);
	// The tooltip is there at once, beside the star and never on it.
	await expect(tip(page)).toBeVisible();
	await expect(tip(page)).toHaveRole('tooltip');
	const label = (await star(page, slug).getAttribute('aria-label')) ?? '';
	expect(label.startsWith(`${await tip(page).locator('strong').textContent()}. `)).toBe(true);
	const beside = await boxOf(tip(page));
	expect(inside(beside, x, y, 4)).toBe(false);
	// Right beside it: to one side, above or below, with a small gap and no more.
	expect(Math.hypot(Math.max(beside.x - x, 0, x - beside.x - beside.width), Math.max(beside.y - y, 0, y - beside.y - beside.height))).toBeLessThan(40);
	expect(await tip(page).evaluate(node => getComputedStyle(node).transitionDuration + getComputedStyle(node).animationName)).toBe('0snone');
	await expect(openControl(page)).toHaveCount(0);
	await expect(card(page)).toHaveCount(0);

	await page.mouse.click(x, y);
	await expect(star(page, slug)).toHaveAttribute('aria-current', 'true');
	await expect(openControl(page)).toHaveAttribute('href', `/blog/${slug}`);
	await expect(tip(page)).toHaveCount(0);
	await expect(page).not.toHaveURL(/\/blog\//);
	// The card is small, and it covers neither the star nor the nearest posts it names.
	const pinned = await boxOf(card(page));
	const panel = await boxOf(sky(page));
	expect((pinned.width * pinned.height) / (panel.width * panel.height)).toBeLessThan(0.08);
	expect(inside(pinned, x, y, 6)).toBe(false);
	const centres = await allCentres(page);
	const nearTitles = await card(page).getByRole('list', { name: 'Nearby posts' }).getByRole('button').allTextContents();
	expect(nearTitles.length).toBeGreaterThan(0);
	expect(nearTitles.length).toBeLessThanOrEqual(3);
	const labels = await stars(page).evaluateAll(links => links.map(link => ({ slug: link.getAttribute('data-slug') ?? '', label: link.getAttribute('aria-label') ?? '' })));
	for (const title of nearTitles) {
		const near = labels.find(entry => entry.label.startsWith(`${title.trim()}. `));
		const centre = centres.find(entry => entry.slug === near?.slug);
		if (!centre) throw new Error(`no star for ${title}`);
		expect(inside(pinned, centre.x, centre.y), title).toBe(false);
	}
	// No caption explains the card: the nearby posts have a name for a screen reader only.
	await expect(card(page)).not.toContainText(/nearby/i);

	await page.mouse.click(x, y);
	await expect(page).toHaveURL(new RegExp(`/blog/${slug}/?$`));

	// Back returns to the same star, with its card open.
	await page.goBack();
	await expect(star(page, slug)).toHaveAttribute('aria-current', 'true');
	await expect(openControl(page)).toHaveAttribute('href', `/blog/${slug}`);
});

test('a card never shows a summary that is only a web address', async ({ page }) => {
	await openMap(page, `&focus=${ADDRESS_ONLY_SLUG}`);
	await expect(openControl(page)).toHaveAttribute('href', `/blog/${ADDRESS_ONLY_SLUG}`);
	await expect(card(page).locator('.summary')).toHaveCount(0);
	await expect(card(page)).not.toContainText(/https?:|www\./);
	// An address before real words is cut out, and the words stay.
	await openMap(page, `&focus=${ADDRESS_FIRST_SLUG}`);
	await expect(openControl(page)).toHaveAttribute('href', `/blog/${ADDRESS_FIRST_SLUG}`);
	await expect(card(page).locator('.summary')).toContainText('Check out my new');
	await expect(card(page)).not.toContainText(/https?:|www\./);
});

test('a nearby post in the card is the next step', async ({ page }) => {
	await openMap(page);
	const { x, y } = await loneStar(page);
	await page.mouse.click(x, y);
	const step = card(page).getByRole('list', { name: 'Nearby posts' }).getByRole('button').first();
	const title = (await step.textContent())?.trim() ?? '';
	await step.click();
	await expect(card(page).locator('h3')).toHaveText(title);
});

test('one naming system: every name on the sky is a category in the legend, and says how many posts it holds', async ({ page }) => {
	await openMap(page);
	const words = (await legend(page).allTextContents()).map(text => text.trim());
	const onSky = (await names(page).allTextContents()).map(text => text.trim());
	expect(onSky.length).toBeGreaterThan(3);
	expect(new Set(onSky).size).toBe(onSky.length);
	for (const name of onSky) expect(words).toContain(name);
	// A name says its count on hover and on focus, and carries the same words for a screen reader.
	const first = names(page).first();
	const told = await first.getAttribute('data-tip');
	// A constellation that holds only some of its category's posts says so: the legend counts them all.
	expect(told).toMatch(/^(\d+ of )?\d+ posts?$/);
	await expect(first).toHaveAttribute('aria-label', `${onSky[0]}, ${told}`);
	const inLegend = await page.getByRole('toolbar', { name: 'Show one category' }).getByRole('button', { name: new RegExp(`^${onSky[0]}, `) }).getAttribute('data-tip');
	expect(told?.endsWith(inLegend ?? 'none')).toBe(true);
	await first.hover();
	expect(await first.evaluate(node => getComputedStyle(node, '::after').display + getComputedStyle(node, '::after').content)).toBe(`block"${told}"`);
	// Every icon control has a tooltip with its name.
	for (const name of ['Show as a list', 'Zoom in', 'Zoom out', 'Reset', 'How it works']) {
		await control(page, name).hover();
		expect(await control(page, name).evaluate(node => getComputedStyle(node, '::after').display + getComputedStyle(node, '::after').content), name).toBe(`block"${name}"`);
	}
	// The legend prints a dot and one word. The count is in its name, not on the page.
	for (const text of words) expect(text).toMatch(/^[A-Za-z]+$/);
	await expect(legend(page).first()).toHaveAttribute('aria-label', /^[A-Za-z]+, \d+ posts?$/);
	// Its tooltip says the count, as a name on the sky does.
	const counted = await legend(page).first().getAttribute('data-tip');
	expect(counted).toMatch(/^\d+ posts?$/);
	await legend(page).first().hover();
	expect(await legend(page).first().evaluate(node => getComputedStyle(node, '::after').display + getComputedStyle(node, '::after').content)).toBe(`block"${counted}"`);
});

test('a constellation name flies to it, Reset returns, and a plain wheel scrolls the page', async ({ page }) => {
	await openMap(page);
	const reset = control(page, 'Reset');
	await expect(reset).toBeDisabled();

	// A plain wheel over the map scrolls the page and does not zoom.
	const box = await boxOf(map(page));
	await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
	const scrollBefore = await page.evaluate(() => window.scrollY);
	await page.mouse.wheel(0, 240);
	await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(scrollBefore);
	await expect(reset).toBeDisabled();
	await map(page).scrollIntoViewIfNeeded();

	const before = await allCentres(page);
	await names(page).first().click();
	await expect(reset).toBeEnabled();
	// Zoomed in: stars are farther apart than before.
	await expect.poll(async () => {
		const after = await allCentres(page);
		return Math.hypot(after[0].x - after[1].x, after[0].y - after[1].y) / Math.hypot(before[0].x - before[1].x, before[0].y - before[1].y);
	}).toBeGreaterThan(1.3);
	// Every name that shows is whole: none is cut by the edge of the sky.
	const cut = await names(page).evaluateAll(buttons => {
		const panel = (buttons[0].closest('[data-testid="constellation-map"]') as Element).getBoundingClientRect();
		return buttons.filter(name => getComputedStyle(name).visibility !== 'hidden').filter(name => {
			const box = name.getBoundingClientRect();
			return box.left < panel.left || box.right > panel.right;
		}).length;
	});
	expect(cut).toBe(0);
	await reset.click();
	await expect(reset).toBeDisabled();
	await expect.poll(async () => (await allCentres(page))[0].x).toBeCloseTo(before[0].x, 0);

	// The zoom buttons zoom, and Ctrl and wheel zooms.
	await control(page, 'Zoom in').click();
	await expect(reset).toBeEnabled();
	await expect(control(page, 'Zoom out')).toBeEnabled();
	await reset.click();
	await expect(reset).toBeDisabled();
	const here = await boxOf(map(page));
	await page.mouse.move(here.x + here.width / 2, here.y + here.height / 2);
	await page.keyboard.down('Control');
	await page.mouse.wheel(0, -200);
	await page.keyboard.up('Control');
	await expect(reset).toBeEnabled();
});

test('the legend filters the map and the list to one category', async ({ page }) => {
	await openMap(page);
	const chip = legend(page).first();
	const count = Number(((await chip.getAttribute('aria-label')) ?? '').match(/, (\d+) posts?$/)?.[1]);
	expect(count).toBeGreaterThan(0);
	// No text in the legend is dimmed, with or without a filter: state shows as an underline and a hollow dot.
	const dimmed = () => legend(page).evaluateAll(nodes => nodes.filter(node => getComputedStyle(node).opacity !== '1').length);
	expect(await dimmed()).toBe(0);
	await chip.click();
	await expect(chip).toHaveAttribute('aria-pressed', 'true');
	expect(await dimmed()).toBe(0);
	const other = page.locator('.constellation .legend button[aria-pressed="false"] .dot').first();
	expect(await other.evaluate(node => getComputedStyle(node).backgroundImage + getComputedStyle(node).backgroundColor)).toMatch(/rgba\(0, 0, 0, 0\)|transparent/);
	await control(page, 'Show as a list').click();
	await expect(page.getByTestId('constellation-list').locator('> li')).toHaveCount(count);
	await chip.click();
	await expect(chip).toHaveAttribute('aria-pressed', 'false');
	await expect(page.getByTestId('constellation-list').locator('> li')).not.toHaveCount(count);
});

test.describe('phone, touch', () => {
	test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

	test('fits 390px in both views without horizontal scroll, on the tall frame', async ({ page }) => {
		await openMap(page);
		expect(await noHorizontalScroll(page)).toBe(true);
		const box = await boxOf(map(page));
		expect(box.height).toBeGreaterThan(box.width);
		await control(page, 'Show as a list').tap();
		await expect(page.getByTestId('constellation-list')).toBeVisible();
		expect(await noHorizontalScroll(page)).toBe(true);
		await control(page, 'Show the map').tap();
		await expect(stars(page).first()).toBeAttached();
		expect(await noHorizontalScroll(page)).toBe(true);
		// Every control and every legend entry is a target of at least 24 pixels.
		for (const target of [...(await page.getByRole('toolbar', { name: 'Map controls' }).getByRole('button').all()), ...(await legend(page).all())]) {
			const size = await boxOf(target);
			expect(Math.min(size.width, size.height)).toBeGreaterThanOrEqual(24);
		}
	});

	test('first tap selects the nearest star in a dense cluster, a second tap opens it', async ({ page }) => {
		await openMap(page);
		const centres = await allCentres(page);
		const panel = await boxOf(map(page));
		let best = { near: centres[0], far: centres[1], distance: Infinity };
		for (let i = 0; i < centres.length; i += 1) {
			for (let j = i + 1; j < centres.length; j += 1) {
				const distance = Math.hypot(centres[i].x - centres[j].x, centres[i].y - centres[j].y);
				// Closer than a finger, far enough apart that sub-pixel layout cannot swap them, and high enough that the docked card does not move the map.
				if (distance >= 6 && distance < best.distance && Math.max(centres[i].y, centres[j].y) < panel.y + panel.height * 0.6) best = { near: centres[i], far: centres[j], distance };
			}
		}
		// A tap between two stars, nearer the first one, picks the first one.
		expect(best.distance).toBeLessThan(44);
		const tap = { x: best.near.x + (best.far.x - best.near.x) * 0.3, y: best.near.y + (best.far.y - best.near.y) * 0.3 };
		await page.touchscreen.tap(tap.x, tap.y);
		await expect(star(page, best.near.slug)).toHaveAttribute('aria-current', 'true');
		await expect(star(page, best.far.slug)).not.toHaveAttribute('aria-current', 'true');
		await expect(openControl(page)).toHaveAttribute('href', `/blog/${best.near.slug}`);
		// A touch has no hover: the first tap shows the card, never a tooltip.
		await expect(tip(page)).toHaveCount(0);
		await expect(page).not.toHaveURL(/\/blog\//);
		await page.touchscreen.tap(tap.x, tap.y);
		await expect(page).toHaveURL(new RegExp(`/blog/${best.near.slug}/?$`));
	});

	test('a star with room beside it has a touch target of at least 44 pixels, and Open opens the post', async ({ page }) => {
		await openMap(page);
		const centres = await allCentres(page);
		const box = await boxOf(map(page));
		// A point 22 pixels from a star, on a side where no other star is nearer.
		const tries = centres.flatMap(c => [0, 1, 2, 3, 4, 5, 6, 7].map(step => ({ slug: c.slug, x: c.x + Math.cos(step * Math.PI / 4) * 22, y: c.y + Math.sin(step * Math.PI / 4) * 22 })));
		const open = tries.filter(p => p.x > box.x + 12 && p.x < box.x + box.width - 12 && p.y > box.y + 70 && p.y < box.y + box.height * 0.6 && centres.every(c => c.slug === p.slug || Math.hypot(c.x - p.x, c.y - p.y) > 26));
		// A constellation name is a control of its own, so the point must be on the map itself.
		const onMap = await page.evaluate(points => points.map(p => document.elementFromPoint(p.x, p.y)?.tagName === 'CANVAS'), open);
		const found = open.find((_, index) => onMap[index]);
		if (!found) throw new Error('no star with room beside it');
		const { slug } = found;
		await page.touchscreen.tap(found.x, found.y);
		await expect(star(page, slug)).toHaveAttribute('aria-current', 'true');
		const target = await boxOf(openControl(page));
		expect(target.height).toBeGreaterThanOrEqual(44);
		await openControl(page).tap();
		await expect(page).toHaveURL(new RegExp(`/blog/${slug}/?$`));
	});

	test('the picked post docks as a slim bar that covers no star, and the map moves only when zoomed in', async ({ page }) => {
		await openMap(page);
		const panel = await boxOf(map(page));
		const before = await allCentres(page);
		// The lowest star on the map: the one a bar at the foot would cover first.
		const lowest = [...before].sort((a, b) => b.y - a.y)[0];
		// Where the map is drawn, in every frame from before the tap. The glows are drawn once and ride with the map, so their place is the map's place in that frame.
		// The star links follow only once the map has been still for a moment, so a read of them straight after the tap says nothing about a move that is still to come.
		await page.evaluate(() => {
			type Rest = { places: string[]; still: boolean };
			const state = window as unknown as { rest: Rest };
			state.rest = { places: [], still: false };
			const stage = document.querySelector('[data-testid="constellation-map"]') as Element;
			const glow = stage.querySelector('canvas.glow') as Element;
			let docked = 0;
			let since = 0;
			const sample = () => {
				const frame = stage.getBoundingClientRect();
				const drawn = glow.getBoundingClientRect();
				state.rest.places.push([drawn.left - frame.left, drawn.top - frame.top, drawn.width / frame.width].map(value => Math.round(value * 100) / 100 + 0).join(' '));
				if (!docked && stage.querySelector('[data-testid="constellation-card"]')) docked = performance.now();
				if (docked) since += 1;
				// A move starts in the frame after the bar shows and takes a third of a second. Three frames and more than half a second have then shown it on any machine.
				if (since >= 3 && performance.now() - docked >= 600) state.rest.still = true;
				else requestAnimationFrame(sample);
			};
			sample();
		});
		await page.touchscreen.tap(lowest.x, lowest.y - 3);
		await expect(openControl(page)).toBeVisible();
		const picked = await map(page).locator('a[aria-current="true"]').getAttribute('data-slug');
		if (!picked) throw new Error('no star picked');
		const dock = await boxOf(card(page));
		// Slim: one row across the foot, about a tenth of the map, with no list in it.
		expect(dock.height).toBeLessThan(panel.height * 0.12);
		expect(dock.y + dock.height).toBeGreaterThan(panel.y + panel.height - 20);
		await expect(card(page).getByRole('list')).toBeHidden();
		// At rest nothing moves: in every frame the map is drawn where it was before the tap.
		await expect.poll(() => page.evaluate(() => (window as unknown as { rest: { still: boolean } }).rest.still)).toBe(true);
		const places = await page.evaluate(() => (window as unknown as { rest: { places: string[] } }).rest.places);
		expect(places.length).toBeGreaterThan(3);
		expect([...new Set(places)]).toEqual([places[0]]);
		// The bar covers no star, the picked one least of all, and the star links are where they were: a second tap lands on the same star.
		const after = await allCentres(page);
		expect(after.filter(centre => inside(dock, centre.x, centre.y, 4))).toEqual([]);
		expect(after.find(centre => centre.slug === picked)?.y).toBeCloseTo(before.find(centre => centre.slug === picked)?.y ?? 0, 0);
		// The legend gives its place to the bar and comes back when the star is let go.
		await expect(legend(page).first()).toBeHidden();
		const empty = await emptySpot(page);
		await page.touchscreen.tap(empty.x, empty.y);
		await expect(card(page)).toHaveCount(0);
		await expect(legend(page).first()).toBeVisible();

		// Zoomed in, a star picked near the foot is brought into view above the bar.
		// The link layer follows once the map is still, and then carries the map's whole zoom: 1.6 times for one step, and 1.6 times that for two.
		// Links that hold still prove nothing: on a slow machine they also hold still before they have followed, and a tap then goes to where a star was.
		// So each step waits for the links to be as far apart as its zoom puts them.
		const [one, other] = [before[0], [...before].sort((a, b) => Math.hypot(b.x - before[0].x, b.y - before[0].y) - Math.hypot(a.x - before[0].x, a.y - before[0].y))[0]];
		const apart = (centres: Array<{ slug: string; x: number; y: number }>) => {
			const [a, b] = [centres.find(centre => centre.slug === one.slug), centres.find(centre => centre.slug === other.slug)];
			return a && b ? Math.hypot(a.x - b.x, a.y - b.y) : 0;
		};
		const zoom = async () => apart(await allCentres(page)) / apart(before);
		await control(page, 'Zoom in').tap();
		await expect(control(page, 'Reset')).toBeEnabled();
		await expect.poll(zoom).toBeCloseTo(1.6, 2);
		await control(page, 'Zoom in').tap();
		await expect.poll(zoom).toBeCloseTo(1.6 * 1.6, 2);
		// A tap on a control may also have scrolled the page, so the sky is measured again.
		const now = await boxOf(map(page));
		const zoomed = (await allCentres(page)).filter(centre => centre.x > now.x + 40 && centre.x < now.x + now.width - 40 && centre.y < now.y + now.height - 88 && centre.y > now.y + now.height - 130);
		if (zoomed.length === 0) throw new Error('no star near the foot once zoomed in');
		const low = zoomed.sort((a, b) => b.y - a.y)[0];
		await page.touchscreen.tap(low.x, low.y);
		await expect(openControl(page)).toBeVisible();
		const chosen = await map(page).locator('a[aria-current="true"]').getAttribute('data-slug');
		if (!chosen) throw new Error('no star picked once zoomed in');
		const bar = await boxOf(card(page));
		await expect.poll(async () => (await allCentres(page)).find(centre => centre.slug === chosen)?.y ?? Infinity).toBeLessThan(bar.y - 12);
	});
});

test.describe('phone, touch gestures', () => {
	test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

	// Real touch points, sent through the browser's own input path, so its scrolling takes part.
	async function swipe(page: Page, paths: Array<{ from: [number, number]; to: [number, number] }>) {
		const client = await page.context().newCDPSession(page);
		const points = (t: number) => paths.map(({ from, to }, id) => ({ id, x: Math.round(from[0] + (to[0] - from[0]) * t), y: Math.round(from[1] + (to[1] - from[1]) * t) }));
		await client.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: points(0) });
		for (let step = 1; step <= 12; step += 1) {
			await client.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: points(step / 12) });
			await page.waitForTimeout(16);
		}
		await client.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
		await client.detach();
	}

	test('one finger scrolls the page over the map, at rest and zoomed in, and two fingers zoom', async ({ page }) => {
		await openMap(page);
		const reset = control(page, 'Reset');
		const scrollY = () => page.evaluate(() => window.scrollY);
		const middle = async () => {
			await page.evaluate(() => document.querySelector('[data-testid="constellation-map"]')?.scrollIntoView({ block: 'center' }));
			const box = await boxOf(map(page));
			return { x: box.x + box.width / 2, y: box.y + box.height * 0.4 };
		};
		expect(await map(page).evaluate(node => getComputedStyle(node).touchAction)).toBe('pan-y');

		// At rest a swipe up scrolls the page.
		let at = await middle();
		let before = await scrollY();
		await swipe(page, [{ from: [at.x, at.y + 80], to: [at.x, at.y - 120] }]);
		await expect.poll(scrollY).toBeGreaterThan(before + 60);
		await expect(reset).toBeDisabled();

		// Two fingers moving apart zoom the map and leave the page where it is.
		at = await middle();
		before = await scrollY();
		await swipe(page, [
			{ from: [at.x, at.y - 30], to: [at.x, at.y - 130] },
			{ from: [at.x, at.y + 30], to: [at.x, at.y + 130] },
		]);
		await expect(reset).toBeEnabled();
		expect(Math.abs((await scrollY()) - before)).toBeLessThan(4);
		expect(await map(page).evaluate(node => getComputedStyle(node).touchAction)).toBe('pan-y');

		// Zoomed in, a swipe up still scrolls the page: the map never traps it.
		at = await middle();
		before = await scrollY();
		await swipe(page, [{ from: [at.x, at.y + 80], to: [at.x, at.y - 120] }]);
		await expect.poll(scrollY).toBeGreaterThan(before + 60);

		// Zoomed in, a sideways drag moves the map and not the page.
		at = await middle();
		before = await scrollY();
		const start = (await allCentres(page))[0];
		await swipe(page, [{ from: [at.x + 90, at.y], to: [at.x - 90, at.y] }]);
		await expect.poll(async () => Math.abs((await allCentres(page))[0].x - start.x)).toBeGreaterThan(40);
		expect(Math.abs((await scrollY()) - before)).toBeLessThan(4);
	});
});

test('reduced motion: the sky is complete at once and nothing animates', async ({ page }) => {
	await page.emulateMedia({ reducedMotion: 'reduce' });
	await openMap(page);
	const { x, y } = await loneStar(page);
	await page.mouse.move(x, y);
	await expect(tip(page)).toBeVisible();
	await names(page).first().click();
	await expect(control(page, 'Reset')).toBeEnabled();
	const moving = await page.evaluate(() => {
		const section = document.querySelector('.constellation');
		const running = document.getAnimations().filter(animation => {
			const target = (animation.effect as KeyframeEffect | null)?.target;
			return target instanceof Element && section?.contains(target);
		}).length;
		const styled = [...(section?.querySelectorAll('*') ?? [])].filter(element => getComputedStyle(element).animationName !== 'none').length;
		return { running, styled };
	});
	expect(moving).toEqual({ running: 0, styled: 0 });
});
