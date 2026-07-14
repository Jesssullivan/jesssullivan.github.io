export const prerender = true;

// This is a prerendered, single-identity discovery document, not a general
// resource-aware WebFinger resolver. The blog (transscendsurvival.org) is NOT
// an ActivityPub authority and must never present itself as one (TIN-1456 /
// TIN-1537). The canonical actor lives on the hub projection broker
// (hub.tinyland.dev), which owns the AP identity, inbox/outbox, and follower
// ledger. This JRD therefore delegates every AP-authority link to the hub
// actor; only the human-facing profile page stays on the blog domain.
const HUB_ACTOR = 'https://hub.tinyland.dev/@jesssullivan';
const HUB_AUTHORIZE_INTERACTION = 'https://hub.tinyland.dev/authorize_interaction?uri={uri}';

// `_`-prefixed so SvelteKit's endpoint export validator allows it (only
// GET/POST/... or `_`-prefixed exports are permitted from a +server module).
export const _WEBFINGER_RESPONSE = {
	subject: 'acct:jess@transscendsurvival.org',
	aliases: [HUB_ACTOR],
	links: [
		{
			rel: 'self',
			type: 'application/activity+json',
			href: HUB_ACTOR,
		},
		{
			rel: 'http://webfinger.net/rel/profile-page',
			type: 'text/html',
			href: 'https://transscendsurvival.org',
		},
		{
			rel: 'http://ostatus.org/schema/1.0/subscribe',
			template: HUB_AUTHORIZE_INTERACTION,
		},
	],
};

export function GET() {
	return new Response(JSON.stringify(_WEBFINGER_RESPONSE), {
		headers: {
			'Content-Type': 'application/jrd+json',
			'Access-Control-Allow-Origin': '*',
			'Cache-Control': 'max-age=86400',
		},
	});
}
