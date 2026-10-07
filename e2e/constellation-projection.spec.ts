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

function recordProjectionRequests(page: Page): string[] {
	const requests: string[] = [];
	page.on('request', request => { if (/projection/i.test(new URL(request.url()).pathname) && !brokerUrls.includes(request.url())) requests.push(request.url()); });
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
	await expect(page.getByTestId('posts-projection')).toHaveCount(0);

	await page.getByRole('button', { name: 'Year tree', exact: true }).click();
	const routeable = new Set(await page.locator('.year-tree a[href^="/blog/"]').evaluateAll(links => links.map(link => (link as HTMLAnchorElement).pathname.replace(/^\/blog\//, '').replace(/\/$/, ''))));
	expect(routeable.has(HELD_SLUG)).toBe(false);

	await page.getByRole('button', { name: 'Similarity map', exact: true }).click();
	await expect(page.getByRole('button', { name: 'Similarity map', exact: true })).toHaveAttribute('aria-pressed', 'true');
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

	await page.goto('/');
	await page.getByRole('button', { name: 'Similar posts', exact: true }).click();
	await expect(page.locator('.similar-list > li')).toHaveCount(slugs.length);
	expect(requests).toEqual([]);
});

test('?focus=<slug> opens the map on that post', async ({ page }) => {
	await page.goto('/?flags=constellation');
	await page.getByRole('button', { name: 'Similarity map', exact: true }).click();
	const target = await page.locator('.projection-map a[data-slug]').nth(7).getAttribute('data-slug');
	expect(target).toBeTruthy();
	await page.goto(`/?flags=constellation&focus=${target}`);
	await expect(page.getByRole('button', { name: 'Similarity map', exact: true })).toHaveAttribute('aria-pressed', 'true');
	await expect.poll(() => activeSlug(page)).toBe(target);
	await expect(page.getByTestId('posts-projection-detail').locator(`a[href="/blog/${target}"]`)).toBeVisible();
});
