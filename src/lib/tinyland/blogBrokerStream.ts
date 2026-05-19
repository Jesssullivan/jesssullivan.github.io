import { POST_CATEGORIES, type Post, type PostCategory } from '$lib/types';

export const TINYLAND_BLOG_BROKER_STREAM_URL =
	'https://hub.tinyland.dev/projections/jesssullivan-github-io/blog/broker-stream.v1.json';
export const TINYLAND_BLOG_BROKER_STREAM_SCHEMA_VERSION = 'tinyland.blog.broker-stream.v1';

export type TinylandBlogBrokerFetch = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

export interface TinylandBlogBrokerFetchOptions {
	readonly endpoint?: string;
	readonly signal?: AbortSignal;
}

export interface TinylandBlogBrokerPost {
	readonly type: 'Article';
	readonly id: string;
	readonly slug: string;
	readonly title: string;
	readonly date: string;
	readonly publishedAt: string;
	readonly updatedAt: string;
	readonly description: string;
	readonly category: string;
	readonly tags: readonly unknown[];
	readonly featureImage?: string;
	readonly url: string;
	readonly sourceRecord: string;
	readonly sourceHash: string;
	readonly contentHash: string;
	readonly reviewStatus: string;
	readonly frontmatter: Record<string, unknown>;
	readonly contentMarkdown: string;
	readonly contentFormat: 'text/markdown';
	readonly publicFediverseDelivery: false;
}

export interface TinylandBlogBrokerStream {
	readonly schemaVersion: typeof TINYLAND_BLOG_BROKER_STREAM_SCHEMA_VERSION;
	readonly generatedAt: string;
	readonly sourceAuthority: 'tinyland.dev';
	readonly contentAuthority: 'tinyland.dev';
	readonly spokeRef: 'jesssullivan-github-io';
	readonly spokeTarget: 'transscendsurvival.org';
	readonly routePath: '/projections/jesssullivan-github-io/blog/broker-stream.v1.json';
	readonly publicUrl: string;
	readonly brokerOrigin: string;
	readonly streamStatus: 'dynamic-hub-managed-greymatter';
	readonly managementStatus: 'hub-managed-greymatter';
	readonly runtimeBrokerFetch: true;
	readonly publicFediverseDelivery: false;
	readonly activityPubStatus: 'broker-display-stream-not-public-fediverse-delivery';
	readonly contentHash: string;
	readonly counts: {
		readonly reviewedStreamPosts: number;
		readonly [key: string]: unknown;
	};
	readonly consumerContract: {
		readonly mode: 'cf-pages-runtime-broker-fetch';
		readonly mutationAuthority: 'tinyland.dev';
		readonly contentAuthority: 'tinyland.dev';
		readonly checkedInPostPayloads: false;
		readonly spokeMutationApi: false;
		readonly spokeActivityPubWorker: false;
		readonly [key: string]: unknown;
	};
	readonly policy: {
		readonly contentTransport: 'dynamic-broker-stream';
		readonly contentMarkdownIncluded: true;
		readonly draftContentIncluded: false;
		readonly unreviewedContentIncluded: false;
		readonly publicFediverseDelivery: false;
		readonly [key: string]: unknown;
	};
	readonly posts: readonly TinylandBlogBrokerPost[];
	readonly projectionTombstones: readonly unknown[];
}

export type TinylandBlogBrokerState =
	| { readonly status: 'loading'; readonly endpoint: string }
	| {
			readonly status: 'ready';
			readonly endpoint: string;
			readonly stream: TinylandBlogBrokerStream;
			readonly posts: Post[];
	  }
	| { readonly status: 'unavailable'; readonly endpoint: string; readonly reason: string };

const FORBIDDEN_PRIVATE_FIELD_PATTERN =
	/privateKey|publicKeyPem|apiKey|accessToken|privateObjectKey|s3:\/\//i;

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function requireString(record: Record<string, unknown>, key: string): string {
	const value = record[key];
	if (typeof value !== 'string' || value.length === 0) {
		throw new Error(`blog broker stream field ${key} must be a non-empty string`);
	}
	return value;
}

function requireLiteral<T extends string | boolean>(
	record: Record<string, unknown>,
	key: string,
	expected: T,
): T {
	if (record[key] !== expected) {
		throw new Error(`blog broker stream field ${key} must be ${String(expected)}`);
	}
	return expected;
}

function requireSha256(value: string, label: string): string {
	if (!/^sha256:[0-9a-f]{64}$/i.test(value)) {
		throw new Error(`blog broker stream ${label} must be a sha256 digest`);
	}
	return value;
}

function stringTags(value: readonly unknown[] | undefined): string[] {
	return (value ?? []).filter((tag): tag is string => typeof tag === 'string' && tag.trim().length > 0);
}

function normalizeCategory(value: string): PostCategory | undefined {
	return POST_CATEGORIES.includes(value as PostCategory) ? (value as PostCategory) : undefined;
}

function estimateReadingTime(markdown: string): number {
	const text = markdown
		.replace(/```[\s\S]*?```/g, ' ')
		.replace(/`[^`]*`/g, ' ')
		.replace(/!\[[^\]]*]\([^)]*\)/g, ' ')
		.replace(/\[([^\]]*)]\([^)]*\)/g, '$1')
		.replace(/[#*_~>|\\-]/g, ' ')
		.replace(/\s+/g, ' ')
		.trim();

	if (!text) return 1;
	return Math.max(1, Math.round(text.split(/\s+/).length / 230));
}

export function validateTinylandBlogBrokerStream(data: unknown): TinylandBlogBrokerStream {
	if (!isRecord(data)) {
		throw new Error('blog broker stream must be an object');
	}

	const raw = JSON.stringify(data);
	if (FORBIDDEN_PRIVATE_FIELD_PATTERN.test(raw)) {
		throw new Error('blog broker stream contains private field-shaped data');
	}

	requireLiteral(data, 'schemaVersion', TINYLAND_BLOG_BROKER_STREAM_SCHEMA_VERSION);
	requireLiteral(data, 'sourceAuthority', 'tinyland.dev');
	requireLiteral(data, 'contentAuthority', 'tinyland.dev');
	requireLiteral(data, 'spokeRef', 'jesssullivan-github-io');
	requireLiteral(data, 'spokeTarget', 'transscendsurvival.org');
	requireLiteral(data, 'routePath', '/projections/jesssullivan-github-io/blog/broker-stream.v1.json');
	requireLiteral(data, 'streamStatus', 'dynamic-hub-managed-greymatter');
	requireLiteral(data, 'managementStatus', 'hub-managed-greymatter');
	requireLiteral(data, 'runtimeBrokerFetch', true);
	requireLiteral(data, 'publicFediverseDelivery', false);
	requireLiteral(data, 'activityPubStatus', 'broker-display-stream-not-public-fediverse-delivery');
	requireSha256(requireString(data, 'contentHash'), 'contentHash');

	const consumerContract = data.consumerContract;
	if (!isRecord(consumerContract)) {
		throw new Error('blog broker stream consumerContract must be an object');
	}
	requireLiteral(consumerContract, 'mode', 'cf-pages-runtime-broker-fetch');
	requireLiteral(consumerContract, 'mutationAuthority', 'tinyland.dev');
	requireLiteral(consumerContract, 'contentAuthority', 'tinyland.dev');
	requireLiteral(consumerContract, 'checkedInPostPayloads', false);
	requireLiteral(consumerContract, 'spokeMutationApi', false);
	requireLiteral(consumerContract, 'spokeActivityPubWorker', false);

	const policy = data.policy;
	if (!isRecord(policy)) {
		throw new Error('blog broker stream policy must be an object');
	}
	requireLiteral(policy, 'contentTransport', 'dynamic-broker-stream');
	requireLiteral(policy, 'contentMarkdownIncluded', true);
	requireLiteral(policy, 'draftContentIncluded', false);
	requireLiteral(policy, 'unreviewedContentIncluded', false);
	requireLiteral(policy, 'publicFediverseDelivery', false);

	if (!Array.isArray(data.posts)) {
		throw new Error('blog broker stream posts must be an array');
	}

	const posts = data.posts.map((post, index): TinylandBlogBrokerPost => {
		if (!isRecord(post)) {
			throw new Error(`blog broker stream post ${index} must be an object`);
		}

		requireLiteral(post, 'type', 'Article');
		requireLiteral(post, 'contentFormat', 'text/markdown');
		requireLiteral(post, 'publicFediverseDelivery', false);
		requireLiteral(post, 'reviewStatus', 'operator-reviewed-source-public');
		const sourceHash = requireSha256(requireString(post, 'sourceHash'), `post ${index} sourceHash`);
		const contentHash = requireSha256(requireString(post, 'contentHash'), `post ${index} contentHash`);

		if (!isRecord(post.frontmatter)) {
			throw new Error(`blog broker stream post ${index} frontmatter must be an object`);
		}
		if (!Array.isArray(post.tags)) {
			throw new Error(`blog broker stream post ${index} tags must be an array`);
		}

		return {
			type: 'Article',
			id: requireString(post, 'id'),
			slug: requireString(post, 'slug'),
			title: requireString(post, 'title'),
			date: requireString(post, 'date'),
			publishedAt: requireString(post, 'publishedAt'),
			updatedAt: requireString(post, 'updatedAt'),
			description: typeof post.description === 'string' ? post.description : '',
			category: typeof post.category === 'string' ? post.category : 'personal',
			tags: post.tags,
			...(typeof post.featureImage === 'string' && post.featureImage ? { featureImage: post.featureImage } : {}),
			url: requireString(post, 'url'),
			sourceRecord: requireString(post, 'sourceRecord'),
			sourceHash,
			contentHash,
			reviewStatus: 'operator-reviewed-source-public',
			frontmatter: post.frontmatter,
			contentMarkdown: requireString(post, 'contentMarkdown'),
			contentFormat: 'text/markdown',
			publicFediverseDelivery: false,
		};
	});

	const counts = data.counts;
	if (!isRecord(counts) || counts.reviewedStreamPosts !== posts.length) {
		throw new Error('blog broker stream reviewedStreamPosts must match posts.length');
	}

	return {
		...(data as unknown as TinylandBlogBrokerStream),
		posts,
	};
}

export async function loadTinylandBlogBrokerStream(
	fetchFn: TinylandBlogBrokerFetch,
	options: TinylandBlogBrokerFetchOptions = {},
): Promise<TinylandBlogBrokerStream> {
	const endpoint = options.endpoint ?? TINYLAND_BLOG_BROKER_STREAM_URL;
	const init: RequestInit = {
		headers: { Accept: 'application/json' },
		cache: 'no-store',
	};

	if (options.signal) {
		init.signal = options.signal;
	}

	const res = await fetchFn(endpoint, init);
	if (!res.ok) {
		throw new Error(`blog broker stream fetch failed: ${res.status} ${res.statusText} (${endpoint})`);
	}

	return validateTinylandBlogBrokerStream(await res.json());
}

export function tinylandBlogBrokerPostToPost(post: TinylandBlogBrokerPost): Post {
	return {
		title: post.title,
		slug: post.slug,
		date: post.date,
		description: post.description,
		tags: stringTags(post.tags),
		published: true,
		category: normalizeCategory(post.category),
		feature_image: post.featureImage,
		reading_time: estimateReadingTime(post.contentMarkdown),
		author_slug: 'jesssullivan',
		content: post.contentMarkdown,
	};
}

export function tinylandBlogBrokerStreamToPosts(stream: TinylandBlogBrokerStream): Post[] {
	return stream.posts
		.map(tinylandBlogBrokerPostToPost)
		.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime() || a.slug.localeCompare(b.slug));
}

export function findTinylandBlogBrokerPost(
	stream: TinylandBlogBrokerStream,
	slug: string,
): TinylandBlogBrokerPost | null {
	return stream.posts.find((post) => post.slug === slug) ?? null;
}

export function summarizeTinylandBlogBrokerError(error: unknown): string {
	if (error instanceof Error) {
		if (error.name === 'AbortError') {
			return 'broker request timed out';
		}
		return error.message;
	}

	return 'broker request failed';
}
