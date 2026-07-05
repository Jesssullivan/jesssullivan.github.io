import { getPosts } from '$lib/posts';
import { loadPulseSnapshot } from '$lib/pulse/load';
import { blendStream } from '$lib/stream/blend';
import type { PublicPulseItem } from '@blog/pulse-core/schema';
import type { PageLoad } from './$types';

export const prerender = true;

// Shadow ingestion surface: blend published long-form posts with the public
// pulse snapshot into one reverse-chronological, tier-weighted timeline. The
// pulse snapshot is best-effort — if it is missing or fails validation the
// stream still prerenders from posts alone (graceful, never blocks the build).
export const load: PageLoad = async ({ fetch }) => {
	const posts = await getPosts();

	let pulseItems: PublicPulseItem[] = [];
	try {
		const snapshot = await loadPulseSnapshot(fetch);
		pulseItems = snapshot.items;
	} catch {
		pulseItems = [];
	}

	return { items: blendStream(posts, pulseItems) };
};
