import { getPosts } from '$lib/posts';
import { loadPulseSnapshot } from '$lib/pulse/load';
import { createReaderCollection } from '$lib/reader/collection';
import type { PageLoad } from './$types';

export const prerender = true;

export const load: PageLoad = async ({ fetch }) => ({
	collection: createReaderCollection(await getPosts()),
	pulseSnapshot: await loadPulseSnapshot(fetch),
});
