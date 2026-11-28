import { error } from '@sveltejs/kit';
import { attachmentHeaders } from '$lib/notes';
import { NOTES, findNoteAttachment, readNoteAttachment } from '$lib/server/notes';
import type { EntryGenerator, RequestHandler } from './$types';

// A note's attachments are served at the site paths its HTML names. The
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

// The headers are the ones the module's attachmentHeaders gives: the exact
// media type, nosniff and a policy that runs nothing. A server that runs this
// route sends them. The static host does not run it, so the same headers go
// out through the _headers file that the /_headers route writes.
export const GET: RequestHandler = async ({ url }) => {
	const attachment = findNoteAttachment(url.pathname);
	if (!attachment) error(404, 'Not found');
	return new Response(await readNoteAttachment(attachment), { headers: attachmentHeaders(attachment) });
};
