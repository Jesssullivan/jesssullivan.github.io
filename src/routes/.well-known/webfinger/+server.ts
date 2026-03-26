export const prerender = true;

const WEBFINGER_RESPONSE = {
	subject: 'acct:jess@transscendsurvival.org',
	aliases: ['https://tinyland.dev/@jesssullivan'],
	links: [
		{
			rel: 'self',
			type: 'application/activity+json',
			href: 'https://tinyland.dev/@jesssullivan'
		},
		{
			rel: 'http://webfinger.net/rel/profile-page',
			type: 'text/html',
			href: 'https://transscendsurvival.org'
		},
		{
			rel: 'http://ostatus.org/schema/1.0/subscribe',
			template: 'https://tinyland.dev/authorize_interaction?uri={uri}'
		}
	]
};

export function GET() {
	return new Response(JSON.stringify(WEBFINGER_RESPONSE), {
		headers: {
			'Content-Type': 'application/jrd+json',
			'Access-Control-Allow-Origin': '*',
			'Cache-Control': 'max-age=86400'
		}
	});
}
