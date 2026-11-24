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
import { notesFromEntries, type Note, type NoteAttachment, type ProjectionEntry } from '$lib/notes';

const entryFiles = import.meta.glob<ProjectionEntry>('/src/lib/projection-data/posts/*.json', {
	eager: true,
	import: 'default',
});

const receiptFiles = import.meta.glob<string>('/src/lib/projection-data/projection.json', {
	eager: true,
	query: '?raw',
	import: 'default',
});

const collection = notesFromEntries(
	Object.keys(entryFiles)
		.sort()
		.map((file) => entryFiles[file]),
);

/** The notes, newest first. */
export const NOTES: readonly Note[] = Object.freeze(collection.notes);

/** The receipt bytes exactly as the module wrote them, or null when no projection was accepted. */
export const RECEIPT: string | null = receiptFiles['/src/lib/projection-data/projection.json'] ?? null;

export function findNote(slug: string): Note | undefined {
	return NOTES.find((note) => note.slug === slug);
}

/** The note attachment served at a site path, or undefined. */
export function findNoteAttachment(path: string): NoteAttachment | undefined {
	for (const note of NOTES) {
		const attachment = note.attachments.find((candidate) => candidate.path === path);
		if (attachment) return attachment;
	}
	return undefined;
}

/**
 * The bytes of a note attachment. The prerender runs in the project root, so
 * the blob is read from the directory the step wrote. Its sha256 is checked
 * again, so a file changed after the step never reaches the build output.
 */
export async function readNoteAttachment(attachment: NoteAttachment): Promise<ArrayBuffer> {
	const bytes = await readFile(join(process.cwd(), 'src', 'lib', 'projection-data', 'attachments', attachment.sha256));
	if (createHash('sha256').update(bytes).digest('hex') !== attachment.sha256) {
		throw new Error(`attachment ${attachment.path} does not match its sha256`);
	}
	return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}
