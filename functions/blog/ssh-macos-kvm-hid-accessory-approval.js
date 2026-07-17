export function onRequest() {
	return new Response('Not Found\n', {
		status: 404,
		headers: {
			'Cache-Control': 'no-store',
			'Content-Type': 'text/plain; charset=utf-8',
			'X-Robots-Tag': 'noindex, nofollow'
		}
	});
}
