import { test, expect } from '@playwright/test';

test.describe('WordPress Redirects', () => {
	test('old WP URL serves redirect page with meta-refresh', async ({ request }) => {
		const response = await request.get('/2016/12/13/example-photo-work/');
		expect(response.status()).toBe(200);
		const body = await response.text();
		expect(body).toContain('meta http-equiv="refresh"');
		expect(body).toContain('/blog/example-photo-work');
	});

	test('redirect page has canonical link', async ({ request }) => {
		const response = await request.get('/2016/12/13/example-photo-work/');
		const body = await response.text();
		expect(body).toContain('rel="canonical"');
		expect(body).toContain('/blog/example-photo-work');
	});

	test('redirect page has noindex meta', async ({ request }) => {
		const response = await request.get('/2016/12/13/example-photo-work/');
		const body = await response.text();
		expect(body).toContain('noindex');
	});

	test('second WP URL also serves redirect page', async ({ request }) => {
		const response = await request.get('/2016/12/13/the-audeasy-build/');
		expect(response.status()).toBe(200);
		const body = await response.text();
		expect(body).toContain('/blog/the-audeasy-build');
	});
});

test.describe('Pagefind', () => {
	test('search index JS exists', async ({ request }) => {
		const response = await request.get('/pagefind/pagefind.js');
		expect(response.status()).toBe(200);
	});

	test('search entry JSON exists', async ({ request }) => {
		const response = await request.get('/pagefind/pagefind-entry.json');
		expect(response.status()).toBe(200);
	});
});
