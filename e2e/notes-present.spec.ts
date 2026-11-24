import { test, expect } from '@playwright/test';

// TIN-8654: runs only in //:playwright_notes_e2e, which builds the site from
// the xoxd-projection/v2 valid blog fixture after the projection step
// verified it with the contract's fixture public key. The fixture holds one note
// (/notes/first-light), one article (/blog/drawing-orbits) and one
// announcement (/announcements/office-hours).

const NOTE_URL = 'https://transscendsurvival.org/notes/first-light';

test('the navigation links to Notes and /notes lists the note', async ({ page }) => {
	await page.goto('/');
	await expect(page.locator('nav a[href="/notes"]').first()).toBeVisible();
	await page.goto('/notes');
	await expect(page.getByRole('heading', { level: 1, name: 'Notes' })).toBeVisible();
	await expect(page.getByText('1 note', { exact: true })).toBeVisible();
	const list = page.getByTestId('notes-list');
	await expect(list.locator('a[href="/notes/first-light"]')).toContainText('First light');
	await expect(list).toContainText('The hub published its first note to the blog.');
});

test('/notes/first-light renders the verified HTML inside the article chrome', async ({ page }) => {
	const response = await page.goto('/notes/first-light');
	expect(response?.status()).toBe(200);
	const article = page.getByTestId('note-article');
	await expect(article.getByRole('heading', { level: 1 })).toHaveText('First light');
	await expect(article.locator('[data-document-root] > p')).toHaveText(
		'The hub signed this note and the blog built it from the manifest.',
	);
	await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', NOTE_URL);
	await expect(article.locator('nav[aria-label="Breadcrumb"] a[href="/notes"]')).toBeVisible();
});

test('entries with a /blog path or another path are not built', async ({ request }) => {
	for (const path of ['/blog/drawing-orbits', '/notes/drawing-orbits', '/announcements/office-hours']) {
		expect((await request.get(path)).status(), path).toBe(404);
	}
	const feed = await (await request.get('/feed.json')).json();
	const ids = feed.items.map((item: { id: string }) => item.id);
	expect(ids).not.toContain('https://transscendsurvival.org/blog/drawing-orbits');
});

test('the note joins the feeds and the sitemap under its canonical URL', async ({ request }) => {
	const feed = await (await request.get('/feed.json')).json();
	const items = feed.items.filter((item: { id: string }) => item.id === NOTE_URL);
	expect(items).toHaveLength(1);
	expect(items[0].content_html).toBe('<p>The hub signed this note and the blog built it from the manifest.</p>');
	expect(items[0].date_published).toBe('2026-11-20T00:00:00.000Z');
	const rss = await (await request.get('/feed.xml')).text();
	expect(rss).toContain(`<guid isPermaLink="true">${NOTE_URL}</guid>`);
	const sitemap = await (await request.get('/sitemap.xml')).text();
	expect(sitemap).toContain(`<loc>${NOTE_URL}</loc>`);
	expect(sitemap).toContain('<loc>https://transscendsurvival.org/notes</loc>');
});

test('/.well-known/projection.json serves the receipt and webfinger is unchanged', async ({ request }) => {
	const receipt = await request.get('/.well-known/projection.json');
	expect(receipt.status()).toBe(200);
	expect(await receipt.json()).toEqual({
		contract: 'xoxd-projection/v2',
		target: 'blog',
		seq: 1,
		manifest: 'fbce3ad37f64d9aee7cecc90a2dda1d6bba77f726bb73541b031cf08997e2ee3',
	});
	const webfinger = await request.get('/.well-known/webfinger');
	expect((await webfinger.json()).subject).toBe('acct:jess@transscendsurvival.org');
});
