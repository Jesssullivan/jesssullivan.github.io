import { test, expect, type Page } from '@playwright/test';

// TIN-5680: the similarity map is part of the default-off constellation experiment,
// is drawn from a build-time projection, and never fetches anything at runtime.
const brokerUrls = [
	'https://hub.tinyland.dev/projections/jesssullivan-github-io/blog/broker-stream.v1.json',
	'https://hub.tinyland.dev/projections/jesssullivan-github-io/pulse/public-snapshot.v2.json',
];
// `published: false` in src/posts and listed in static/blog-publication-holds.json.
const HELD_SLUG = 'hello-world';

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

function recordProjectionRequests(page: Page): string[] {
	const requests: string[] = [];
	// The projection is bundled at build time; any request for it as data is a regression.
	page.on('request', request => { if (/posts-projection[^/]*\.json$/i.test(new URL(request.url()).pathname)) requests.push(request.url()); });
	return requests;
}

const activeSlug = (page: Page) => page.evaluate(() => (document.activeElement as Element | null)?.getAttribute('data-slug') ?? null);

test('flag off: no map DOM, no projection request, even with a focus link', async ({ page }) => {
	const requests = recordProjectionRequests(page);
	await page.goto('/?focus=some-post');
	await expect(page.locator('#latest')).toBeVisible();
	await expect(page.locator('.constellation')).toHaveCount(0);
	await expect(page.getByTestId('posts-projection')).toHaveCount(0);
	expect(requests).toEqual([]);
});

test('flag on: every routeable projected post is a keyboard-reachable map node and a list item', async ({ page }) => {
	const requests = recordProjectionRequests(page);
	await page.goto('/?flags=constellation');
	await expect(page.locator('.constellation')).toBeVisible();

	// The ordinary reader archive lists every routeable post.
	const routeable = new Set(await page.locator('#archive a[href^="/blog/"]').evaluateAll(links => links.map(link => (link as HTMLAnchorElement).pathname.replace(/^\/blog\//, '').replace(/\/$/, ''))));
	expect(routeable.has(HELD_SLUG)).toBe(false);

	// The section opens on the map (RM27).
	await expect(page.getByRole('button', { name: 'Map', exact: true })).toHaveAttribute('aria-pressed', 'true');
	const nodes = page.locator('.projection-map a[data-slug]');
	const slugs = await nodes.evaluateAll(links => links.map(link => link.getAttribute('data-slug') ?? ''));
	expect(slugs.length).toBeGreaterThan(100);
	expect(new Set(slugs).size).toBe(slugs.length);
	for (const slug of slugs) expect(routeable.has(slug), slug).toBe(true);
	expect(slugs).not.toContain(HELD_SLUG);
	await expect(page.getByTestId('posts-projection')).toContainText(`Placed ${slugs.length} public posts.`);
	await expect(page.getByTestId('posts-projection')).toContainText('not measurements');

	// One roving tab stop; arrows walk the map; the detail panel follows.
	await expect(page.locator('.projection-map a[tabindex="0"]')).toHaveCount(1);
	await page.locator('.projection-map a[tabindex="0"]').focus();
	const start = await activeSlug(page);
	expect(start).not.toBeNull();
	const visited = new Set([start]);
	for (const key of ['ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowDown', 'ArrowRight']) {
		await page.keyboard.press(key);
		const current = await activeSlug(page);
		expect(current).not.toBeNull();
		visited.add(current);
	}
	expect(visited.size).toBeGreaterThan(1);
	const current = await activeSlug(page);
	await expect(page.locator('.projection-map a[tabindex="0"]')).toHaveAttribute('data-slug', current as string);
	await expect(page.getByTestId('posts-projection-detail').locator(`a[href="/blog/${current}"]`)).toBeVisible();
	await page.keyboard.press('Enter');
	await expect(page).toHaveURL(new RegExp(`/blog/${current}/?$`));

	await page.goto('/?flags=constellation');
	await page.getByRole('button', { name: 'List', exact: true }).click();
	await expect(page.getByRole('button', { name: 'List', exact: true })).toHaveAttribute('aria-pressed', 'true');
	await expect(page.locator('.similar-list > li')).toHaveCount(slugs.length);
	expect(requests).toEqual([]);
});

test('?focus=<slug> opens the map on that post', async ({ page }) => {
	await page.goto('/?flags=constellation');
	const target = await page.locator('.projection-map a[data-slug]').nth(7).getAttribute('data-slug');
	expect(target).toBeTruthy();
	await page.goto(`/?flags=constellation&focus=${target}`);
	await expect(page.getByRole('button', { name: 'Map', exact: true })).toHaveAttribute('aria-pressed', 'true');
	await expect.poll(() => activeSlug(page)).toBe(target);
	await expect(page.getByTestId('posts-projection-detail').locator(`a[href="/blog/${target}"]`)).toBeVisible();
});

// TIN-8628: how a reader opens a post from the map, and the phone layout.
// Pointer and touch input only reach the viewport, so scroll the node into view first.
async function nodeCentre(page: Page, slug: string, scroll = true): Promise<{ x: number; y: number }> {
	const dot = page.locator(`.projection-map a[data-slug="${slug}"] .dot`);
	if (scroll) await dot.scrollIntoViewIfNeeded();
	const box = await dot.boundingBox();
	if (!box) throw new Error(`no box for ${slug}`);
	return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

async function closestPair(page: Page): Promise<{ near: string; far: string }> {
	const slugs = await page.locator('.projection-map a[data-slug]').evaluateAll(links => links.map(link => link.getAttribute('data-slug') ?? ''));
	const centres = await Promise.all(slugs.map(slug => nodeCentre(page, slug, false)));
	let best = { near: '', far: '', distance: Infinity };
	for (let i = 0; i < slugs.length; i += 1) {
		for (let j = i + 1; j < slugs.length; j += 1) {
			const distance = Math.hypot(centres[i].x - centres[j].x, centres[i].y - centres[j].y);
			if (distance > 0 && distance < best.distance) best = { near: slugs[i], far: slugs[j], distance };
		}
	}
	return best;
}

const noHorizontalScroll = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth);

test('mouse: hover shows the title, a click opens the post', async ({ page }) => {
	await page.goto('/?flags=constellation');
	const slug = await page.locator('.projection-map a[data-slug]').nth(11).getAttribute('data-slug');
	const centre = await nodeCentre(page, slug as string);
	await page.mouse.move(centre.x, centre.y);
	await expect(page.locator(`.projection-map a[data-slug="${slug}"]`)).toHaveClass(/active/);
	await expect(page.getByTestId('posts-projection-open')).toHaveAttribute('href', `/blog/${slug}`);
	await page.mouse.click(centre.x, centre.y);
	await expect(page).toHaveURL(new RegExp(`/blog/${slug}/?$`));
});

test.describe('phone, touch', () => {
	test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

	test('fits 390px in both views without horizontal scroll', async ({ page }) => {
		await page.goto('/?flags=constellation');
		await expect(page.locator('.constellation')).toBeVisible();
		expect(await noHorizontalScroll(page)).toBe(true);
		for (const view of ['List', 'Map']) {
			await page.getByRole('button', { name: view, exact: true }).tap();
			await expect(page.getByRole('button', { name: view, exact: true })).toHaveAttribute('aria-pressed', 'true');
			expect(await noHorizontalScroll(page), view).toBe(true);
		}
	});

	test('first tap selects the nearest node in a dense cluster, a second tap opens it', async ({ page }) => {
		await page.goto('/?flags=constellation');
		const { near, far } = await closestPair(page);
		const a = await nodeCentre(page, near);
		const b = await nodeCentre(page, far, false);
		// Closer to `near` than to its nearest neighbour, inside both old overlapping hit circles.
		const tap = { x: a.x + (b.x - a.x) * 0.3, y: a.y + (b.y - a.y) * 0.3 };
		await page.touchscreen.tap(tap.x, tap.y);
		await expect(page.locator(`.projection-map a[data-slug="${near}"]`)).toHaveClass(/active/);
		await expect(page.locator(`.projection-map a[data-slug="${far}"]`)).not.toHaveClass(/active/);
		await expect(page.getByTestId('posts-projection-open')).toHaveAttribute('href', `/blog/${near}`);
		await expect(page).not.toHaveURL(/\/blog\//);
		await page.touchscreen.tap(tap.x, tap.y);
		await expect(page).toHaveURL(new RegExp(`/blog/${near}/?$`));
	});

	test('the Open post control opens the selected post', async ({ page }) => {
		await page.goto('/?flags=constellation');
		const slug = await page.locator('.projection-map a[data-slug]').nth(3).getAttribute('data-slug');
		const centre = await nodeCentre(page, slug as string);
		await page.touchscreen.tap(centre.x, centre.y);
		await page.getByTestId('posts-projection-open').tap();
		await expect(page).toHaveURL(new RegExp(`/blog/${slug}/?$`));
	});
});

// The card grid and its float animation were cut (RM27). Nothing in the section may move under reduced motion.
test('reduced motion: nothing in the constellation animates', async ({ page }) => {
	await page.emulateMedia({ reducedMotion: 'reduce' });
	await page.goto('/?flags=constellation');
	const slug = await page.locator('.projection-map a[data-slug]').nth(5).getAttribute('data-slug');
	const centre = await nodeCentre(page, slug as string);
	await page.mouse.move(centre.x, centre.y);
	await expect(page.locator(`.projection-map a[data-slug="${slug}"]`)).toHaveClass(/active/);
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
