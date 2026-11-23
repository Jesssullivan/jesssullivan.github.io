import { test, expect, type Page } from '@playwright/test';

// TIN-5680, TIN-8628: the constellation is a default-off experiment. Its layout is built ahead of time.
// The page paints a silhouette at once and fetches the interactive layer and one hashed data file later.
const brokerUrls = [
	'https://hub.tinyland.dev/projections/jesssullivan-github-io/blog/broker-stream.v1.json',
	'https://hub.tinyland.dev/projections/jesssullivan-github-io/pulse/public-snapshot.v2.json',
];
// `published: false` in src/posts and listed in static/blog-publication-holds.json.
const HELD_SLUG = 'hello-world';
const DATA_FILE = /\/constellation\.v1\.[\w-]+\.json$/;

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

const map = (page: Page) => page.getByTestId('constellation-map');
const stars = (page: Page) => map(page).locator('a[data-slug]');
const star = (page: Page, slug: string) => map(page).locator(`a[data-slug="${slug}"]`);
const card = (page: Page) => page.getByTestId('constellation-card');
const openControl = (page: Page) => page.getByTestId('constellation-open');
const activeSlug = (page: Page) => page.evaluate(() => (document.activeElement as Element | null)?.getAttribute('data-slug') ?? null);
const noHorizontalScroll = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth);

/** Open the home page with the flag and wait for the interactive map. */
async function openMap(page: Page, query = '') {
	await page.goto(`/?flags=constellation${query}`);
	await expect(stars(page).first()).toBeAttached();
	await map(page).scrollIntoViewIfNeeded();
	// The names appear once the sky has assembled.
	await expect(map(page)).toHaveClass(/assembled/);
	await expect(map(page).getByRole('button', { name: /^Go to / }).first()).toBeVisible();
}

// Each star has a link centred on it. Pointers never hit the link: the map picks the nearest star.
async function allCentres(page: Page): Promise<Array<{ slug: string; x: number; y: number }>> {
	return stars(page).evaluateAll(links => links.map(link => {
		const box = link.getBoundingClientRect();
		return { slug: link.getAttribute('data-slug') ?? '', x: box.x + box.width / 2, y: box.y + box.height / 2 };
	}));
}

/** The star with the most room around it, away from the panel edges, so a pointer on it is unambiguous. */
async function loneStar(page: Page): Promise<{ slug: string; x: number; y: number }> {
	const centres = await allCentres(page);
	const panel = await map(page).boundingBox();
	if (!panel) throw new Error('no map box');
	const room = (a: { x: number; y: number }) => Math.min(...centres.filter(b => b !== a).map(b => Math.hypot(a.x - b.x, a.y - b.y)));
	const inside = centres.filter(a => a.x > panel.x + 80 && a.x < panel.x + panel.width - 80 && a.y > panel.y + 80 && a.y < panel.y + panel.height - 80);
	if (inside.length === 0) throw new Error('no star away from the edges');
	return inside.sort((a, b) => room(b) - room(a))[0];
}

test('flag off: no section, no silhouette, no data request, even with a focus link', async ({ page }) => {
	const requests = recordDataRequests(page);
	await page.goto('/?focus=some-post');
	await expect(page.locator('#latest')).toBeVisible();
	await expect(page.locator('.constellation')).toHaveCount(0);
	await expect(page.getByTestId('constellation-panel')).toHaveCount(0);
	await page.waitForLoadState('networkidle');
	expect(requests).toEqual([]);
});

test('first paint is the silhouette, the panel keeps its size, and the data is one hashed file', async ({ page, context }) => {
	// Hold the data back so the state before the interactive layer can be seen.
	let release: () => void = () => {};
	const held = new Promise<void>(resolve => { release = resolve; });
	await context.route(DATA_FILE, async route => {
		await held;
		await route.fulfill({ response: await route.fetch() });
	});
	const requests = recordDataRequests(page);
	await page.goto('/?flags=constellation');
	const panel = page.getByTestId('constellation-panel');
	await expect(panel).toBeVisible();
	const wide = page.getByTestId('constellation-silhouette-wide');
	await expect(wide).toBeVisible();
	const before = { panel: await panel.boundingBox(), latest: await page.locator('#latest').boundingBox() };
	// Every star is already drawn, and nothing interactive exists yet.
	const dots = await wide.locator('path').evaluateAll(paths => paths.reduce((sum, path) => sum + (path.getAttribute('d')?.match(/M/g)?.length ?? 0), 0));
	expect(dots).toBeGreaterThan(100);
	await expect(page.locator('.constellation canvas')).toHaveCount(0);
	await expect(page.getByRole('tab', { name: 'Map', exact: true })).toHaveAttribute('aria-selected', 'true');

	release();
	await expect(stars(page)).toHaveCount(dots);
	await expect(wide).toBeHidden();
	// No layout shift: the panel and the section below it are where they were.
	expect(await panel.boundingBox()).toEqual(before.panel);
	expect(await page.locator('#latest').boundingBox()).toEqual(before.latest);
	// One data file, with a content hash in its name, under the immutable directory.
	expect(requests.filter(url => DATA_FILE.test(new URL(url).pathname))).toHaveLength(1);
	expect(requests.every(url => new URL(url).pathname.startsWith('/_app/immutable/'))).toBe(true);
	// The canvas draws each star where the silhouette had it.
	const centres = await allCentres(page);
	const field = await page.locator('.constellation .field').boundingBox();
	if (!field) throw new Error('no field box');
	for (const centre of centres) {
		expect(centre.x).toBeGreaterThanOrEqual(field.x - 1);
		expect(centre.x).toBeLessThanOrEqual(field.x + field.width + 1);
		expect(centre.y).toBeGreaterThanOrEqual(field.y - 1);
		expect(centre.y).toBeLessThanOrEqual(field.y + field.height + 1);
	}
});

// The flag is read after the page has painted, so the section cannot be in the first paint (TIN-8628).
// It opens its space with a slide, not a jump: nothing in the section or after it scores a layout shift.
test('the section arrives without a layout shift', async ({ page }) => {
	await page.addInitScript(() => {
		const state = window as unknown as { shifts: Array<{ value: number; nodes: Node[] }> };
		state.shifts = [];
		new PerformanceObserver(list => {
			for (const entry of list.getEntries() as unknown as Array<{ value: number; hadRecentInput: boolean; sources?: Array<{ node: Node | null }> }>) {
				if (!entry.hadRecentInput) state.shifts.push({ value: entry.value, nodes: (entry.sources ?? []).map(source => source.node).filter((node): node is Node => node !== null) });
			}
		}).observe({ type: 'layout-shift', buffered: true });
	});
	await page.goto('/?flags=constellation');
	await expect(stars(page).first()).toBeAttached();
	// The slide is over once what follows the section has no animation left.
	await expect.poll(() => page.evaluate(() => document.querySelector('.constellation')?.nextElementSibling?.getAnimations().length)).toBe(0);
	await page.waitForLoadState('networkidle');
	// Shifts of the section, of what follows it, or of anything inside either. The page above has its own and is not judged here.
	const moved = await page.evaluate(() => {
		const section = document.querySelector('.constellation');
		const below = section?.nextElementSibling;
		const ours = (node: Node) => Boolean(section?.contains(node) || below?.contains(node));
		const { shifts } = window as unknown as { shifts: Array<{ value: number; nodes: Node[] }> };
		return shifts.filter(shift => shift.nodes.some(ours)).map(shift => ({ value: shift.value, nodes: shift.nodes.map(node => node.nodeName) }));
	});
	expect(moved).toEqual([]);
	// The section is in place above the reader, at its final size.
	const panel = await page.getByTestId('constellation-panel').boundingBox();
	const latest = await page.locator('#latest').boundingBox();
	if (!panel || !latest) throw new Error('no boxes');
	expect(latest.y).toBeGreaterThan(panel.y + panel.height);
});

test('when the data does not load the silhouette stays and the reader is told where to read', async ({ page, context }) => {
	await context.route(DATA_FILE, route => route.abort());
	await page.goto('/?flags=constellation');
	await expect(page.getByTestId('constellation-silhouette-wide')).toBeVisible();
	await expect(page.getByTestId('constellation-panel')).toContainText('The map did not load.');
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

	// The map has a name and a role, and the method note is in the help.
	await expect(page.getByRole('group', { name: 'Map of posts' })).toBeVisible();
	await page.getByRole('button', { name: 'How it works' }).click();
	await expect(page.locator('#constellation-help')).toContainText('not measurements');
	await page.keyboard.press('Escape');
	await expect(page.locator('#constellation-help')).toBeHidden();

	// One roving tab stop. Arrows walk the map, and the card follows.
	await expect(map(page).locator('a[data-slug][tabindex="0"]')).toHaveCount(1);
	await map(page).locator('a[data-slug][tabindex="0"]').focus();
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
	await expect(star(page, current)).toHaveAttribute('aria-current', 'true');
	await expect(openControl(page)).toHaveAttribute('href', `/blog/${current}`);
	// The card names the post, its category and its date, and offers nearby posts as next steps.
	await expect(card(page).locator('h3')).not.toBeEmpty();
	await expect(card(page).locator('.chip')).not.toBeEmpty();
	await expect(card(page).locator('time')).toHaveAttribute('datetime', /^\d{4}-\d{2}-\d{2}/);
	await expect(card(page).locator('.nearby button').first()).toBeVisible();
	// Escape clears the selection.
	await page.keyboard.press('Escape');
	await expect(card(page)).toHaveCount(0);
	await page.keyboard.press('ArrowRight');
	const next = await activeSlug(page) as string;
	await page.keyboard.press('Enter');
	await expect(page).toHaveURL(new RegExp(`/blog/${next}/?$`));

	// The list is one tab stop from the start of the section, and holds the same posts.
	await page.goto('/?flags=constellation');
	await page.getByRole('heading', { name: 'The constellation' }).click();
	await page.keyboard.press('Tab');
	await expect(page.getByRole('tab', { name: 'Map', exact: true })).toBeFocused();
	await page.keyboard.press('ArrowRight');
	await expect(page.getByRole('tab', { name: 'List', exact: true })).toHaveAttribute('aria-selected', 'true');
	await expect(page.getByTestId('constellation-list').locator('> li')).toHaveCount(slugs.length);
	await expect(page.getByTestId('constellation-list').locator('> li > a').first()).toHaveAttribute('href', /^\/blog\//);
});

test('?focus=<slug> opens the map on that post', async ({ page }) => {
	await openMap(page);
	const target = await stars(page).nth(7).getAttribute('data-slug');
	expect(target).toBeTruthy();
	await page.goto(`/?flags=constellation&focus=${target}`);
	await expect(page.getByRole('tab', { name: 'Map', exact: true })).toHaveAttribute('aria-selected', 'true');
	await expect.poll(() => activeSlug(page)).toBe(target);
	await expect(openControl(page)).toHaveAttribute('href', `/blog/${target}`);
});

test('mouse: hover shows the card, a click picks the star, a second click opens the post', async ({ page }) => {
	await openMap(page);
	const { slug, x, y } = await loneStar(page);
	await page.mouse.move(x, y);
	await expect(card(page).locator('h3')).toBeVisible();
	await expect(openControl(page)).toHaveCount(0);
	await page.mouse.click(x, y);
	await expect(star(page, slug)).toHaveAttribute('aria-current', 'true');
	await expect(openControl(page)).toHaveAttribute('href', `/blog/${slug}`);
	await expect(page).not.toHaveURL(/\/blog\//);
	await page.mouse.click(x, y);
	await expect(page).toHaveURL(new RegExp(`/blog/${slug}/?$`));

	// Back returns to the same star, with its card open.
	await page.goBack();
	await expect(star(page, slug)).toHaveAttribute('aria-current', 'true');
	await expect(openControl(page)).toHaveAttribute('href', `/blog/${slug}`);
});

test('a nearby post in the card is the next step', async ({ page }) => {
	await openMap(page);
	const { x, y } = await loneStar(page);
	await page.mouse.click(x, y);
	const step = card(page).locator('.nearby button').first();
	const title = (await step.textContent())?.trim() ?? '';
	await step.click();
	await expect(card(page).locator('h3')).toHaveText(title);
});

test('a constellation name flies to it, Reset returns, and a plain wheel scrolls the page', async ({ page }) => {
	await openMap(page);
	const reset = map(page).getByRole('button', { name: 'Reset', exact: true });
	await expect(reset).toBeDisabled();

	// A plain wheel over the map scrolls the page and does not zoom.
	const box = await map(page).boundingBox();
	if (!box) throw new Error('no map box');
	await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
	const scrollBefore = await page.evaluate(() => window.scrollY);
	await page.mouse.wheel(0, 240);
	await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(scrollBefore);
	await expect(reset).toBeDisabled();
	await map(page).scrollIntoViewIfNeeded();

	const before = await allCentres(page);
	await map(page).getByRole('button', { name: /^Go to / }).first().click();
	await expect(reset).toBeEnabled();
	// Zoomed in: stars are farther apart than before.
	await expect.poll(async () => {
		const after = await allCentres(page);
		return Math.hypot(after[0].x - after[1].x, after[0].y - after[1].y) / Math.hypot(before[0].x - before[1].x, before[0].y - before[1].y);
	}).toBeGreaterThan(1.3);
	// Every name that shows is whole: none is cut by the edge of the panel.
	const cut = await map(page).getByRole('button', { name: /^Go to / }).evaluateAll(names => {
		const panel = (names[0].closest('[data-testid="constellation-map"]') as Element).getBoundingClientRect();
		return names.filter(name => getComputedStyle(name).visibility !== 'hidden').filter(name => {
			const box = name.getBoundingClientRect();
			return box.left < panel.left || box.right > panel.right;
		}).length;
	});
	expect(cut).toBe(0);
	await reset.click();
	await expect(reset).toBeDisabled();
	await expect.poll(async () => (await allCentres(page))[0].x).toBeCloseTo(before[0].x, 0);

	// Ctrl and wheel zooms.
	const here = await map(page).boundingBox();
	if (!here) throw new Error('no map box');
	await page.mouse.move(here.x + here.width / 2, here.y + here.height / 2);
	await page.keyboard.down('Control');
	await page.mouse.wheel(0, -200);
	await page.keyboard.up('Control');
	await expect(reset).toBeEnabled();
});

test('the legend filters the map and the list to one category', async ({ page }) => {
	await openMap(page);
	const chip = page.locator('.constellation .legend button').first();
	const count = Number(await chip.locator('.count').textContent());
	expect(count).toBeGreaterThan(0);
	// No text in the heading block or the legend is dimmed, with or without a filter: state shows as a border and a hollow dot.
	const dimmed = () => page.locator('.constellation :is(.lede, .legend button, .legend .count)').evaluateAll(nodes => nodes.filter(node => getComputedStyle(node).opacity !== '1').length);
	expect(await dimmed()).toBe(0);
	await chip.click();
	await expect(chip).toHaveAttribute('aria-pressed', 'true');
	expect(await dimmed()).toBe(0);
	const other = page.locator('.constellation .legend button[aria-pressed="false"] .dot').first();
	expect(await other.evaluate(node => getComputedStyle(node).backgroundImage + getComputedStyle(node).backgroundColor)).toMatch(/rgba\(0, 0, 0, 0\)|transparent/);
	await page.getByRole('tab', { name: 'List', exact: true }).click();
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
		const box = await map(page).boundingBox();
		if (!box) throw new Error('no map box');
		expect(box.height).toBeGreaterThan(box.width);
		for (const view of ['List', 'Map']) {
			await page.getByRole('tab', { name: view, exact: true }).tap();
			await expect(page.getByRole('tab', { name: view, exact: true })).toHaveAttribute('aria-selected', 'true');
			expect(await noHorizontalScroll(page), view).toBe(true);
		}
	});

	test('first tap selects the nearest star in a dense cluster, a second tap opens it', async ({ page }) => {
		await openMap(page);
		const centres = await allCentres(page);
		let best = { near: centres[0], far: centres[1], distance: Infinity };
		for (let i = 0; i < centres.length; i += 1) {
			for (let j = i + 1; j < centres.length; j += 1) {
				const distance = Math.hypot(centres[i].x - centres[j].x, centres[i].y - centres[j].y);
				// Closer than a finger, and far enough apart that sub-pixel layout cannot swap them.
				if (distance >= 6 && distance < best.distance) best = { near: centres[i], far: centres[j], distance };
			}
		}
		// A tap between two stars, nearer the first one, picks the first one.
		expect(best.distance).toBeLessThan(44);
		const tap = { x: best.near.x + (best.far.x - best.near.x) * 0.3, y: best.near.y + (best.far.y - best.near.y) * 0.3 };
		await page.touchscreen.tap(tap.x, tap.y);
		await expect(star(page, best.near.slug)).toHaveAttribute('aria-current', 'true');
		await expect(star(page, best.far.slug)).not.toHaveAttribute('aria-current', 'true');
		await expect(openControl(page)).toHaveAttribute('href', `/blog/${best.near.slug}`);
		await expect(page).not.toHaveURL(/\/blog\//);
		await page.touchscreen.tap(tap.x, tap.y);
		await expect(page).toHaveURL(new RegExp(`/blog/${best.near.slug}/?$`));
	});

	test('a star with room beside it has a touch target of at least 44 pixels, and Open opens the post', async ({ page }) => {
		await openMap(page);
		const centres = await allCentres(page);
		const box = await map(page).boundingBox();
		if (!box) throw new Error('no map box');
		// A point 22 pixels from a star, on a side where no other star is nearer.
		const tries = centres.flatMap(c => [0, 1, 2, 3, 4, 5, 6, 7].map(step => ({ slug: c.slug, x: c.x + Math.cos(step * Math.PI / 4) * 22, y: c.y + Math.sin(step * Math.PI / 4) * 22 })));
		const open = tries.filter(p => p.x > box.x + 12 && p.x < box.x + box.width - 12 && p.y > box.y + 60 && p.y < box.y + box.height - 90 && centres.every(c => c.slug === p.slug || Math.hypot(c.x - p.x, c.y - p.y) > 26));
		// A constellation name is a control of its own, so the point must be on the map itself.
		const onMap = await page.evaluate(points => points.map(p => document.elementFromPoint(p.x, p.y)?.tagName === 'CANVAS'), open);
		const found = open.find((_, index) => onMap[index]);
		if (!found) throw new Error('no star with room beside it');
		const { slug } = found;
		await page.touchscreen.tap(found.x, found.y);
		await expect(star(page, slug)).toHaveAttribute('aria-current', 'true');
		const control = await openControl(page).boundingBox();
		expect(control?.height).toBeGreaterThanOrEqual(44);
		// The picked post sits in its own strip under the map: at rest the card covers no star.
		const sheet = await card(page).boundingBox();
		if (!sheet) throw new Error('no card box');
		expect(centres.filter(c => c.x > sheet.x && c.x < sheet.x + sheet.width && c.y > sheet.y && c.y < sheet.y + sheet.height)).toEqual([]);
		await openControl(page).tap();
		await expect(page).toHaveURL(new RegExp(`/blog/${slug}/?$`));
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
		const reset = map(page).getByRole('button', { name: 'Reset', exact: true });
		const scrollY = () => page.evaluate(() => window.scrollY);
		const middle = async () => {
			await page.evaluate(() => document.querySelector('[data-testid="constellation-map"]')?.scrollIntoView({ block: 'center' }));
			const box = await map(page).boundingBox();
			if (!box) throw new Error('no map box');
			return { x: box.x + box.width / 2, y: box.y + box.height * 0.4 };
		};

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
	await expect(card(page)).toBeVisible();
	await map(page).getByRole('button', { name: /^Go to / }).first().click();
	await expect(map(page).getByRole('button', { name: 'Reset', exact: true })).toBeEnabled();
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
