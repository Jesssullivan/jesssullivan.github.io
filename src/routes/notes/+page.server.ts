import { error } from '@sveltejs/kit';
import { NOTES } from '$lib/server/notes';
import type { PageServerLoad } from './$types';

// With no verified notes the list is not prerendered, so the static site has
// no /notes file and the host answers its normal not-found page.
export const prerender = NOTES.length > 0;

export const load: PageServerLoad = () => {
	if (NOTES.length === 0) error(404, 'Not found');
	return {
		notes: NOTES.map(({ slug, path, date, updated, title, summary, tags }) => ({
			slug,
			path,
			date,
			updated,
			title,
			summary,
			tags,
		})),
	};
};
