import { getPosts } from '#lib/posts.js';
import { loadPulseSnapshot } from '#lib/pulse/load.js';
import { createReaderCollection } from '#lib/reader/collection.js';
import type { PageLoad } from './$types';

export const prerender = true;

export const load: PageLoad = async ({ fetch }) => ({
	collection: createReaderCollection(await getPosts()),
	pulseSnapshot: await loadPulseSnapshot(fetch),
});
