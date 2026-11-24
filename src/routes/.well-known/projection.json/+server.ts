import { error } from '@sveltejs/kit';
import { RECEIPT } from '$lib/server/notes';

// The receipt of the last accepted projection, byte for byte as the
// xoxd_projection module wrote it. A build with no dispatch inputs reads it
// from the live site to rebuild the same manifest. With no projection the
// route is not prerendered, so the host answers 404, which tells that build
// that nothing was accepted yet.
export const prerender = RECEIPT !== null;

export function GET() {
	if (RECEIPT === null) error(404, 'Not found');
	return new Response(RECEIPT, {
		headers: {
			'Content-Type': 'application/json',
			'Cache-Control': 'max-age=0, s-maxage=60',
		},
	});
}
