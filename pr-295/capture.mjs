// Acceptance capture for blog #295 (TIN-5680). Usage: node capture.mjs <baseURL> <outDir>
import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync } from 'node:fs';
const require = createRequire('/Users/jess/git/jesssullivan.github.io.worktrees/S1-tsne-20261006/package.json');
const { chromium } = require('playwright');

const BASE = process.argv[2] ?? 'http://127.0.0.1:4317';
const OUT = process.argv[3] ?? './shots';
mkdirSync(OUT, { recursive: true });
const EXE = process.env.HOME + '/Library/Caches/ms-playwright/chromium_headless_shell-1234/chrome-headless-shell-mac-arm64/chrome-headless-shell';

const VIEWPORTS = {
	desktop: { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 },
	phone: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
};
const report = { base: BASE, at: new Date().toISOString(), viewports: {} };
const browser = await chromium.launch(process.env.CHANNEL ? { channel: process.env.CHANNEL } : { executablePath: EXE });

async function settle(page) {
	await page.waitForLoadState('networkidle').catch(() => {});
	await page.waitForTimeout(400);
}
const describe = (page) => page.evaluate(() => {
	const el = document.activeElement;
	if (!el) return null;
	const name = el.getAttribute('aria-label') || (el.id && document.querySelector(`label[for="${el.id}"]`)?.textContent) || el.textContent?.trim().slice(0, 60) || '';
	return `${el.tagName.toLowerCase()}${el.getAttribute('data-slug') ? '[node]' : ''}: ${name.trim()}`;
});

for (const [vp, opts] of Object.entries(VIEWPORTS)) {
	const r = (report.viewports[vp] = {});
	const shot = (page, name, o = {}) => page.screenshot({ path: `${OUT}/${vp}-${name}.png`, ...o });

	// 1. Default view in a fresh profile: the flag must be off.
	{
		const ctx = await browser.newContext({ ...opts, reducedMotion: 'no-preference' });
		const page = await ctx.newPage();
		await page.goto(BASE + '/');
		await settle(page);
		r.defaultOff = {
			constellationCount: await page.locator('.constellation').count(),
			projectionCount: await page.getByTestId('posts-projection').count(),
			storage: await page.evaluate(() => localStorage.getItem('tss:flags:constellation')),
			latestVisible: await page.locator('#latest').isVisible(),
		};
		await shot(page, '01-default-flag-off');
		await ctx.close();
	}

	const ctx = await browser.newContext({ ...opts, reducedMotion: 'no-preference' });
	const page = await ctx.newPage();
	const errors = [];
	page.on('pageerror', (e) => errors.push(String(e)));
	page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
	await page.goto(BASE + '/?flags=constellation');
	await page.locator('.constellation').waitFor();
	await settle(page);
	await page.locator('.constellation').scrollIntoViewIfNeeded();
	await page.evaluate(() => document.querySelector('.constellation').scrollIntoView({ block: 'start' }));
	await page.waitForTimeout(300);
	await shot(page, '02-flag-on-initial');
	r.motion = await page.evaluate(() => getComputedStyle(document.querySelector('.constellation-node') ?? document.body).animationName);

	// 2. Similarity map.
	const t0 = Date.now();
	await page.getByRole('button', { name: 'Similarity map' }).click();
	await page.locator('svg.projection-map').waitFor();
	r.mapSwitchMs = Date.now() - t0;
	r.nodes = await page.locator('svg.projection-map a[data-slug]').count();
	r.edges = await page.locator('svg.projection-map .projection-edges line').count();
	r.note = await page.locator('.projection-note').innerText();
	await page.evaluate(() => document.querySelector('.projection').scrollIntoView({ block: 'start' }));
	await page.waitForTimeout(200);
	await shot(page, '03-map-initial');

	// Hit target sizes (CSS px) of the map nodes.
	r.hitTargets = await page.evaluate(() => {
		const sizes = [...document.querySelectorAll('svg.projection-map .hit')].map((c) => c.getBoundingClientRect().width);
		return { min: Math.min(...sizes), max: Math.max(...sizes) };
	});

	// 3. Densest cluster: most nodes within 70 viewBox units.
	const cluster = await page.evaluate(() => {
		const pts = [...document.querySelectorAll('svg.projection-map a[data-slug]')].map((a) => {
			const c = a.querySelector('.dot');
			return { slug: a.dataset.slug, label: a.getAttribute('aria-label'), x: +c.getAttribute('cx'), y: +c.getAttribute('cy'), index: +a.dataset.nodeIndex };
		});
		let best = null;
		for (const p of pts) {
			const near = pts.filter((q) => Math.hypot(p.x - q.x, p.y - q.y) <= 70);
			if (!best || near.length > best.near.length) best = { p, near };
		}
		return { center: best.p, members: best.near.map((n) => n.label), indices: best.near.map((n) => n.index) };
	});
	r.cluster = { center: cluster.center.label, members: cluster.members };

	// 4. Hover (desktop pointer) or tap-free pointer move (phone) on the cluster centre.
	const centre = page.locator(`svg.projection-map a[data-node-index="${cluster.center.index}"] .dot`);
	await centre.hover({ force: true });
	await page.waitForTimeout(250);
	r.hoverDetail = await page.getByTestId('posts-projection-detail').innerText();
	await page.evaluate(() => document.querySelector('.projection').scrollIntoView({ block: 'start' }));
	await page.waitForTimeout(150);
	await page.locator('.projection').screenshot({ path: `${OUT}/${vp}-05-post-hovered.png` });

	// Cluster crop: re-render the SVG viewBox around the cluster (capture only; the map has no zoom control).
	await page.evaluate(({ x, y }) => {
		const svg = document.querySelector('svg.projection-map');
		svg.dataset.origViewbox = svg.getAttribute('viewBox');
		svg.setAttribute('viewBox', `${Math.max(0, x - 160)} ${Math.max(0, y - 160)} 320 320`);
	}, cluster.center);
	await page.waitForTimeout(150);
	await page.locator('svg.projection-map').screenshot({ path: `${OUT}/${vp}-04-cluster-zoomed.png` });
	await page.evaluate(() => {
		const svg = document.querySelector('svg.projection-map');
		svg.setAttribute('viewBox', svg.dataset.origViewbox);
	});
	await page.mouse.move(2, 2);
	await page.waitForTimeout(150);

	// 5. Keyboard: focus order from the Similarity map button, then arrow walk.
	await page.getByRole('button', { name: 'Similarity map' }).focus();
	const order = [await describe(page)];
	for (let i = 0; i < 10; i++) {
		await page.keyboard.press('Tab');
		const d = await describe(page);
		order.push(d);
		if (d?.includes('[node]')) break;
	}
	r.focusOrder = order;
	const walk = [];
	for (const key of ['ArrowRight', 'ArrowRight', 'ArrowDown']) {
		await page.keyboard.press(key);
		await page.waitForTimeout(80);
		walk.push(`${key} -> ${await describe(page)}`);
	}
	r.arrowWalk = walk;
	r.tabStopsInMap = await page.locator('svg.projection-map a[tabindex="0"]').count();
	r.keyboardDetail = await page.getByTestId('posts-projection-detail').innerText();
	r.focusRing = await page.evaluate(() => {
		const hit = document.activeElement?.querySelector('.hit');
		return hit ? { stroke: getComputedStyle(hit).stroke, width: getComputedStyle(hit).strokeWidth } : null;
	});
	await page.evaluate(() => document.querySelector('.projection').scrollIntoView({ block: 'start' }));
	await page.waitForTimeout(150);
	await page.locator('.projection').screenshot({ path: `${OUT}/${vp}-06-keyboard-focus.png` });
	await page.keyboard.press('Escape');
	await page.waitForTimeout(100);
	r.afterEscape = await page.getByTestId('posts-projection-detail').innerText();

	// 6. Similar posts list.
	await page.getByRole('button', { name: 'Similar posts' }).click();
	await page.locator('.similar-list').waitFor();
	r.listItems = await page.locator('.similar-list > li').count();
	await page.evaluate(() => document.querySelector('.projection').scrollIntoView({ block: 'start' }));
	await page.waitForTimeout(150);
	await shot(page, '07-similar-list');

	// Accessible names on every interactive element in the section.
	r.unnamed = await page.evaluate(() => {
		const out = [];
		for (const el of document.querySelectorAll('.constellation a, .constellation button, .constellation input, .constellation summary')) {
			const name = el.getAttribute('aria-label') || el.textContent?.trim() || (el.id && document.querySelector(`label[for="${el.id}"]`)?.textContent?.trim());
			if (!name) out.push(el.outerHTML.slice(0, 120));
		}
		return out;
	});
	r.consoleErrors = errors;
	await ctx.close();

	// 7. Reduced motion.
	{
		const rc = await browser.newContext({ ...opts, reducedMotion: 'reduce' });
		const p = await rc.newPage();
		await p.goto(BASE + '/?flags=constellation');
		await p.locator('.constellation-node').first().waitFor();
		r.reducedMotion = await p.evaluate(() => ({
			nodeAnimation: getComputedStyle(document.querySelector('.constellation-node')).animationName,
			linkTransition: getComputedStyle(document.querySelector('.constellation-node a')).transitionDuration,
		}));
		await rc.close();
	}
}

// 8. Frame rate on the phone viewport with 4x CPU throttle.
{
	const ctx = await browser.newContext({ ...VIEWPORTS.phone, reducedMotion: 'no-preference' });
	const page = await ctx.newPage();
	const cdp = await ctx.newCDPSession(page);
	await page.goto(BASE + '/?flags=constellation');
	await page.locator('.constellation').waitFor();
	await settle(page);
	await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
	const startMeter = () => page.evaluate(() => {
		window.__frames = [];
		let last = performance.now();
		const tick = (t) => { window.__frames.push(t - last); last = t; if (!window.__stop) requestAnimationFrame(tick); };
		window.__stop = false;
		requestAnimationFrame(tick);
	});
	const stopMeter = () => page.evaluate(() => {
		window.__stop = true;
		const f = window.__frames.slice(1);
		const total = f.reduce((a, b) => a + b, 0);
		const sorted = [...f].sort((a, b) => a - b);
		return { frames: f.length, fps: +(f.length / (total / 1000)).toFixed(1), p95ms: +sorted[Math.floor(sorted.length * 0.95)]?.toFixed(1), maxms: +Math.max(...f).toFixed(1), over50ms: f.filter((x) => x > 50).length };
	});
	const fps = {};
	await startMeter();
	const t0 = Date.now();
	await page.getByRole('button', { name: 'Similarity map' }).click();
	await page.locator('svg.projection-map').waitFor();
	fps.mapSwitchMsThrottled = Date.now() - t0;
	await page.waitForTimeout(500);
	fps.switchWindow = await stopMeter();
	await page.evaluate(() => document.querySelector('.projection').scrollIntoView({ block: 'start' }));
	await startMeter();
	await page.waitForTimeout(2000);
	fps.idleMap = await stopMeter();
	// Pointer sweep across the map (hover state churn).
	const box = await page.locator('svg.projection-map').boundingBox();
	await startMeter();
	for (let i = 0; i <= 60; i++) await page.mouse.move(box.x + (box.width * i) / 60, box.y + box.height * (0.2 + 0.6 * ((i % 10) / 10)));
	fps.pointerSweep = await stopMeter();
	// Keyboard walk.
	await page.locator('svg.projection-map a[tabindex="0"]').focus();
	await startMeter();
	for (let i = 0; i < 30; i++) await page.keyboard.press(['ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowUp'][i % 4]);
	await page.waitForTimeout(200);
	fps.keyboardWalk = await stopMeter();
	// Scroll through the map and list.
	await page.getByRole('button', { name: 'Similar posts' }).click();
	await startMeter();
	for (let i = 0; i < 20; i++) { await page.mouse.wheel(0, 400); await page.waitForTimeout(50); }
	fps.listScroll = await stopMeter();
	report.phoneFrameRate4xCpu = fps;
	await ctx.close();
}

await browser.close();
writeFileSync(`${OUT}/report.json`, JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
