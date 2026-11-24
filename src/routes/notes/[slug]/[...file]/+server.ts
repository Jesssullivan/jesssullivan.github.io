import { error } from '@sveltejs/kit';
import { NOTES, findNoteAttachment, readNoteAttachment } from '$lib/server/notes';
import type { EntryGenerator, RequestHandler } from './$types';

// A note's attachments are served at the site paths its HTML links to. The
// route is prerendered only when some note has an attachment, since a
// prerendered route with no entries fails the build.
export const prerender = NOTES.some((note) => note.attachments.length > 0);

export const entries: EntryGenerator = () =>
	NOTES.flatMap((note) =>
		note.attachments.map((attachment) => ({
			slug: note.slug,
			file: attachment.path.slice(`${note.path}/`.length),
		})),
	);

export const GET: RequestHandler = async ({ url }) => {
	const attachment = findNoteAttachment(url.pathname);
	if (!attachment) error(404, 'Not found');
	return new Response(await readNoteAttachment(attachment), {
		headers: { 'Content-Type': attachment.mediaType },
	});
};
