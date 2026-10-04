import { getPosts } from '$lib/posts';
import { loadPulseSnapshot } from '$lib/pulse/load';
import { createHomeReaderCollection } from '$lib/reader/homeProjection';
import type { PageLoad } from './$types';
import publicationHoldsData from '../../static/blog-publication-holds.json';

export const prerender = true;

const publicationHolds = new Set(publicationHoldsData as string[]);

export const load: PageLoad = async ({ fetch }) => ({
	collection: createHomeReaderCollection(await getPosts(), [], publicationHolds),
	pulseSnapshot: await loadPulseSnapshot(fetch),
	publicationHolds: publicationHoldsData as string[],
});
