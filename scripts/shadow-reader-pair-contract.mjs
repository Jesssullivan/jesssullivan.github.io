import { createHash } from 'node:crypto';

const SHA = /^[0-9a-f]{40}$/;
const HASH = /^sha256:[0-9a-f]{64}$/;
const SLUG = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/;
export const SHADOW_ORIGIN = 'https://tss.tinyland.dev';
export const BLOG_BROKER_URL =
	'https://hub.tinyland.dev/projections/jesssullivan-github-io/blog/broker-stream.v1.json';
export const PULSE_BROKER_URL =
	'https://hub.tinyland.dev/projections/jesssullivan-github-io/pulse/public-snapshot.v2.json';

/** Browser policy: only the review shadow, two display projections, and reviewed previews. */
export function shadowRequestDecision(input, method = 'GET') {
	let url;
	try {
		url = new URL(input);
	} catch {
		return { allowed: false, forbidden: true, reason: 'invalid URL' };
	}
	if (method !== 'GET' && method !== 'HEAD') {
		return { allowed: false, forbidden: true, reason: `unexpected ${method} request` };
	}
	if (url.username || url.password) {
		return { allowed: false, forbidden: true, reason: 'URL contains credentials' };
	}
	if (url.origin === SHADOW_ORIGIN) {
		if (/^\/(?:ap|activitypub|actors?|inbox|outbox)(?:\/|$)|^\/\.well-known\/(?:webfinger|nodeinfo)/i.test(url.pathname)) {
			return { allowed: false, forbidden: true, reason: 'actor or federation route' };
		}
		return { allowed: true, forbidden: false, reason: 'shadow route' };
	}
	if (url.href === BLOG_BROKER_URL || url.href === PULSE_BROKER_URL) {
		return { allowed: true, forbidden: false, reason: 'fixed public display projection' };
	}
	if (
		url.origin === 'https://hub.tinyland.dev' &&
		/^(?:\/media\/|\/images\/).+\.preview\.[a-z0-9]+$/i.test(url.pathname) &&
		!url.search && !url.hash
	) {
		return { allowed: true, forbidden: false, reason: 'reviewed public media preview' };
	}
	return {
		allowed: false,
		forbidden: ['transscendsurvival.org', 'www.transscendsurvival.org'].includes(url.hostname) ||
			/^\/(?:ap|activitypub|actors?|inbox|outbox)(?:\/|$)/i.test(url.pathname),
		reason: 'outside shadow display allowlist',
	};
}

export function isRedirectResponse(status, location) {
	return status >= 300 && status < 400 && typeof location === 'string' && location.length > 0;
}

function record(value, label) {
	if (typeof value !== 'object' || value === null || Array.isArray(value)) {
		throw new Error(`${label} must be an object`);
	}
	return value;
}

/** The receipt is supplied independently of the browser response by the rollout owner. */
export function parseShadowPairInputs(env, receiptText) {
	const consumerSourceSha = env.EXPECTED_SHADOW_CONSUMER_SHA?.trim();
	if (!SHA.test(consumerSourceSha ?? '')) {
		throw new Error('EXPECTED_SHADOW_CONSUMER_SHA must be an exact lowercase 40-character SHA');
	}
	let parsed;
	try {
		parsed = JSON.parse(receiptText);
	} catch {
		throw new Error('producer receipt must be valid JSON');
	}
	const receipt = record(parsed, 'producer receipt');
	if (!SHA.test(receipt.sourceSha ?? '')) {
		throw new Error('producer receipt sourceSha must be an exact lowercase 40-character SHA');
	}
	if (!HASH.test(receipt.brokerContentHash ?? '')) {
		throw new Error('producer receipt brokerContentHash must be a sha256 digest');
	}
	let receiptUrl;
	try {
		receiptUrl = new URL(receipt.receiptUrl);
	} catch {
		throw new Error('producer receipt receiptUrl must be an HTTPS evidence URL');
	}
	if (
		receiptUrl.protocol !== 'https:' ||
		receiptUrl.username ||
		receiptUrl.password ||
		receiptUrl.search ||
		receiptUrl.hash
	) {
		throw new Error('producer receipt receiptUrl must be HTTPS without credentials, query, or fragment');
	}
	return {
		consumerSourceSha,
		producerSourceSha: receipt.sourceSha,
		brokerContentHash: receipt.brokerContentHash,
		receiptUrl: receiptUrl.href,
	};
}

export function validateBrokerEvidence(value, expectedContentHash) {
	const stream = record(value, 'blog broker response');
	if (stream.schemaVersion !== 'tinyland.blog.broker-stream.v1' || stream.spokeRef !== 'jesssullivan-github-io') {
		throw new Error('blog broker response has unexpected schema or spoke');
	}
	const stable = { ...stream };
	delete stable.generatedAt;
	delete stable.contentHash;
	const computed = `sha256:${createHash('sha256').update(JSON.stringify({ ...stable, contentHash: '' })).digest('hex')}`;
	if (stream.contentHash !== computed) {
		throw new Error('live blog broker contentHash does not match its payload');
	}
	if (stream.contentHash !== expectedContentHash) {
		throw new Error('live blog broker contentHash does not match the independent producer receipt');
	}
	if (!Array.isArray(stream.posts) || stream.posts.length === 0) {
		throw new Error('live blog broker has no posts; article link cases are unqualified');
	}
	const posts = stream.posts.map((post) => record(post, 'broker post'));
	if (posts.some((post) => typeof post.slug !== 'string' || !SLUG.test(post.slug) ||
		typeof post.title !== 'string' || !post.title.trim() ||
		typeof post.contentMarkdown !== 'string' || !post.contentMarkdown.trim())) {
		throw new Error('blog broker contains an invalid slug, title, or body');
	}
	return posts;
}

export function staticRouteSlugs(value) {
	if (!Array.isArray(value)) throw new Error('static search index must be an array');
	const slugs = value
		.filter((entry) => record(entry, 'search index entry').published !== false)
		.map((entry) => entry.slug);
	if (slugs.length === 0 || slugs.some((slug) => typeof slug !== 'string' || !SLUG.test(slug))) {
		throw new Error('static search index has no valid published route slugs');
	}
	return new Set(slugs);
}

export function findBrokerOnlySlugs(brokerSlugs, routeSlugs) {
	return brokerSlugs.filter((slug) => !routeSlugs.has(slug));
}

export function findPulseMedia(value) {
	const snapshot = record(value, 'Pulse broker response');
	if (!Array.isArray(snapshot.items)) throw new Error('live Pulse snapshot has no items array');
	const mediaItem = snapshot.items.find((item) => item?.kind === 'note' && item.leadImage?.preview?.url);
	if (!mediaItem) return null;
	const image = mediaItem.leadImage;
	let previewUrl;
	try {
		previewUrl = new URL(image.preview.url);
	} catch {
		throw new Error('Pulse lead image lacks a reviewed public preview and alt text');
	}
	if (
		typeof image.alt !== 'string' || !image.alt.trim() ||
		previewUrl.origin !== 'https://hub.tinyland.dev' ||
		previewUrl.username || previewUrl.password ||
		!/^(?:\/media\/|\/images\/).+\.preview\.[a-z0-9]+$/i.test(previewUrl.pathname) ||
		previewUrl.search || previewUrl.hash
	) {
		throw new Error('Pulse lead image lacks a reviewed public preview and alt text');
	}
	return { alt: image.alt, url: image.preview.url, text: mediaItem.content || mediaItem.summary };
}

export function articleHref(href, slug) {
	if (!SLUG.test(slug)) throw new Error('invalid article slug');
	const parsed = new URL(href, SHADOW_ORIGIN);
	if (
		parsed.origin !== SHADOW_ORIGIN ||
		parsed.username || parsed.password ||
		parsed.pathname !== `/blog/${slug}` ||
		parsed.search ||
		parsed.hash
	) {
		throw new Error(`article link for ${slug} is not a canonical local route`);
	}
	return parsed.href;
}

export function assertShadowNavigationUrl(actual, expectedPath, expectedSearch = '') {
	const url = new URL(actual);
	if (
		url.origin !== SHADOW_ORIGIN || url.username || url.password ||
		url.pathname !== expectedPath || url.search !== expectedSearch || url.hash
	) {
		throw new Error(`${expectedPath} navigation ended at the wrong route`);
	}
}
