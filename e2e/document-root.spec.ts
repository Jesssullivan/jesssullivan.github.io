import { test, expect, type BrowserContext } from '@playwright/test';
import { reviewedLeadImageSnapshot } from '../src/lib/pulse/fixtures/reviewedLeadImageSnapshot';

const endpoint = 'https://hub.tinyland.dev/projections/jesssullivan-github-io/blog/broker-stream.v1.json';
const pulseEndpoint = 'https://hub.tinyland.dev/projections/jesssullivan-github-io/pulse/public-snapshot.v2.json';
const reviewedPreviewUrl = 'https://hub.tinyland.dev/media/pulse/jesssullivan/notes/reviewed-lead-image.preview.webp';
// Opaque red 1x1 PNG, generated with a stored zlib block and valid PNG chunk CRCs.
const tinyPng = Buffer.from(
	'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAEElEQVR4AQEFAPr/AP8AAP8FAAH/+lyI0QAAAABJRU5ErkJggg==',
	'base64',
);
const brokerSlug = 'brokered-document-root-test';

const brokerStream = {
	schemaVersion: 'tinyland.blog.broker-stream.v1',
	generatedAt: '2026-09-22T12:00:00.000Z',
	sourceAuthority: 'tinyland.dev',
	contentAuthority: 'tinyland.dev',
	spokeRef: 'jesssullivan-github-io',
	spokeTarget: 'transscendsurvival.org',
	routePath: '/projections/jesssullivan-github-io/blog/broker-stream.v1.json',
	publicUrl: endpoint,
	brokerOrigin: 'https://hub.tinyland.dev',
	streamStatus: 'dynamic-hub-managed-greymatter',
	managementStatus: 'hub-managed-greymatter',
	runtimeBrokerFetch: true,
	publicFediverseDelivery: false,
	activityPubStatus: 'broker-display-stream-not-public-fediverse-delivery',
	contentHash: 'sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
	counts: {
		totalManagedPosts: 1,
		publicPublishedManagedPosts: 1,
		publicPublishedDisplayPosts: 1,
		displayHeldBackPosts: 0,
		draftOrUnpublishedManagedPosts: 0,
		projectionTombstones: 0,
	},
	consumerContract: {
		mode: 'cf-pages-runtime-broker-fetch',
		mutationAuthority: 'tinyland.dev',
		contentAuthority: 'tinyland.dev',
		checkedInPostPayloads: false,
		spokeMutationApi: false,
		spokeActivityPubWorker: false,
	},
	policy: {
		projectionPolicy: 'publicPublishedManagedPosts-display-stream',
		displayMembershipPolicy: 'public-published-display-membership',
		contentTransport: 'dynamic-broker-stream',
		contentMarkdownIncluded: true,
		draftContentIncluded: false,
		displayMembershipGate: 'frontmatter-published-status-visibility',
		publicFediverseDelivery: false,
	},
	posts: [
		{
			type: 'Article',
			id: `https://hub.tinyland.dev/projections/jesssullivan-github-io/ap/objects/post/${brokerSlug}`,
			slug: brokerSlug,
			title: 'Broker document root',
			date: '2026-09-22',
			publishedAt: '2026-09-22T12:00:00.000Z',
			updatedAt: '2026-09-22T12:00:00.000Z',
			description: 'A browser-only broker fixture.',
			category: 'software',
			tags: ['tinyland'],
			editorialTier: 'less-noteworthy',
			url: `https://transscendsurvival.org/blog/${brokerSlug}`,
			sourceRecord: `content/users/jesssullivan/blog/${brokerSlug}.md`,
			sourceHash: 'sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
			contentHash: 'sha256:cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc',
			displayStatus: 'public-published-display-source',
			frontmatter: { title: 'Broker document root', published: true, status: 'published', visibility: 'public' },
			contentMarkdown:
				'## First section\n\n```sh\necho first\n```\n\n## Second section\n\nText.\n\n## Third section\n\nText.',
			contentFormat: 'text/markdown',
			publicFediverseDelivery: false,
		},
	],
	projectionTombstones: [],
};

async function confineToLocalOrigin(context: BrowserContext, baseURL: string | undefined) {
	if (!baseURL) throw new Error('document-root diagnostics require an explicit loopback baseURL');
	const local = new URL(baseURL);
	if (local.protocol !== 'http:' || !['127.0.0.1', 'localhost', '[::1]'].includes(local.hostname) || local.username || local.password) {
		throw new Error('document-root diagnostics may run only against an HTTP loopback origin');
	}
	await context.route('**/*', async (route) => {
		const request = route.request();
		const url = new URL(request.url());
		if (url.origin === local.origin && !url.username && !url.password && ['GET', 'HEAD'].includes(request.method())) {
			// Route handlers are not re-run for followed redirects. Fetch exactly
			// one hop and reject redirects before a local URL can escape to prod.
			const response = await route.fetch({ maxRedirects: 0, timeout: 20_000 });
			if (response.status() >= 300 && response.status() < 400) {
				await route.abort('blockedbyclient');
			} else {
				await route.fulfill({ response });
			}
		} else {
			// Specific page-level broker/media fixtures take precedence. Everything
			// else stays local: no production, live broker, comments or AP traffic.
			await route.abort('blockedbyclient');
		}
	});
}

test.beforeEach(async ({ context, baseURL }) => {
	await confineToLocalOrigin(context, baseURL);
});

test.describe('Blog document root enhancements', () => {
	test('keeps fenced SVX examples literal beside a reviewed runtime disclosure', async ({ page }) => {
		const contentMarkdown = [
			'## Literal examples',
			'',
			'~~~svx',
			'<script>window.fencedSvxExecuted = true;</script>',
			'<InlineDisclosure label="Tilde literal">{notExecutable}</InlineDisclosure>',
			'~~~',
			'',
			'````svx',
			'```',
			'<InlineDisclosure label="Long fence literal">example</InlineDisclosure>',
			'````',
			'',
			'<InlineDisclosure label="Reviewed runtime disclosure" defaultOpen={true}>',
			'',
			'This reviewed body remains readable.',
			'',
			'</InlineDisclosure>',
		].join('\n');
		await page.route(endpoint, async (route) => {
			await route.fulfill({
				status: 200,
				contentType: 'application/json',
				body: JSON.stringify({
					...brokerStream,
					posts: brokerStream.posts.map((post) => ({ ...post, contentMarkdown })),
				}),
			});
		});
		await page.goto(`/blog/${brokerSlug}`);
		await expect(page.getByTestId('tinyland-blog-post-broker-state')).toContainText('loaded');
		const root = page.locator('[data-document-root]');
		await expect(root.locator('pre code')).toHaveCount(2);
		await expect(root.locator('pre code').first()).toContainText('<script>window.fencedSvxExecuted = true;</script>');
		await expect(root.locator('pre code').first()).toContainText('<InlineDisclosure label="Tilde literal">');
		await expect(root.locator('pre code').last()).toContainText('<InlineDisclosure label="Long fence literal">');
		await expect(root.locator('details[data-reviewed-component="InlineDisclosure"]')).toHaveCount(1);
		await expect(root.locator('summary')).toHaveText('Reviewed runtime disclosure');
		await expect(root).toContainText('This reviewed body remains readable.');
		await expect(root.locator('script')).toHaveCount(0);
		expect(await page.evaluate(() => Object.hasOwn(window, 'fencedSvxExecuted'))).toBe(false);
	});

	test('keeps static headings, controls, and TOC inside its article root', async ({ page }) => {
		await page.setViewportSize({ width: 1440, height: 900 });
		await page.goto('/blog/from-bricked-to-recovered-the-story-of-hacking-an-nvme-ssd-back-to-life');
		const root = page.locator('[data-document-root]');
		await expect(root).toBeVisible();
		await expect.poll(() => root.locator('[data-heading-anchor]').count()).toBeGreaterThan(0);
		await expect(
			root.locator('h2 [data-heading-anchor], h3 [data-heading-anchor], h4 [data-heading-anchor]'),
		).toHaveCount(await root.locator('h2, h3, h4').count());
	});

	test('enhances a delayed broker body once and refreshes after replacement', async ({ page }) => {
		const pageErrors: Error[] = [];
		page.on('pageerror', (error) => pageErrors.push(error));
		await page.setViewportSize({ width: 1440, height: 900 });
		await page.route(endpoint, async (route) => {
			await new Promise((resolve) => setTimeout(resolve, 100));
			await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(brokerStream) });
		});
		await page.goto(`/blog/${brokerSlug}`);
		const root = page.locator('[data-document-root]');
		await expect(page.getByTestId('tinyland-blog-post-broker-state')).toContainText('loaded');
		await expect(root.locator('h2')).toHaveCount(3);
		await expect(root.locator('[data-heading-anchor]')).toHaveCount(3);
		await expect(root.locator('[data-code-copy-button]')).toHaveCount(1);
		const toc = page.getByRole('navigation', { name: 'Table of contents' });
		await expect(toc.getByRole('link')).toHaveCount(3);
		await toc.getByRole('link').first().focus();
		await page.keyboard.press('Enter');
		await expect(root.locator('h2').first()).toBeFocused();
		await expect(page).toHaveURL(new RegExp(`/blog/${brokerSlug}#first-section$`));
		await page.goBack();
		await expect(page).toHaveURL(new RegExp(`/blog/${brokerSlug}$`));
		await page.goForward();
		await expect(page).toHaveURL(new RegExp(`/blog/${brokerSlug}#first-section$`));
		await page.evaluate(() => (window.location.hash = '%'));

		await root.evaluate((element) => {
			element.innerHTML =
				'<h2>Replacement one</h2><pre><code>echo replacement</code></pre><h2>Replacement two</h2><h2>Replacement three</h2>';
		});
		await expect.poll(() => root.locator('[data-heading-anchor]').count()).toBe(3);
		await expect(root.locator('[data-code-copy-button]')).toHaveCount(1);
		await expect(toc.getByRole('link')).toHaveCount(3);

		await page.evaluate(() => {
			const link = document.createElement('a');
			link.href = '/blog/from-bricked-to-recovered-the-story-of-hacking-an-nvme-ssd-back-to-life';
			link.dataset.testid = 'reader-route-replacement';
			link.textContent = 'Route replacement fixture';
			document.body.append(link);
		});
		await page.getByTestId('reader-route-replacement').click();
		await page.waitForURL(/\/blog\/from-bricked-to-recovered-the-story-of-hacking-an-nvme-ssd-back-to-life$/);
		await expect.poll(() => page.locator('[data-document-root] [data-heading-anchor]').count()).toBeGreaterThan(0);
		expect(pageErrors).toEqual([]);
	});
});

test.describe('Homepage public reader enhancement', () => {
	test('default and explicit none add no experimental DOM or broker requests', async ({ page }) => {
		const requests: string[] = [];
		page.on('request', request => { if ([endpoint, pulseEndpoint].includes(request.url())) requests.push(request.url()); });
		await page.goto('/');
		await expect(page.locator('#latest')).toBeVisible();
		await expect(page.locator('.constellation')).toHaveCount(0);
		expect(requests).toEqual([]);
		await page.goto('/?flags=constellation');
		await expect(page.locator('.constellation')).toBeVisible();
		await page.getByRole('button', { name: 'Year tree', exact: true }).click();
		await expect(page.locator('.year-tree')).toBeVisible();
		await page.locator('.year-tree summary').first().click();
		await expect(page.locator('.year-tree a[href^="/blog/"]').first()).toBeVisible();
		await page.getByRole('button', { name: 'Constellation', exact: true }).click();
		await expect(page.locator('.constellation-field')).toBeVisible();
		requests.length = 0;
		await page.goto('/?flags=none');
		await expect(page.locator('.constellation')).toHaveCount(0);
		expect(requests).toEqual([]);
	});
	test('keeps checked-in article links and the reviewed Pulse fallback readable without JavaScript', async ({ browser }) => {
		const context = await browser.newContext({
			javaScriptEnabled: false,
			baseURL: test.info().project.use.baseURL,
		});
		try {
			await confineToLocalOrigin(context, test.info().project.use.baseURL);
			const page = await context.newPage();
			await page.goto('/');
			await expect(page.locator('#latest a[href^="/blog/"]').first()).toBeVisible();
			await expect(page.locator('#pulse')).toContainText('Pulse');
			await expect(page.locator('.constellation')).toHaveCount(0);
		} finally {
			await context.close();
		}
	});

	test('shows reviewed Pulse media from a broker response without creating a dead link for a broker-only article', async ({ page }) => {
		let reviewedPreviewFulfilled = false;
		await page.route(reviewedPreviewUrl, async (route) => {
			await route.fulfill({ status: 200, contentType: 'image/png', body: tinyPng });
			reviewedPreviewFulfilled = true;
		});
		await page.route(endpoint, async (route) => {
			await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(brokerStream) });
		});
		await page.route(pulseEndpoint, async (route) => {
			await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(reviewedLeadImageSnapshot) });
		});
		await page.goto('/?flags=constellation');
		await expect(page.getByTestId('home-reader-broker-state')).toContainText('Blog ready; Pulse ready.');
		await expect(page.locator('.constellation')).toContainText('A reviewed lead image accompanies this public note.');
		const reviewedImage = page.getByRole('img', { name: 'A tawny owl resting on a cedar branch' });
		await page.getByText('Reviewed public Pulse details', { exact: true }).click();
		await expect(reviewedImage).toBeVisible();
		await reviewedImage.scrollIntoViewIfNeeded();
		await expect.poll(() => reviewedPreviewFulfilled).toBe(true);
		await expect(reviewedImage).toHaveJSProperty('complete', true);
		await expect(reviewedImage).toHaveJSProperty('naturalWidth', 1);
		await expect(page.locator('a[href="/blog/brokered-document-root-test"]')).toHaveCount(0);
		await expect(page.getByRole('link', { name: 'Browse as a list' })).toHaveAttribute('href', '#latest');
	});

	test('keeps static articles when the blog endpoint fails and still updates Pulse', async ({ page }) => {
		await page.route(endpoint, async (route) => {
			await route.fulfill({ status: 503, contentType: 'application/json', body: '{}' });
		});
		await page.route(pulseEndpoint, async (route) => {
			await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(reviewedLeadImageSnapshot) });
		});
		await page.goto('/?flags=constellation');
		await expect(page.getByTestId('home-reader-broker-state')).toContainText('Blog unavailable; Pulse ready.');
		await expect(page.locator('#latest a[href^="/blog/"]').first()).toBeVisible();
		await expect(page.locator('.constellation')).toContainText('A reviewed lead image accompanies this public note.');
	});

	test('keeps checked-in Pulse when its endpoint fails independently of the blog stream', async ({ page }) => {
		await page.route(endpoint, async (route) => {
			await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(brokerStream) });
		});
		await page.route(pulseEndpoint, async (route) => {
			await route.fulfill({ status: 503, contentType: 'application/json', body: '{}' });
		});
		await page.goto('/?flags=constellation');
		await expect(page.getByTestId('home-reader-broker-state')).toContainText('Blog ready; Pulse unavailable.');
		await expect(page.locator('#pulse')).toBeVisible();
		await expect(page.locator('a[href="/blog/brokered-document-root-test"]')).toHaveCount(0);
	});
});
