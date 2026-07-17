// TIN-2979: Pages retained the pre-hold asset after every supported purge path.
// Remove this guard in the same reviewed change that republishes the post.
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
