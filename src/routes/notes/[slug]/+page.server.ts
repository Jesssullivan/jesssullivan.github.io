import { error } from '@sveltejs/kit';
import { noteView } from '$lib/notes';
import { NOTES, findNote } from '$lib/server/notes';
import type { EntryGenerator, PageServerLoad } from './$types';

export const prerender = NOTES.length > 0;

export const entries: EntryGenerator = () => NOTES.map(({ slug }) => ({ slug }));

export const load: PageServerLoad = ({ params }) => {
	const note = findNote(params.slug);
	if (!note) error(404, 'Not found');
	const index = NOTES.indexOf(note);
	const newer = index > 0 ? NOTES[index - 1] : null;
	const older = index < NOTES.length - 1 ? NOTES[index + 1] : null;
	return {
		// The page gets what it shows. The feed body and the typed blocks stay on the server.
		note: noteView(note),
		newer: newer ? { path: newer.path, title: newer.title } : null,
		older: older ? { path: older.path, title: older.title } : null,
	};
};
