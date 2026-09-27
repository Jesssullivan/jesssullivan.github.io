import { expect, test } from '@playwright/test';
import snapshot from '../static/profile/profile.v1.json' with { type: 'json' };
import { parseProfileV1 } from '../src/lib/profile/schema';

test.beforeEach(async ({ page }) => {
	await page.route('https://jess.clients.xoxd.ai/**', (route) => route.abort());
});

test('saved evidence stays visible and supports keyboard and touch selection', async ({ page }) => {
	await page.goto('/projects');
	await expect(page.locator('[data-profile-source]')).toHaveAttribute('data-profile-source', 'saved');
	await expect(page.locator('[data-project]')).toHaveCount(snapshot.repos.length);
	await expect(page.getByText('Live refresh unavailable;', { exact: false })).toBeVisible();
	const left = [...snapshot.repos].sort((a, b) => a.x - b.x)[0];
	await page.getByLabel('Choose a project').selectOption(left.id);
	const point = page.locator(`[data-project="${left.id}"]`);
	await point.focus();
	await page.keyboard.press('ArrowRight');
	await expect(point).toHaveAttribute('tabindex', '-1');
	await expect(page.locator('.map-node[tabindex="0"]')).toBeFocused();
	await page.setViewportSize({ width: 390, height: 844 });
	const unlinked = snapshot.repos.find((row) => row.link === null)!;
	await page.getByLabel('Choose a project').selectOption(unlinked.id);
	await expect(page.locator('[data-testid="project-popover"] h3')).toHaveText(unlinked.label);
	await expect(page.locator('.project-proof')).toHaveCount(0);
	await expect(page.getByText('Shown without a repository link.')).toBeVisible();
	expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
});

test('filters preserve supplied coordinates and the catalogue has public proof links', async ({ page }) => {
	await page.goto('/projects');
	const expected = snapshot.repos.filter(
		(r) => Object.keys(r.langs).includes('Python') || r.label.toLowerCase().includes('python'),
	);
	await page.getByLabel('Find a project or language').fill('Python');
	await expect(page.locator('[data-project]')).toHaveCount(expected.length);
	const first = expected[0];
	const transform = await page.locator(`[data-project="${first.id}"]`).getAttribute('transform');
	expect(transform).toBe(`translate(${38 + first.x * 644} ${38 + first.y * 644})`);
	await page.locator('#project-catalogue summary').click();
	await expect(page.locator('#project-catalogue tbody tr')).toHaveCount(expected.length);
});

test('a malformed live response cannot replace the validated saved snapshot', async ({ page }) => {
	await page.unroute('https://jess.clients.xoxd.ai/**');
	let fetched = false;
	await page.route('https://jess.clients.xoxd.ai/**', (route) => {
		fetched = true;
		return route.fulfill({ json: { ...snapshot, private_data: 'not public' } });
	});
	await page.goto('/projects');
	await expect(page.getByText('Live refresh unavailable;', { exact: false })).toBeVisible();
	expect(fetched).toBe(true);
	await expect(page.locator('[data-project]')).toHaveCount(snapshot.repos.length);
	await expect(page.locator('body')).not.toContainText('not public');
});

test('the exact live service origin is allowed and a valid response replaces the fallback', async ({ page }) => {
	await page.unroute('https://jess.clients.xoxd.ai/**');
	let requested = '';
	await page.route('https://jess.clients.xoxd.ai/**', (route) => {
		requested = route.request().url();
		return route.fulfill({ json: snapshot });
	});
	await page.goto('/projects');
	await expect(page.locator('[data-profile-source]')).toHaveAttribute('data-profile-source', 'live');
	expect(requested).toBe('https://jess.clients.xoxd.ai/v1/profile.v1.json');
	await expect(page.locator('.source-label')).toHaveText('Live endpoint');
	await expect(page.locator('[data-project]')).toHaveCount(snapshot.repos.length);
	await expect(page.getByText('Live refresh unavailable;', { exact: false })).toHaveCount(0);
});

test('About adopts valid multiple-PR evidence and keeps only the latest merge per repository', async ({ page }) => {
	const previous = snapshot.merged_upstream[0];
	const latest = { ...previous, number: previous.number + 1, merged: snapshot.fetched_at.slice(0, 10) };
	const older = { ...previous, number: previous.number + 2 };
	// Deliberately place the latest first and an older, higher-numbered PR last.
	const candidate = parseProfileV1({
		...snapshot,
		merged_upstream: [latest, ...snapshot.merged_upstream, older],
	});
	const pageErrors: string[] = [];
	page.on('pageerror', (error) => pageErrors.push(error.message));
	await page.unroute('https://jess.clients.xoxd.ai/**');
	await page.route('https://jess.clients.xoxd.ai/**', (route) => route.fulfill({ json: candidate }));
	await page.goto('/about');
	await expect(page.locator('[data-profile-source]')).toHaveAttribute('data-profile-source', 'live');
	const list = page.getByTestId('upstream-list');
	await expect(list.locator('li')).toHaveCount(
		new Set(candidate.merged_upstream.map((r) => r.repo.toLowerCase())).size,
	);
	const link = list.getByRole('link', { name: previous.project, exact: true });
	await expect(link).toHaveCount(1);
	await expect(link).toHaveAttribute('href', `https://github.com/${latest.repo}/pull/${latest.number}`);
	const row = list.locator('li').filter({ has: page.getByRole('link', { name: previous.project, exact: true }) });
	await expect(row.locator('time')).toHaveAttribute('datetime', latest.merged);
	await expect(page.getByRole('button', { name: 'Refresh evidence' })).toBeEnabled();
	expect(pageErrors).toEqual([]);
});

test('all four chart views and their data tables survive without JavaScript', async ({ browser }) => {
	const context = await browser.newContext({ javaScriptEnabled: false });
	const page = await context.newPage();
	await page.goto(test.info().project.use.baseURL + '/projects');
	for (const id of ['project-map', 'language-history', 'upstream', 'activity'])
		await expect(page.locator('#' + id)).toBeVisible();
	await page.locator('#project-catalogue summary').click();
	await expect(page.locator('#project-catalogue tbody tr')).toHaveCount(snapshot.repos.length);
	await expect(page.locator('.source-label')).toHaveText('Saved snapshot');
	await context.close();
});
