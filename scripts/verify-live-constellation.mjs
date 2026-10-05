// Read-only public proof, separate from the frozen qualified application source.
import { createRequire } from 'node:module';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';

const [packageRoot, artifactRoot, evidenceRoot] = process.argv.slice(2);
if (![packageRoot, artifactRoot, evidenceRoot].every(p => p?.startsWith('/'))) throw Error('Explicit absolute owned paths required');
const { chromium } = createRequire(join(packageRoot, 'package.json'))(packageRoot);
const browserPath = '/nix/store/7xr3qnq93srn4dgak7qw74dw836wpp1y-chromium-138.0.7204.49/bin/chromium';
const origin = 'https://transscendsurvival.org';
const brokerUrls = [
	'https://hub.tinyland.dev/projections/jesssullivan-github-io/blog/broker-stream.v1.json',
	'https://hub.tinyland.dev/projections/jesssullivan-github-io/pulse/public-snapshot.v2.json',
];
const manifest = JSON.parse(readFileSync(join(artifactRoot, 'artifact.json')));
assert.equal(manifest.sourceSha, '0ed227cc651746e55b23e6451111469172ed8342');
const expected = new Map(manifest.files.map(f => [f.path, f.sha256]));
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const requests = [], brokerResponses = [], assets = [], pending = [];
const receiptPath = join(evidenceRoot, 'live-browser.json');
assert.equal(existsSync(receiptPath), false);
const browser = await chromium.launch({ executablePath: browserPath, headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu'] });
async function context(javaScriptEnabled = true) {
	const ctx = await browser.newContext({ javaScriptEnabled, viewport: { width: 1280, height: 900 } });
	await ctx.route('**/*', async route => {
		const req = route.request(), url = new URL(req.url());
		if (!['GET', 'HEAD'].includes(req.method()) || url.username || url.password || req.headers().authorization || !(url.origin === origin || brokerUrls.includes(url.href))) return route.abort();
		if (brokerUrls.includes(url.href)) requests.push(url.href);
		const response = await route.fetch({ maxRedirects: 0 });
		if (response.status() >= 300 && response.status() < 400) return route.abort();
		if (brokerUrls.includes(url.href)) brokerResponses.push({ url: url.href, status: response.status() });
		const relative = decodeURIComponent(url.pathname.slice(1));
		if (relative.startsWith('_app/') && expected.has(relative)) pending.push(response.body().then(body => {
			const digest = hash(body); assert.equal(digest, expected.get(relative), `Served asset differs: ${relative}`);
			assets.push({ path: relative, sha256: digest });
		}));
		await route.fulfill({ response });
	});
	return ctx;
}
try {
	const ctx = await context(), page = await ctx.newPage();
	await page.goto(origin, { waitUntil: 'networkidle' });
	assert.equal(await page.locator('#latest').isVisible(), true);
	assert.equal(await page.locator('.constellation').count(), 0);
	assert.equal(requests.length, 0);
	await page.evaluate(() => { const a = document.createElement('a'); a.id = 'flag-proof-nav'; a.href = '/?flags=constellation'; a.textContent = 'Flag proof'; document.body.append(a); window.flagProofSentinel = 'same-document'; });
	await page.locator('#flag-proof-nav').click();
	await page.locator('.constellation').waitFor({ state: 'visible' });
	await page.waitForFunction(() => { const text = document.querySelector('[data-testid="home-reader-broker-state"]')?.textContent || ''; return !text.includes('loading') && text.includes('Pulse'); }, { timeout: 20000 });
	const projectionState = await page.getByTestId('home-reader-broker-state').innerText();
	await page.getByRole('button', { name: 'Year tree', exact: true }).click();
	await page.locator('.year-tree summary').first().click();
	assert.equal(await page.locator('.year-tree a[href^="/blog/"]').first().isVisible(), true);
	await page.screenshot({ path: join(evidenceRoot, 'live-flag-on.png'), fullPage: true });
	await page.evaluate(() => { document.querySelector('#flag-proof-nav').href = '/?flags=none'; });
	const beforeOff = requests.length;
	await page.locator('#flag-proof-nav').click();
	await page.locator('.constellation').waitFor({ state: 'detached' });
	assert.equal(await page.evaluate(() => window.flagProofSentinel), 'same-document');
	assert.equal(await page.evaluate(() => localStorage.getItem('tss:flags:constellation')), null);
	assert.equal(requests.length, beforeOff);
	await page.goto(origin, { waitUntil: 'networkidle' });
	assert.equal(await page.locator('.constellation').count(), 0);
	await page.screenshot({ path: join(evidenceRoot, 'live-default-off.png'), fullPage: true });
	await ctx.close();
	const nojs = await context(false), plain = await nojs.newPage();
	await plain.goto(`${origin}/?flags=constellation`);
	assert.equal(await plain.locator('#latest').isVisible(), true);
	assert.equal(await plain.locator('.constellation').count(), 0);
	await nojs.close();
	await Promise.all(pending);
	assert.ok(assets.length > 0);
	const receipt = { sourceSha: manifest.sourceSha, checkedAt: new Date().toISOString(), browserPath, nodeVersion: process.version, playwrightVersion: JSON.parse(readFileSync(join(packageRoot, 'package.json'))).version,
		defaultOff: true, sameDocumentOnOff: true, preferenceCleared: true, noOffBrokerRequests: true, reloadOff: true, noJsOff: true, projectionState, brokerResponses, servedAssets: [...new Map(assets.map(a => [a.path, a])).values()] };
	writeFileSync(receiptPath, JSON.stringify(receipt, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
	console.log(JSON.stringify(receipt));
} finally { await browser.close(); }
