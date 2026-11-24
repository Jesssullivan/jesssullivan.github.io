import { test, expect } from '@playwright/test';

const brokerUrls = [
	'https://hub.tinyland.dev/projections/jesssullivan-github-io/blog/broker-stream.v1.json',
	'https://hub.tinyland.dev/projections/jesssullivan-github-io/pulse/public-snapshot.v2.json',
];

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

test('default remains unchanged; same-route client navigation enables, disables and clears preference', async ({ page }) => {
	const requests: string[] = [];
	// Without the flag the page asks for neither the broker streams nor the map data.
	page.on('request', request => { if (brokerUrls.includes(request.url()) || /constellation/i.test(new URL(request.url()).pathname)) requests.push(request.url()); });
	await page.goto('/');
	await expect(page.locator('#latest')).toBeVisible();
	await expect(page.locator('.constellation')).toHaveCount(0);
	expect(requests).toEqual([]);
	// A real same-origin anchor exercises SvelteKit client navigation without a reload.
	await page.evaluate(() => {
		const link = document.createElement('a'); link.id = 'flag-navigation';
		link.href = '/?flags=constellation'; link.textContent = 'Enable public experiment';
		document.body.append(link);
		(window as unknown as { navigationSentinel: string }).navigationSentinel = 'same-document';
	});
	await page.locator('#flag-navigation').click();
	await expect(page.locator('.constellation')).toBeVisible();
	await expect(page.getByTestId('home-reader-broker-state')).toContainText('Blog unavailable; Pulse unavailable.');
	// The section opens on the map, with the list one control away (RM27).
	await expect(page.getByRole('button', { name: 'Show as a list', exact: true })).toBeVisible();
	await expect(page.getByTestId('constellation-map').locator('a[href^="/blog/"]').first()).toBeAttached();
	// With the flag on, the profile column starts below the sky.
	const sky = await page.getByTestId('constellation-panel').boundingBox();
	const aside = await page.locator('#main-content + aside > div').boundingBox();
	if (!sky || !aside) throw new Error('no boxes');
	expect(aside.y).toBeGreaterThanOrEqual(sky.y + sky.height);
	await page.evaluate(() => { const link = document.querySelector<HTMLAnchorElement>('#flag-navigation'); if (link) link.href = '/?flags=none'; });
	requests.length = 0;
	await page.locator('#flag-navigation').click();
	await expect(page.locator('.constellation')).toHaveCount(0);
	// Turning the flag off puts the profile column back where the layout has it.
	expect(await page.locator('#main-content + aside').evaluate(element => (element as HTMLElement).style.paddingTop)).toBe('');
	expect(await page.evaluate(() => (window as unknown as { navigationSentinel: string }).navigationSentinel)).toBe('same-document');
	expect(await page.evaluate(() => localStorage.getItem('tss:flags:constellation'))).toBeNull();
	expect(requests).toEqual([]);
	await page.goto('/');
	await expect(page.locator('.constellation')).toHaveCount(0);
});

test('no-JS explicit opt-in still contains only the ordinary reader', async ({ browser, baseURL }) => {
	const context = await browser.newContext({ javaScriptEnabled: false, baseURL });
	try {
		if (!baseURL || !['localhost', '127.0.0.1', '[::1]'].includes(new URL(baseURL).hostname)) throw new Error('loopback only');
		await context.route('**/*', async route => {
			const request = route.request(); const url = new URL(request.url());
			if (url.origin !== new URL(baseURL).origin || url.username || url.password || !['GET', 'HEAD'].includes(request.method())) { await route.abort(); return; }
			const response = await route.fetch({ maxRedirects: 0 });
			if (response.status() >= 300 && response.status() < 400) await route.abort();
			else await route.fulfill({ response });
		});
		const page = await context.newPage();
		await page.goto('/?flags=constellation');
		await expect(page.locator('#latest')).toBeVisible();
		await expect(page.locator('.constellation')).toHaveCount(0);
	} finally { await context.close(); }
});
