import { loadActivities } from '$lib/activitypub/fetch';
import type { PageLoad } from './$types';

export const prerender = true;

export const load: PageLoad = async ({ fetch }) => {
	const activities = await loadActivities(fetch);
	return { activities };
};
