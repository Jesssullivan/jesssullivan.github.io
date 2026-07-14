export const prerender = true;

// This prerendered fallback cannot inspect WebFinger's required `resource`
// query parameter and is not a standards-compliant resolver (TIN-2880). The
// blog is not an ActivityPub authority (TIN-1456 / TIN-1537). The JRD points
// at the hub actor projection; endpoint shape is not delivery proof.
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
			href: HUB_ACTOR
		},
		{
			rel: 'http://webfinger.net/rel/profile-page',
			type: 'text/html',
			href: 'https://transscendsurvival.org'
		},
		{
			rel: 'http://ostatus.org/schema/1.0/subscribe',
			template: HUB_AUTHORIZE_INTERACTION
		}
	]
};

export function GET() {
	return new Response(JSON.stringify(_WEBFINGER_RESPONSE), {
		headers: {
			'Content-Type': 'application/jrd+json',
			'Access-Control-Allow-Origin': '*',
			'Cache-Control': 'max-age=86400'
		}
	});
}
