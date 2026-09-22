import { test, expect } from '@playwright/test';

const endpoint = 'https://hub.tinyland.dev/projections/jesssullivan-github-io/blog/broker-stream.v1.json';
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

test.describe('Blog document root enhancements', () => {
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
