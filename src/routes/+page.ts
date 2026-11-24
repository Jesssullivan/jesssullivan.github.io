import { getPosts } from '$lib/posts';
import { loadPulseSnapshot } from '$lib/pulse/load';
import { createReaderCollection } from '$lib/reader/collection';
import type { PageLoad } from './$types';

export const prerender = true;

export const load: PageLoad = async ({ fetch }) => ({
	collection: createReaderCollection(await getPosts()),
	pulseSnapshot: await loadPulseSnapshot(fetch),
	// TIN-8657: null in production. A preview build (BLOG_HOME_STAGE=on) prerenders the new home page from here.
	// The build constant is read bare, so a production build drops the import below and the default page links none of its styles.
	home: __BLOG_HOME_STAGE__ ? await loadHome(fetch) : null,
});

async function loadHome(fetch: typeof globalThis.fetch) {
	const [{ default: Home }, { loadHomeStream }] = await Promise.all([import('$lib/components/home/Home.svelte'), import('$lib/home/load')]);
	return { Home, stream: await loadHomeStream(fetch) };
}
