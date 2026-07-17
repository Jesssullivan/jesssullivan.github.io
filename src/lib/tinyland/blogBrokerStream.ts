import {
	POST_CATEGORIES,
	POST_EDITORIAL_TIERS,
	type Post,
	type PostCategory,
	type PostEditorialTier,
} from '$lib/types';

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
	readonly editorialTier?: PostEditorialTier;
	readonly featureImage?: string;
	readonly url: string;
	readonly sourceRecord: string;
	readonly sourceHash: string;
	readonly contentHash: string;
	readonly reviewStatus?: string;
	readonly displayStatus?: string;
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
		readonly reviewedStreamPosts?: number;
		readonly publicPublishedDisplayPosts?: number;
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
		readonly projectionPolicy?: 'publicPublishedManagedPosts-display-stream';
		readonly displayMembershipPolicy?: 'public-published-display-membership';
		readonly contentTransport: 'dynamic-broker-stream';
		readonly contentMarkdownIncluded: true;
		readonly draftContentIncluded: false;
		readonly unreviewedContentIncluded?: false;
		readonly displayMembershipGate?: 'frontmatter-published-status-visibility';
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

const FORBIDDEN_PRIVATE_FIELD_PATTERN = /privateKey|publicKeyPem|apiKey|accessToken|privateObjectKey|s3:\/\//i;
const LEGACY_REVIEW_STATUS = 'operator-reviewed-source-public';
const DISPLAY_STATUS = 'public-published-display-source';

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

function requireLiteral<T extends string | boolean>(record: Record<string, unknown>, key: string, expected: T): T {
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

function optionalString(record: Record<string, unknown>, key: string): string | undefined {
	const value = record[key];
	return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function isPublicPublishedFrontmatter(frontmatter: Record<string, unknown>): boolean {
	return frontmatter.published === true && frontmatter.status === 'published' && frontmatter.visibility === 'public';
}

function requireDisplayMembershipPolicy(policy: Record<string, unknown>): void {
	const legacyReviewPolicy = policy.unreviewedContentIncluded === false;
	const displayMembershipPolicy =
		policy.projectionPolicy === 'publicPublishedManagedPosts-display-stream' &&
		policy.displayMembershipPolicy === 'public-published-display-membership' &&
		policy.displayMembershipGate === 'frontmatter-published-status-visibility';

	if (!legacyReviewPolicy && !displayMembershipPolicy) {
		throw new Error('blog broker stream policy must declare a public display membership gate');
	}
}

function requireDisplayEligiblePost(
	post: Record<string, unknown>,
	index: number,
	frontmatter: Record<string, unknown>,
): { reviewStatus?: string; displayStatus?: string } {
	const reviewStatus = optionalString(post, 'reviewStatus');
	const displayStatus = optionalString(post, 'displayStatus');

	if (reviewStatus !== undefined && reviewStatus !== LEGACY_REVIEW_STATUS) {
		throw new Error(`blog broker stream post ${index} reviewStatus must be ${LEGACY_REVIEW_STATUS}`);
	}

	const legacyReviewGate = reviewStatus === LEGACY_REVIEW_STATUS;
	const displayMembershipGate = displayStatus === DISPLAY_STATUS && isPublicPublishedFrontmatter(frontmatter);

	if (!legacyReviewGate && !displayMembershipGate) {
		throw new Error(`blog broker stream post ${index} must be public-published display content`);
	}

	return {
		...(reviewStatus ? { reviewStatus } : {}),
		...(displayStatus ? { displayStatus } : {}),
	};
}

function stringTags(value: readonly unknown[] | undefined): string[] {
	return (value ?? []).filter((tag): tag is string => typeof tag === 'string' && tag.trim().length > 0);
}

function normalizeCategory(value: string): PostCategory | undefined {
	return POST_CATEGORIES.includes(value as PostCategory) ? (value as PostCategory) : undefined;
}

function normalizeEditorialTier(value: unknown, label: string): PostEditorialTier | undefined {
	if (value === undefined || value === null || value === '') return undefined;
	if (typeof value !== 'string' || !POST_EDITORIAL_TIERS.includes(value as PostEditorialTier)) {
		throw new Error(
			`blog broker stream ${label} editorial tier must be one of ${POST_EDITORIAL_TIERS.join(', ')}`,
		);
	}
	return value as PostEditorialTier;
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
	requireDisplayMembershipPolicy(policy);
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
		const sourceHash = requireSha256(requireString(post, 'sourceHash'), `post ${index} sourceHash`);
		const contentHash = requireSha256(requireString(post, 'contentHash'), `post ${index} contentHash`);

		if (!isRecord(post.frontmatter)) {
			throw new Error(`blog broker stream post ${index} frontmatter must be an object`);
		}
		if (!Array.isArray(post.tags)) {
			throw new Error(`blog broker stream post ${index} tags must be an array`);
		}
		const displayGateFields = requireDisplayEligiblePost(post, index, post.frontmatter);
		const editorialTier = normalizeEditorialTier(post.editorialTier, `post ${index}`);
		const frontmatterEditorialTier = normalizeEditorialTier(
			post.frontmatter.editorial_tier,
			`post ${index} frontmatter`,
		);

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
			...(editorialTier || frontmatterEditorialTier
				? { editorialTier: editorialTier ?? frontmatterEditorialTier }
				: {}),
			...(typeof post.featureImage === 'string' && post.featureImage ? { featureImage: post.featureImage } : {}),
			url: requireString(post, 'url'),
			sourceRecord: requireString(post, 'sourceRecord'),
			sourceHash,
			contentHash,
			...displayGateFields,
			frontmatter: post.frontmatter,
			contentMarkdown: requireString(post, 'contentMarkdown'),
			contentFormat: 'text/markdown',
			publicFediverseDelivery: false,
		};
	});

	const counts = data.counts;
	if (
		!isRecord(counts) ||
		(counts.reviewedStreamPosts !== posts.length && counts.publicPublishedDisplayPosts !== posts.length)
	) {
		throw new Error('blog broker stream public display post count must match posts.length');
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
		editorial_tier: post.editorialTier,
		content_stratum: post.editorialTier,
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

/**
 * Merge the hub broker stream into the spoke's authoritative static post set.
 *
 * The build-time static index (search-index.json, bundled into the prerendered
 * HTML) is always at least as fresh as the deploy, so it — not the runtime
 * broker — owns which posts EXIST. The hub public display stream can lag the
 * deploy while spoke-to-hub ingest catches up, so letting the broker REPLACE
 * the list made fresh posts render on SSR then vanish on hydration once the
 * broker fetch resolved.
 *
 * This makes the broker additive / enrichment-only:
 *   - every static post is kept (a static slug is NEVER dropped),
 *   - a static post with no feature_image is backfilled from the matching broker
 *     post only,
 *   - broker-only posts (live posts not present in the repo) are appended,
 *   - explicit publication holds are removed from both sources,
 *   - the result is re-sorted newest-first to match the static ordering.
 *
 * Net: new-post visibility is independent of broker freshness.
 */
export function mergeBrokerPostsIntoStatic(
	staticPosts: readonly Post[],
	brokerPosts: readonly Post[],
	publicationHolds: ReadonlySet<string> = new Set(),
): Post[] {
	const brokerBySlug = new Map(brokerPosts.map((post) => [post.slug, post]));
	const visibleStaticPosts = staticPosts.filter((post) => !publicationHolds.has(post.slug));
	const staticSlugs = new Set(visibleStaticPosts.map((post) => post.slug));

	const merged: Post[] = visibleStaticPosts.map((post) => {
		if (post.feature_image) return post;
		const broker = brokerBySlug.get(post.slug);
		return broker?.feature_image ? { ...post, feature_image: broker.feature_image } : post;
	});

	for (const post of brokerPosts) {
		if (!staticSlugs.has(post.slug) && !publicationHolds.has(post.slug)) merged.push(post);
	}

	return merged.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime() || a.slug.localeCompare(b.slug));
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
