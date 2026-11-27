/**
 * Reads the verified projection that projection/step.mjs left in
 * src/lib/projection-data. It runs at build time only: $lib/server never
 * reaches the client bundle, and the note pages, the feeds and the sitemap
 * are prerendered from it.
 *
 * The directory is absent when no projection was accepted. The globs then
 * match nothing, and every export here is empty.
 */
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import {
	attachmentHeaderRules,
	headingNotes,
	notesFromEntries,
	parseEntry,
	type AttachmentRef,
	type HeadingNote,
	type Note,
} from '$lib/notes';

const entryFiles = import.meta.glob<unknown>('/src/lib/projection-data/posts/*.json', {
	eager: true,
	import: 'default',
});

const receiptFiles = import.meta.glob<string>('/src/lib/projection-data/projection.json', {
	eager: true,
	query: '?raw',
	import: 'default',
});

// Each file is checked as an xoxd-projection/v3 post file. A file of another
// shape fails the build here.
const collection = notesFromEntries(
	Object.keys(entryFiles)
		.sort()
		.map((file) => parseEntry(entryFiles[file], file)),
);

/** The notes, newest first. */
export const NOTES: readonly Note[] = Object.freeze(collection.notes);

/** The receipt bytes exactly as the module wrote them, or null when no projection was accepted. */
export const RECEIPT: string | null = receiptFiles['/src/lib/projection-data/projection.json'] ?? null;

export function findNote(slug: string): Note | undefined {
	return NOTES.find((note) => note.slug === slug);
}

/**
 * The notes that ask for the home page's heading stage on a day, newest
 * first. The day is YYYY-MM-DD in the site's own time zone. This is the one
 * function a page calls for the heading data. Each item carries its last
 * day, so a page built on an earlier day can check it again in the browser.
 * No page calls it yet.
 */
export function notesInHeading(day: string): HeadingNote[] {
	return headingNotes(NOTES, day);
}

/** The note attachment served at a site path, or undefined. */
export function findNoteAttachment(path: string): AttachmentRef | undefined {
	for (const note of NOTES) {
		const attachment = note.attachments.find((candidate) => candidate.path === path);
		if (attachment) return attachment;
	}
	return undefined;
}

/**
 * The _headers file that gives each note attachment its response headers on
 * Cloudflare Pages, or null when no note has an attachment. A build with no
 * such file is the build of today.
 */
export const ATTACHMENT_HEADER_RULES: string | null = NOTES.some((note) => note.attachments.length > 0)
	? attachmentHeaderRules(NOTES)
	: null;

/**
 * The bytes of a note attachment. The prerender runs in the project root, so
 * the blob is read from the file the ref names in the directory the step
 * wrote. Its sha256 and size are checked again, so a file changed after the
 * step never reaches the build output.
 */
export async function readNoteAttachment(attachment: AttachmentRef): Promise<ArrayBuffer> {
	const bytes = await readFile(join(process.cwd(), 'src', 'lib', 'projection-data', ...attachment.file.split('/')));
	if (bytes.byteLength !== attachment.bytes || createHash('sha256').update(bytes).digest('hex') !== attachment.sha256) {
		throw new Error(`attachment ${attachment.path} does not match its sha256 and size`);
	}
	return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}
