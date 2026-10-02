#!/usr/bin/env node
// Read-only browser acceptance for an independently deployed R producer and
// exact static review-shadow consumer. Never run this against production.
// Set EXPECTED_SHADOW_CONSUMER_SHA to the applied spoke commit and
// SHADOW_PRODUCER_RECEIPT_PATH to an operator-custodied JSON file like:
// {"sourceSha":"<deployed producer commit>","brokerContentHash":"sha256:<live output hash>",
//  "receiptUrl":"https://<independent rollout evidence>"}
// The probe checks the served broker hash, not the authenticity of that
// independently supplied source/deployment receipt. Keep the receipt out of git.
// From a runner with access to the private shadow route, invoke the repo recipe
// `npm run test:shadow-reader-pair` with both environment variables set.
import { existsSync, readFileSync } from 'node:fs';
import { chromium } from '@playwright/test';
import {
	SHADOW_ORIGIN,
	BLOG_BROKER_URL,
	PULSE_BROKER_URL,
	articleHref,
	assertShadowNavigationUrl,
	parseShadowPairInputs,
	findBrokerOnlySlugs,
	findPulseMedia,
	isRedirectResponse,
	shadowRequestDecision,
	staticRouteSlugs,
	validateBrokerEvidence,
} from './shadow-reader-pair-contract.mjs';

const receiptPath = process.env.SHADOW_PRODUCER_RECEIPT_PATH;
if (!receiptPath) {
	console.error('SHADOW_PRODUCER_RECEIPT_PATH is required; no producer identity can be inferred from the broker');
	process.exit(1);
}

let browser;
try {
	const evidence = parseShadowPairInputs(process.env, readFileSync(receiptPath, 'utf8'));
	const executablePath = [
		process.env.GF_RBE_CHROMIUM_EXECUTABLE,
		process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,
		process.env.CHROME_BIN,
		'/bin/chromium',
		'/usr/bin/chromium',
		'/usr/bin/chromium-browser',
		'/usr/bin/google-chrome',
		'/usr/bin/google-chrome-stable',
	].find((path) => path && existsSync(path));
	browser = await chromium.launch({
		...(executablePath ? { executablePath } : {}),
		headless: true,
		args: ['--disable-dev-shm-usage', '--no-sandbox'],
	});
	const blockedRequests = [];
	const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, serviceWorkers: 'block' });
	await confineBrowser(context, blockedRequests);
	context.setDefaultTimeout(20_000);
	const page = await context.newPage();
	const pageErrors = [];
	page.on('pageerror', (error) => pageErrors.push(error.message));

	const homeBlogResponse = page.waitForResponse((response) => response.url() === BLOG_BROKER_URL);
	const homePulseResponse = page.waitForResponse((response) => response.url() === PULSE_BROKER_URL);
	await requireHttp200(page, page.goto(`${SHADOW_ORIGIN}/`, { waitUntil: 'domcontentloaded', timeout: 30_000 }), '/');
	await requireShadowStamp(page, evidence.consumerSourceSha);
	await requireState(page, 'home-reader-broker-state', 'Blog ready; Pulse ready.');
	const brokerPosts = validateBrokerEvidence(await requireJson(homeBlogResponse, 'home blog broker'), evidence.brokerContentHash);
	const brokerSlugs = brokerPosts.map((post) => post.slug);
	const pulseSnapshot = await requireJson(homePulseResponse, 'home Pulse broker');
	const media = findPulseMedia(pulseSnapshot);
	await page.locator('#latest a[href^="/blog/"]').first().waitFor({ state: 'visible' });
	await page.locator('#pulse').waitFor({ state: 'visible' });
	await page.locator('.constellation a[href="#latest"]').waitFor({ state: 'visible' });
	let mediaCoverage = 'unexercised: no reviewed public lead image';
	if (pulseSnapshot.items.length > 0) {
		await page.locator('#pulse ol li').first().waitFor({ state: 'visible' });
		const firstItem = pulseSnapshot.items[0];
		const itemText = firstItem.kind === 'note'
			? firstItem.content
			: (firstItem.birdSighting?.commonName || firstItem.birdSighting?.scientificName);
		if (typeof itemText !== 'string' || !itemText.trim() ||
			!(await page.locator('#pulse').innerText()).includes(itemText)) {
			throw new Error('live Pulse item text is absent from the hydrated homepage');
		}
	} else {
		await page.locator('#pulse').getByText('No public events yet.').waitFor({ state: 'visible' });
		mediaCoverage = 'unexercised: public Pulse snapshot is empty';
	}
	if (media) {
		const mediaImage = page.locator('#pulse').getByRole('img', { name: media.alt }).first();
		await mediaImage.scrollIntoViewIfNeeded();
		await mediaImage.waitFor({ state: 'visible' });
		if ((await mediaImage.getAttribute('src')) !== media.url) {
			throw new Error('Pulse image source does not match the reviewed broker preview URL');
		}
		await page.waitForFunction(
			(url) => [...document.querySelectorAll('#pulse img')].some((img) => img.src === url && img.complete && img.naturalWidth > 0),
			media.url,
		);
		if (media.text && !(await page.locator('#pulse').innerText()).includes(media.text)) {
			throw new Error('reviewed Pulse media item text is not visible on the homepage');
		}
		mediaCoverage = 'exercised: reviewed preview decoded';
	}

	const staticIndexUrl = `${SHADOW_ORIGIN}/search-index.json`;
	const staticIndexResponse = await context.request.get(staticIndexUrl, { maxRedirects: 0 });
	if (staticIndexResponse.status() !== 200 || staticIndexResponse.url() !== staticIndexUrl) {
		throw new Error('shadow static search index is unavailable or redirected');
	}
	const staticIndex = await staticIndexResponse.json();
	const routeSlugs = staticRouteSlugs(staticIndex);
	const homeLinks = await page.locator('#latest a[href^="/blog/"]').evaluateAll((links) =>
		links.map((link) => link.getAttribute('href')),
	);
	const homeBrokerSlug = brokerSlugs.find((slug) => homeLinks.includes(`/blog/${slug}`));
	if (!homeBrokerSlug) throw new Error('no broker-listed static article link is visible; homepage link case is unqualified');
	const homeStaticTitle = staticIndex.find((entry) => entry.slug === homeBrokerSlug)?.title;
	if (typeof homeStaticTitle !== 'string' || !homeStaticTitle.trim()) throw new Error('homepage article lacks a static title');
	await requireArticleNavigation(page, articleHref(`/blog/${homeBrokerSlug}`, homeBrokerSlug), evidence.consumerSourceSha, homeStaticTitle);
	console.log(`PASS shadow homepage core: exact consumer stamp, loaded broker/Pulse, routeable broker-listed static post ${homeBrokerSlug}`);
	console.log(`COVERAGE shadow Pulse media: ${mediaCoverage}`);

	const blogPage = await context.newPage();
	blogPage.on('pageerror', (error) => pageErrors.push(error.message));
	const listingBrokerResponse = blogPage.waitForResponse((response) => response.url() === BLOG_BROKER_URL);
	await requireHttp200(blogPage, blogPage.goto(`${SHADOW_ORIGIN}/blog`, { waitUntil: 'domcontentloaded', timeout: 30_000 }), '/blog');
	await requireShadowStamp(blogPage, evidence.consumerSourceSha);
	await requireState(blogPage, 'tinyland-blog-broker-state', 'Tinyland broker stream loaded.');
	validateBrokerEvidence(await requireJson(listingBrokerResponse, 'blog listing broker'), evidence.brokerContentHash);
	const brokerOnlySlugs = findBrokerOnlySlugs(brokerSlugs, routeSlugs);
	let brokerOnlyCoverage = 'unexercised: no broker-only slug in this producer corpus';
	let brokerOnlyHref = null;
	const estimatedPages = Math.ceil((routeSlugs.size + brokerSlugs.length) / 20);
	const maxPages = Math.min(10, estimatedPages);
	for (let pageNumber = 1; pageNumber <= maxPages && brokerOnlySlugs.length > 0 && !brokerOnlyHref; pageNumber++) {
		if (pageNumber > 1) {
			await requireHttp200(
				blogPage,
				blogPage.goto(`${SHADOW_ORIGIN}/blog?page=${pageNumber}`, { waitUntil: 'domcontentloaded', timeout: 30_000 }),
				'/blog',
				`?page=${pageNumber}`,
			);
			await requireState(blogPage, 'tinyland-blog-broker-state', 'Tinyland broker stream loaded.');
		}
		for (const slug of brokerOnlySlugs) {
			const link = blogPage.locator(`a[href="/blog/${slug}"]`).first();
			if (await link.count()) {
				brokerOnlyHref = articleHref(await link.getAttribute('href'), slug);
				break;
			}
		}
	}
	if (brokerOnlySlugs.length > 0 && !brokerOnlyHref) {
		brokerOnlyCoverage = `unexercised: no visible broker-only link in the first ${maxPages} hydrated blog pages (held, unlisted, or outside the bounded scan)`;
	}
	if (brokerOnlyHref) {
		const brokerOnlySlug = new URL(brokerOnlyHref).pathname.slice('/blog/'.length);
		const brokerOnlyPost = brokerPosts.find((post) => post.slug === brokerOnlySlug);
		if (!brokerOnlyPost) throw new Error('selected broker-only link lacks a matching broker post');
		const articleResponses = [];
		blogPage.on('response', (response) => {
			if (response.url() === BLOG_BROKER_URL) articleResponses.push(response);
		});
		await requireArticleNavigation(blogPage, brokerOnlyHref, evidence.consumerSourceSha, brokerOnlyPost.title, true);
		const articlePosts = validateBrokerEvidence(
			await requireJson(Promise.resolve(articleResponses.at(-1)), 'broker-only article broker'),
			evidence.brokerContentHash,
		);
		const articlePost = articlePosts.find((post) => post.slug === brokerOnlySlug);
		if (!articlePost || articlePost.title !== brokerOnlyPost.title ||
			articlePost.contentHash !== brokerOnlyPost.contentHash) {
			throw new Error('broker-only article response does not match the selected broker post');
		}
		await requireReadableBody(blogPage);
		brokerOnlyCoverage = `exercised: ${new URL(brokerOnlyHref).pathname} returned 200 and loaded matching broker body`;
	}
	console.log(`COVERAGE shadow broker-only article: ${brokerOnlyCoverage}`);

	const noJsContext = await browser.newContext({ javaScriptEnabled: false, serviceWorkers: 'block' });
	await confineBrowser(noJsContext, blockedRequests);
	const noJsPage = await noJsContext.newPage();
	await requireHttp200(noJsPage, noJsPage.goto(`${SHADOW_ORIGIN}/`, { waitUntil: 'domcontentloaded', timeout: 30_000 }), '/');
	await requireShadowStamp(noJsPage, evidence.consumerSourceSha);
	await noJsPage.locator('#latest a[href^="/blog/"]').first().waitFor({ state: 'visible' });
	await noJsPage.locator('#pulse').waitFor({ state: 'visible' });
	await noJsPage.locator('.constellation a[href="#latest"]').waitFor({ state: 'visible' });
	const staticHref = await noJsPage.locator('#latest a[href^="/blog/"]').first().getAttribute('href');
	const staticSlug = new URL(staticHref, SHADOW_ORIGIN).pathname.slice('/blog/'.length);
	if (!routeSlugs.has(staticSlug)) throw new Error('no-JS homepage points outside the prerendered static route set');
	const staticTitle = staticIndex.find((entry) => entry.slug === staticSlug)?.title;
	if (typeof staticTitle !== 'string' || !staticTitle.trim()) throw new Error('no-JS article lacks a static title');
	await requireArticleNavigation(noJsPage, articleHref(staticHref, staticSlug), evidence.consumerSourceSha, staticTitle);
	await requireHttp200(noJsPage, noJsPage.goto(`${SHADOW_ORIGIN}/blog`, { waitUntil: 'domcontentloaded', timeout: 30_000 }), '/blog');
	await noJsPage.locator('a[href^="/blog/"]').first().waitFor({ state: 'visible' });
	console.log('PASS shadow no-JS: readable homepage, static article, and blog list');

	if (pageErrors.length) throw new Error(`browser page errors: ${pageErrors.slice(0, 3).join(' | ')}`);
	console.log(`COVERAGE shadow network confinement: ${blockedRequests.length} disallowed or redirected requests blocked`);
	console.log(
		`PASS shadow reader pair core: consumer ${evidence.consumerSourceSha}; producer receipt ${evidence.producerSourceSha} ${evidence.receiptUrl}; broker ${evidence.brokerContentHash}; media ${mediaCoverage}; broker-only ${brokerOnlyCoverage}`,
	);
} catch (error) {
	console.error(`FAIL shadow reader pair: ${error instanceof Error ? error.message : String(error)}`);
	process.exitCode = 1;
} finally {
	await browser?.close();
}

async function confineBrowser(context, blockedRequests) {
	await context.route('**/*', async (route) => {
		const request = route.request();
		const decision = shadowRequestDecision(request.url(), request.method());
		if (decision.allowed) {
			// Playwright does not re-run a route handler for a followed redirect.
			// Fetch one hop only, then fulfill it without allowing transport escape.
			let response;
			try {
				response = await route.fetch({ maxRedirects: 0, timeout: 30_000 });
			} catch {
				const url = new URL(request.url());
				blockedRequests.push(`transport failed for ${url.origin}${url.pathname}`);
				await route.abort('failed');
				return;
			}
			if (isRedirectResponse(response.status(), response.headers().location)) {
				const url = new URL(request.url());
				blockedRequests.push(`redirect from ${url.origin}${url.pathname}`);
				await route.abort('blockedbyclient');
				return;
			}
			await route.fulfill({ response });
			return;
		}
		const url = new URL(request.url());
		blockedRequests.push(`${request.method()} ${url.origin}${url.pathname}: ${decision.reason}`);
		await route.abort('blockedbyclient');
	});
}

async function requireHttp200(page, navigation, expectedPath, expectedSearch = '') {
	const response = await navigation;
	if (!response || response.status() !== 200) {
		throw new Error(`${expectedPath} navigation returned HTTP ${response?.status() ?? 'no response'}, not 200`);
	}
	assertShadowNavigationUrl(page.url(), expectedPath, expectedSearch);
}

async function requireJson(responsePromise, label) {
	const response = await responsePromise;
	if (!response || response.status() !== 200) throw new Error(`${label} returned HTTP ${response?.status() ?? 'no response'}`);
	try {
		return await response.json();
	} catch {
		throw new Error(`${label} did not return JSON`);
	}
}

async function requireShadowStamp(page, expectedSha) {
	const stamp = page.locator('meta[name="tinyland-source-sha"][data-deploy-tier="shadow"]');
	if ((await stamp.getAttribute('content')) !== expectedSha) throw new Error('shadow consumer source SHA stamp mismatch');
	const robots = await page.locator('meta[name="robots"][data-deploy-tier="shadow"]').getAttribute('content');
	if (!robots?.includes('noindex') || !robots.includes('nofollow')) {
		throw new Error('shadow noindex,nofollow stamp is missing');
	}
}

async function requireState(page, testId, expected) {
	await page.waitForFunction(
		({ testId, expected }) => document.querySelector(`[data-testid="${testId}"]`)?.textContent?.includes(expected) === true,
		{ testId, expected },
		{ timeout: 20_000 },
	);
}

async function requireReadableBody(page) {
	const body = (await page.locator('[data-document-root]').innerText()).trim();
	if (!/[\p{L}\p{N}]/u.test(body) || /^(?:Loading post\.|Post unavailable\.)$/i.test(body)) {
		throw new Error('article document root has no readable body');
	}
}

async function requireArticleNavigation(page, href, expectedSha, expectedTitle, brokerOnly = false) {
	await requireHttp200(page, page.goto(href, { waitUntil: 'domcontentloaded', timeout: 30_000 }), new URL(href).pathname);
	await requireShadowStamp(page, expectedSha);
	if (brokerOnly) await requireState(page, 'tinyland-blog-post-broker-state', 'Tinyland broker post loaded.');
	await page.locator('[data-document-root]').waitFor({ state: 'visible' });
	const actualTitle = (await page.locator('article h1').innerText()).replace(/\s+/g, ' ').trim();
	if (actualTitle !== expectedTitle.replace(/\s+/g, ' ').trim()) {
		throw new Error('article title does not match the selected route identity');
	}
	await requireReadableBody(page);
}
