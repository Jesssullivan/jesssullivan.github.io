import { loadPulseSnapshot } from '#lib/pulse/load.js';
import type { PageLoad } from './$types';

export const prerender = true;

export const load: PageLoad = async ({ fetch }) => {
	const snapshot = await loadPulseSnapshot(fetch);
	return { snapshot };
};
