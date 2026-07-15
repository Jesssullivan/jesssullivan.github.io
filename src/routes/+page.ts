import { getPosts } from '$lib/posts';
import { loadPulseSnapshot } from '$lib/pulse/load';
import type { PublicPulseItem } from '@blog/pulse-core/schema';
import type { PageLoad } from './$types';

// SSR-first, fail-soft. Posts come from the build-time static index (always at
// least as fresh as the deploy). The pulse snapshot is a best-effort enrichment:
// a missing or invalid snapshot degrades to an empty rail — the reader still
// renders. Prerendering is inherited from the root +layout.ts.
export const load: PageLoad = async ({ fetch }) => {
	const posts = await getPosts();

	let pulseItems: PublicPulseItem[] = [];
	try {
		pulseItems = (await loadPulseSnapshot(fetch)).items;
	} catch {
		pulseItems = [];
	}

	return { posts, pulseItems };
};
