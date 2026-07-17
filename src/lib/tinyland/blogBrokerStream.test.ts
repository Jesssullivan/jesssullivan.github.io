import { describe, expect, it, vi } from 'vitest';
import {
	TINYLAND_BLOG_BROKER_STREAM_URL,
	findTinylandBlogBrokerPost,
	loadTinylandBlogBrokerStream,
	mergeBrokerPostsIntoStatic,
	tinylandBlogBrokerStreamToPosts,
	type TinylandBlogBrokerFetch,
	type TinylandBlogBrokerStream,
} from './blogBrokerStream';
import type { Post } from '$lib/types';

const validStream: TinylandBlogBrokerStream = {
	schemaVersion: 'tinyland.blog.broker-stream.v1',
	generatedAt: '2026-05-19T04:00:00.000Z',
	sourceAuthority: 'tinyland.dev',
	contentAuthority: 'tinyland.dev',
	spokeRef: 'jesssullivan-github-io',
	spokeTarget: 'transscendsurvival.org',
	routePath: '/projections/jesssullivan-github-io/blog/broker-stream.v1.json',
	publicUrl: TINYLAND_BLOG_BROKER_STREAM_URL,
	brokerOrigin: 'https://hub.tinyland.dev',
	streamStatus: 'dynamic-hub-managed-greymatter',
	managementStatus: 'hub-managed-greymatter',
	runtimeBrokerFetch: true,
	publicFediverseDelivery: false,
	activityPubStatus: 'broker-display-stream-not-public-fediverse-delivery',
	contentHash: 'sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
	counts: {
		reviewedStreamPosts: 1,
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
		contentTransport: 'dynamic-broker-stream',
		contentMarkdownIncluded: true,
		draftContentIncluded: false,
		unreviewedContentIncluded: false,
		publicFediverseDelivery: false,
	},
	posts: [
		{
			type: 'Article',
			id: 'https://hub.tinyland.dev/projections/jesssullivan-github-io/ap/objects/post/example',
			slug: 'example',
			title: 'Example',
			date: '2026-05-19',
			publishedAt: '2026-05-19T00:00:00.000Z',
			updatedAt: '2026-05-19T00:00:00.000Z',
			description: 'Brokered example',
			category: 'software',
			tags: ['tinyland', 'broker'],
			editorialTier: 'less-noteworthy',
			url: 'https://transscendsurvival.org/blog/example',
			sourceRecord: 'content/users/jesssullivan/blog/example.md',
			sourceHash: 'sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
			contentHash: 'sha256:cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc',
			reviewStatus: 'operator-reviewed-source-public',
			frontmatter: { title: 'Example' },
			contentMarkdown: '## Hello\n\nBrokered post body.',
			contentFormat: 'text/markdown',
			publicFediverseDelivery: false,
		},
	],
	projectionTombstones: [],
};

const liveDisplayStream: TinylandBlogBrokerStream = {
	...validStream,
	counts: {
		totalManagedPosts: 1,
		publicPublishedManagedPosts: 1,
		publicPublishedDisplayPosts: 1,
		displayHeldBackPosts: 0,
		draftOrUnpublishedManagedPosts: 0,
		projectionTombstones: 0,
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
	posts: validStream.posts.map(({ reviewStatus: _reviewStatus, ...post }) => ({
		...post,
		displayStatus: 'public-published-display-source',
		frontmatter: {
			...post.frontmatter,
			published: true,
			status: 'published',
			visibility: 'public',
		},
	})),
};

const jsonResponse = (body: unknown, init: ResponseInit = {}) =>
	new Response(JSON.stringify(body), {
		status: init.status ?? 200,
		statusText: init.statusText,
		headers: { 'Content-Type': 'application/json' },
	});

describe('loadTinylandBlogBrokerStream', () => {
	it('fetches the hub broker stream without falling back to checked-in post snapshots', async () => {
		const fetchMock = vi.fn<TinylandBlogBrokerFetch>(async () => jsonResponse(validStream));

		await expect(loadTinylandBlogBrokerStream(fetchMock)).resolves.toEqual(validStream);
		expect(fetchMock).toHaveBeenCalledWith(
			TINYLAND_BLOG_BROKER_STREAM_URL,
			expect.objectContaining({
				headers: { Accept: 'application/json' },
				cache: 'no-store',
			}),
		);
		expect(fetchMock.mock.calls.flat().join(' ')).not.toContain('/data/tinyland/posts/public-snapshot.v1.json');
	});

	it('accepts the current live public display-membership broker contract', async () => {
		const fetchMock = vi.fn<TinylandBlogBrokerFetch>(async () => jsonResponse(liveDisplayStream));

		await expect(loadTinylandBlogBrokerStream(fetchMock)).resolves.toEqual(liveDisplayStream);
	});

	it('rejects streams that try to behave like checked-in materialization', async () => {
		const fetchMock = vi.fn<TinylandBlogBrokerFetch>(async () =>
			jsonResponse({
				...validStream,
				consumerContract: {
					...validStream.consumerContract,
					checkedInPostPayloads: true,
				},
			}),
		);

		await expect(loadTinylandBlogBrokerStream(fetchMock)).rejects.toThrow('checkedInPostPayloads must be false');
	});

	it('rejects public Fediverse delivery claims on the display stream', async () => {
		const fetchMock = vi.fn<TinylandBlogBrokerFetch>(async () =>
			jsonResponse({
				...validStream,
				publicFediverseDelivery: true,
			}),
		);

		await expect(loadTinylandBlogBrokerStream(fetchMock)).rejects.toThrow('publicFediverseDelivery must be false');
	});

	it('rejects unreviewed broker posts', async () => {
		const fetchMock = vi.fn<TinylandBlogBrokerFetch>(async () =>
			jsonResponse({
				...validStream,
				posts: validStream.posts.map((post) => ({
					...post,
					reviewStatus: 'draft-held-back',
				})),
			}),
		);

		await expect(loadTinylandBlogBrokerStream(fetchMock)).rejects.toThrow(
			'reviewStatus must be operator-reviewed-source-public',
		);
	});

	it('rejects display streams without the public display-membership policy', async () => {
		const fetchMock = vi.fn<TinylandBlogBrokerFetch>(async () =>
			jsonResponse({
				...liveDisplayStream,
				policy: {
					...liveDisplayStream.policy,
					displayMembershipPolicy: undefined,
				},
			}),
		);

		await expect(loadTinylandBlogBrokerStream(fetchMock)).rejects.toThrow(
			'policy must declare a public display membership gate',
		);
	});

	it('rejects display posts that are not public published frontmatter', async () => {
		const fetchMock = vi.fn<TinylandBlogBrokerFetch>(async () =>
			jsonResponse({
				...liveDisplayStream,
				posts: liveDisplayStream.posts.map((post) => ({
					...post,
					frontmatter: {
						...post.frontmatter,
						visibility: 'private',
					},
				})),
			}),
		);

		await expect(loadTinylandBlogBrokerStream(fetchMock)).rejects.toThrow('must be public-published display content');
	});

	it('maps broker posts into existing BlogCard post shape', () => {
		const posts = tinylandBlogBrokerStreamToPosts(validStream);

		expect(posts).toEqual([
			expect.objectContaining({
				title: 'Example',
				slug: 'example',
				category: 'software',
				tags: ['tinyland', 'broker'],
				editorial_tier: 'less-noteworthy',
				content_stratum: 'less-noteworthy',
				content: '## Hello\n\nBrokered post body.',
				published: true,
			}),
		]);
		expect(posts[0].reading_time).toBeGreaterThanOrEqual(1);
	});

	it('rejects broker posts that try to use Pulse as a blog editorial tier', async () => {
		const fetchMock = vi.fn<TinylandBlogBrokerFetch>(async () =>
			jsonResponse({
				...validStream,
				posts: validStream.posts.map((post) => ({
					...post,
					editorialTier: 'pulse',
				})),
			}),
		);

		await expect(loadTinylandBlogBrokerStream(fetchMock)).rejects.toThrow(
			'editorial tier must be one of less-noteworthy, noteworthy',
		);
	});

	it('finds a stream post by slug for canonical route hydration', () => {
		expect(findTinylandBlogBrokerPost(validStream, 'example')?.title).toBe('Example');
		expect(findTinylandBlogBrokerPost(validStream, 'missing')).toBeNull();
	});
});

describe('mergeBrokerPostsIntoStatic', () => {
	const post = (slug: string, date: string, feature_image?: string): Post =>
		({
			title: slug,
			slug,
			date,
			description: '',
			tags: [],
			published: true,
			feature_image,
		}) as unknown as Post;

	it('never drops a static post the broker stream omits (no-drop invariant)', () => {
		// The exact production regression: broker stream lags the deploy and is
		// missing freshly published posts. They must NOT disappear on hydration.
		const staticPosts = [post('canon', '2026-06-09'), post('glue', '2026-06-08'), post('old', '2026-05-01')];
		const broker = [post('old', '2026-05-01')]; // stale: missing canon + glue
		const slugs = mergeBrokerPostsIntoStatic(staticPosts, broker).map((p) => p.slug);
		expect(slugs).toContain('canon');
		expect(slugs).toContain('glue');
		expect(slugs).toContain('old');
	});

	it('keeps the static set authoritative and re-sorts newest-first', () => {
		const staticPosts = [post('old', '2026-05-01'), post('canon', '2026-06-09')];
		expect(mergeBrokerPostsIntoStatic(staticPosts, []).map((p) => p.slug)).toEqual(['canon', 'old']);
	});

	it('backfills a missing static feature_image from the matching broker post only', () => {
		const merged = mergeBrokerPostsIntoStatic(
			[post('canon', '2026-06-09')],
			[post('canon', '2026-06-09', '/images/posts/canon.jpg')],
		);
		expect(merged[0].feature_image).toBe('/images/posts/canon.jpg');
	});

	it('never overwrites an existing static feature_image', () => {
		const merged = mergeBrokerPostsIntoStatic(
			[post('canon', '2026-06-09', '/images/posts/local.jpg')],
			[post('canon', '2026-06-09', '/images/posts/broker.jpg')],
		);
		expect(merged[0].feature_image).toBe('/images/posts/local.jpg');
	});

	it('appends broker-only posts (live posts not in the repo) in date order', () => {
		const merged = mergeBrokerPostsIntoStatic(
			[post('canon', '2026-06-09'), post('old', '2026-05-01')],
			[post('federated', '2026-06-01')],
		);
		expect(merged.map((p) => p.slug)).toEqual(['canon', 'federated', 'old']);
	});

	it('does not revive an explicitly held slug from the broker', () => {
		const merged = mergeBrokerPostsIntoStatic(
			[post('canon', '2026-06-09')],
			[post('held', '2026-06-10'), post('federated', '2026-06-01')],
			new Set(['held']),
		);
		expect(merged.map((p) => p.slug)).toEqual(['canon', 'federated']);
	});
});
