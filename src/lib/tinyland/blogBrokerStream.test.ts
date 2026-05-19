import { describe, expect, it, vi } from 'vitest';
import {
	TINYLAND_BLOG_BROKER_STREAM_URL,
	findTinylandBlogBrokerPost,
	loadTinylandBlogBrokerStream,
	tinylandBlogBrokerStreamToPosts,
	type TinylandBlogBrokerFetch,
	type TinylandBlogBrokerStream,
} from './blogBrokerStream';

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

		await expect(loadTinylandBlogBrokerStream(fetchMock)).rejects.toThrow(
			'checkedInPostPayloads must be false',
		);
	});

	it('rejects public Fediverse delivery claims on the display stream', async () => {
		const fetchMock = vi.fn<TinylandBlogBrokerFetch>(async () =>
			jsonResponse({
				...validStream,
				publicFediverseDelivery: true,
			}),
		);

		await expect(loadTinylandBlogBrokerStream(fetchMock)).rejects.toThrow(
			'publicFediverseDelivery must be false',
		);
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

	it('maps broker posts into existing BlogCard post shape', () => {
		const posts = tinylandBlogBrokerStreamToPosts(validStream);

		expect(posts).toEqual([
			expect.objectContaining({
				title: 'Example',
				slug: 'example',
				category: 'software',
				tags: ['tinyland', 'broker'],
				content: '## Hello\n\nBrokered post body.',
				published: true,
			}),
		]);
		expect(posts[0].reading_time).toBeGreaterThanOrEqual(1);
	});

	it('finds a stream post by slug for canonical route hydration', () => {
		expect(findTinylandBlogBrokerPost(validStream, 'example')?.title).toBe('Example');
		expect(findTinylandBlogBrokerPost(validStream, 'missing')).toBeNull();
	});
});
