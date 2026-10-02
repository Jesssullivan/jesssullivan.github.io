import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import {
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

const consumerSha = 'a'.repeat(40);
const producerSha = 'b'.repeat(40);
const brokerContentHash = `sha256:${'c'.repeat(64)}`;
const receipt = JSON.stringify({
	sourceSha: producerSha,
	brokerContentHash,
	receiptUrl: 'https://github.com/xoxd-ai/tinyland.dev/actions/runs/12345',
});
const env = { EXPECTED_SHADOW_CONSUMER_SHA: consumerSha };

assert.deepEqual(parseShadowPairInputs(env, receipt), {
	consumerSourceSha: consumerSha,
	producerSourceSha: producerSha,
	brokerContentHash,
	receiptUrl: 'https://github.com/xoxd-ai/tinyland.dev/actions/runs/12345',
});
assert.throws(() => parseShadowPairInputs({}, receipt), /EXPECTED_SHADOW_CONSUMER_SHA/);
assert.throws(() => parseShadowPairInputs(env, '{}'), /sourceSha/);
assert.throws(
	() => parseShadowPairInputs(env, JSON.stringify({ sourceSha: producerSha, brokerContentHash, receiptUrl: 'https://example.com/?token=secret' })),
	/without credentials, query, or fragment/,
);

const brokerBody = {
	schemaVersion: 'tinyland.blog.broker-stream.v1',
	spokeRef: 'jesssullivan-github-io',
	generatedAt: '2026-09-25T03:00:00Z',
	posts: [
		{ slug: 'static-post', title: 'Static post', contentMarkdown: 'An authored static post.' },
		{ slug: 'broker-only-post', title: 'Broker-only post', contentMarkdown: 'An authored broker-only post.' },
	],
};
function hashBrokerBody(body) {
	return `sha256:${createHash('sha256').update(JSON.stringify({ schemaVersion: body.schemaVersion,
		spokeRef: body.spokeRef, posts: body.posts, contentHash: '' })).digest('hex')}`;
}
const producerHash = hashBrokerBody(brokerBody);
const broker = { ...brokerBody, contentHash: producerHash };
const brokerPosts = validateBrokerEvidence(broker, producerHash);
assert.deepEqual(brokerPosts.map((post) => post.slug), ['static-post', 'broker-only-post']);
assert.throws(() => validateBrokerEvidence(broker, `sha256:${'d'.repeat(64)}`), /independent producer receipt/);
assert.throws(
	() => validateBrokerEvidence({ ...broker, posts: [...broker.posts, { slug: 'extra', title: 'Extra', contentMarkdown: 'Changed.' }] }, producerHash),
	/payload/,
);
const emptyBroker = { ...brokerBody, posts: [] };
assert.throws(() => validateBrokerEvidence({ ...emptyBroker, contentHash: hashBrokerBody(emptyBroker) }, hashBrokerBody(emptyBroker)), /no posts/);

const staticSlugs = staticRouteSlugs([
	{ slug: 'static-post', published: true },
	{ slug: 'held-post', published: false },
]);
assert.deepEqual([...staticSlugs], ['static-post']);
assert.deepEqual(findBrokerOnlySlugs(brokerPosts.map((post) => post.slug), staticSlugs), ['broker-only-post']);
assert.deepEqual(findBrokerOnlySlugs(['static-post'], staticSlugs), [], 'fully prerendered corpus leaves optional case unexercised');
assert.throws(() => staticRouteSlugs([]), /no valid published route slugs/);

const image = {
	alt: 'A reviewed owl',
	preview: { url: 'https://hub.tinyland.dev/media/pulse/notes/owl.preview.webp' },
};
assert.deepEqual(findPulseMedia({ items: [{ kind: 'note', content: 'Owl note.', leadImage: image }] }), {
	alt: 'A reviewed owl',
	url: image.preview.url,
	text: 'Owl note.',
});
assert.equal(findPulseMedia({ items: [] }), null, 'empty public Pulse has no optional media case');
assert.equal(findPulseMedia({ items: [{ kind: 'note', content: 'Text only.' }] }), null, 'text-only Pulse has no optional media case');
assert.throws(
	() => findPulseMedia({ items: [{ kind: 'note', leadImage: { ...image, preview: { url: 'https://other.invalid/owl.preview.webp' } } }] }),
	/reviewed public preview/,
);

assert.equal(articleHref('/blog/static-post', 'static-post'), 'https://tss.tinyland.dev/blog/static-post');
assert.throws(() => articleHref('https://transscendsurvival.org/blog/static-post', 'static-post'), /canonical local route/);
assert.throws(() => articleHref('https://user@tss.tinyland.dev/blog/static-post', 'static-post'), /canonical local route/);
assert.throws(() => articleHref('/blog/static-post?preview=1', 'static-post'), /canonical local route/);
assert.doesNotThrow(() => assertShadowNavigationUrl('https://tss.tinyland.dev/blog/static-post', '/blog/static-post'));
assert.throws(() => assertShadowNavigationUrl('https://transscendsurvival.org/blog/static-post', '/blog/static-post'), /wrong route/);
assert.throws(() => assertShadowNavigationUrl('https://tss.tinyland.dev/blog/other', '/blog/static-post'), /wrong route/);
assert.throws(() => assertShadowNavigationUrl('https://tss.tinyland.dev/blog/static-post?next=1', '/blog/static-post'), /wrong route/);
assert.equal(shadowRequestDecision('https://tss.tinyland.dev/blog/static-post').allowed, true);
assert.equal(shadowRequestDecision('https://transscendsurvival.org/blog/static-post').forbidden, true);
assert.equal(shadowRequestDecision('https://tss.tinyland.dev/ap/actors/jesssullivan').forbidden, true);
assert.equal(shadowRequestDecision('https://hub.tinyland.dev/.well-known/webfinger').allowed, false);
assert.equal(shadowRequestDecision('https://user@tss.tinyland.dev/blog').allowed, false);
assert.equal(shadowRequestDecision('https://tss.tinyland.dev/', 'POST').allowed, false);
assert.equal(isRedirectResponse(302, 'https://transscendsurvival.org/blog'), true);
assert.equal(isRedirectResponse(307, '/other-shadow-route'), true);
assert.equal(isRedirectResponse(304, undefined), false);

console.log('Shadow reader pair contract tests passed.');
