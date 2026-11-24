import { test, expect, type Page } from '@playwright/test';

// TIN-8654: a build with no verified projection has no notes. The site is as
// it was before notes existed: no Notes link, no /notes page, no receipt, and
// no request a page did not already make.

function recordNotesRequests(page: Page): string[] {
	const requests: string[] = [];
	page.on('request', (request) => {
		const { pathname } = new URL(request.url());
		if (pathname === '/notes' || pathname.startsWith('/notes/') || pathname.endsWith('/projection.json')) {
			requests.push(request.url());
		}
	});
	return requests;
}

test('the navigation has no Notes link and the home page asks for no notes data', async ({ page }) => {
	const requests = recordNotesRequests(page);
	await page.goto('/');
	await page.waitForLoadState('networkidle');
	await expect(page.locator('a[href="/notes"]')).toHaveCount(0);
	await page.goto('/blog');
	await page.waitForLoadState('networkidle');
	await expect(page.locator('a[href="/notes"]')).toHaveCount(0);
	expect(requests).toEqual([]);
});

test('/notes and a note path answer the normal not-found', async ({ request }) => {
	for (const path of ['/notes', '/notes/first-light']) {
		const response = await request.get(path);
		expect(response.status(), path).toBe(404);
	}
});

test('no projection receipt is served, and the webfinger file is unchanged', async ({ request }) => {
	expect((await request.get('/.well-known/projection.json')).status()).toBe(404);
	const webfinger = await request.get('/.well-known/webfinger');
	expect(webfinger.status()).toBe(200);
	expect((await webfinger.json()).subject).toBe('acct:jess@transscendsurvival.org');
});

// Post slugs can start with "notes", so the checks match the notes URLs exactly.
const NOTES_URL = 'https://transscendsurvival.org/notes';

test('the feeds and the sitemap carry no note', async ({ request }) => {
	const feed = await (await request.get('/feed.json')).json();
	expect(feed.items.filter((item: { id: string }) => item.id.startsWith(`${NOTES_URL}/`))).toEqual([]);
	expect(await (await request.get('/feed.xml')).text()).not.toContain(`<link>${NOTES_URL}/`);
	const sitemap = await (await request.get('/sitemap.xml')).text();
	expect(sitemap).not.toContain(`<loc>${NOTES_URL}</loc>`);
	expect(sitemap).not.toContain(`<loc>${NOTES_URL}/`);
});
