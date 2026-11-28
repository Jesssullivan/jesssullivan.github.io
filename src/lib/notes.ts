/**
 * The notes collection: its types, the rule that decides which projection
 * entries this site builds, its order, its heading placement, the headers
 * its attachments are served with and how notes join the feeds.
 *
 * The data comes only from src/lib/projection-data, the directory that
 * projection/step.mjs writes after the xoxd_projection module verified the
 * hub's signed manifest for target "blog" under xoxd-projection/v3.
 * src/lib/server/notes.ts reads it. This module has no data of its own, so
 * the client bundle carries no note.
 *
 * The npm build cannot import the Bazel module, so the types below restate
 * the module's post data (its src/post.ts), and showsInHeading and
 * attachmentHeaders restate its two rules. notes.projection.test.ts fails
 * when either differs from the module's own function.
 */
import { feedHtml, pageHtml } from './note-html';

export const SITE_ORIGIN = 'https://transscendsurvival.org';

/** Notes per list page, the same as the /blog list. */
export const NOTES_PER_PAGE = 20;

/** One attachment as this site serves it. It is the module's AttachmentRef. */
export interface AttachmentRef {
	id: string;
	kind: string;
	mediaType: string;
	/** The site path the attachment is served at. */
	path: string;
	/** The verified blob in src/lib/projection-data: attachments/ and its sha256. */
	file: string;
	sha256: string;
	bytes: number;
	alt: string;
	/** The picture size in pixels of a video or an image, or null when the hub sends none. */
	width: number | null;
	height: number | null;
}

export interface NotePhoto {
	image: AttachmentRef | null;
	alt: string;
	caption: string | null;
}

/**
 * One body block, tagged by type. It is the module's ProjectedBlock. The page
 * shows the hub's rendered HTML. These typed blocks give the text
 * alternative of each media block to the feeds and the search index.
 */
export type NoteBlock =
	| { type: 'prose'; prose: string }
	| { type: 'math'; math: string; display: boolean }
	| { type: 'code'; code: string; lang: string }
	| { type: 'figure'; image: AttachmentRef | null; alt: string; caption: string | null; label: string | null; number: number | null }
	| { type: 'pdf'; pdf: AttachmentRef | null; title: string }
	| { type: 'video'; video: AttachmentRef | null; host: 'youtube' | 'file'; title: string }
	| { type: 'event'; event: string }
	| { type: 'booking'; booking: string }
	| { type: 'diagram'; picture: AttachmentRef | null; alt: string; description: string | null; lang: string; source: string }
	| { type: 'youtube'; videoId: string; title: string; poster: AttachmentRef | null; alt: string; player: string }
	| { type: 'recording'; audio: AttachmentRef | null; title: string; description: string | null }
	| { type: 'photos'; photos: NotePhoto[] }
	| { type: 'clip'; video: AttachmentRef | null; poster: AttachmentRef | null; alt: string; caption: string | null };

/** The block types of xoxd-projection/v3. A post file with any other type is refused. */
export const BLOCK_TYPES: readonly NoteBlock['type'][] = [
	'prose',
	'math',
	'code',
	'figure',
	'pdf',
	'video',
	'event',
	'booking',
	'diagram',
	'youtube',
	'recording',
	'photos',
	'clip',
];

/** The cover above the body. Its alt is empty when it is decorative, so a screen reader skips it. */
export interface NoteCover {
	image: AttachmentRef | null;
	alt: string;
	decorative: boolean;
}

/** The heading placement: the note asks for the home page's heading stage. */
export interface NoteHeading {
	/** The last calendar day it shows, YYYY-MM-DD, or null when it has none. */
	until: string | null;
}

/** A verified projection entry as posts/<id>.json holds it under xoxd-projection/v3. */
export interface ProjectionEntry {
	id: string;
	kind: string;
	slug: string;
	path: string;
	date: string;
	updated: string | null;
	title: string;
	summary: string;
	tags: string[];
	cover: NoteCover | null;
	heading: NoteHeading | null;
	attachments: AttachmentRef[];
	blocks: NoteBlock[];
	html: string;
}

/** A note as the pages, the feeds and the sitemap use it. */
export interface Note {
	id: string;
	slug: string;
	path: string;
	url: string;
	date: string;
	updated: string | null;
	title: string;
	summary: string;
	tags: string[];
	cover: NoteCover | null;
	heading: NoteHeading | null;
	attachments: AttachmentRef[];
	blocks: NoteBlock[];
	/** The body for the page: the hub's rendered HTML with search hints. */
	html: string;
	/** The body for a feed: each media block as its text alternative, with full addresses. */
	feedHtml: string;
}

/** What a page needs of a note. The feed body and the typed blocks stay on the server. */
export type NoteView = Pick<Note, 'slug' | 'path' | 'url' | 'date' | 'updated' | 'title' | 'summary' | 'tags' | 'cover' | 'html'>;

/** The part of a note a page is given. */
export function noteView({ slug, path, url, date, updated, title, summary, tags, cover, html }: Note): NoteView {
	return { slug, path, url, date, updated, title, summary, tags, cover, html };
}

export type Placement = 'note' | 'blog' | 'other';

const ATTACHMENT_FILE = /^attachments\/[0-9a-f]{64}$/;
const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const isText = (value: unknown): value is string => typeof value === 'string';
const isRef = (value: unknown): boolean =>
	isRecord(value) &&
	isText(value.id) &&
	isText(value.kind) &&
	isText(value.mediaType) &&
	isText(value.path) &&
	isText(value.sha256) &&
	isText(value.file) &&
	ATTACHMENT_FILE.test(value.file) &&
	value.file === `attachments/${value.sha256}` &&
	Number.isSafeInteger(value.bytes) &&
	isText(value.alt) &&
	(value.width === null || Number.isSafeInteger(value.width)) &&
	(value.height === null || Number.isSafeInteger(value.height));

/**
 * Reads one posts/<id>.json as an xoxd-projection/v3 post file, or throws.
 * A directory that an older build left holds files with no cover, heading
 * or blocks. The build then fails here and says to run the step again, so
 * such a file is never rendered as if it were whole.
 */
export function parseEntry(value: unknown, where: string): ProjectionEntry {
	const ok =
		isRecord(value) &&
		[value.id, value.kind, value.slug, value.path, value.date, value.title, value.summary, value.html].every(isText) &&
		(value.updated === null || isText(value.updated)) &&
		Array.isArray(value.tags) &&
		value.tags.every(isText) &&
		(value.cover === null ||
			(isRecord(value.cover) &&
				(value.cover.image === null || isRef(value.cover.image)) &&
				isText(value.cover.alt) &&
				typeof value.cover.decorative === 'boolean')) &&
		(value.heading === null || (isRecord(value.heading) && (value.heading.until === null || isText(value.heading.until)))) &&
		Array.isArray(value.attachments) &&
		value.attachments.every(isRef) &&
		Array.isArray(value.blocks) &&
		value.blocks.every((block) => isRecord(block) && (BLOCK_TYPES as readonly unknown[]).includes(block.type));
	if (!ok) {
		throw new Error(`${where} is not an xoxd-projection/v3 post file. Remove src/lib/projection-data and run the projection step again`);
	}
	return value as unknown as ProjectionEntry;
}

/**
 * Where this site places a verified entry. A note is an entry whose path is
 * /notes/<its slug>. An entry with a /blog path is an article. Articles stay
 * on their files in src/posts until the cutover, so this site ignores them
 * and a projection can never shadow or replace a post page. Every other
 * path is ignored too.
 */
export function placementOf(entry: Pick<ProjectionEntry, 'path' | 'slug'>): Placement {
	if (/^\/notes\/[^/]+$/.test(entry.path) && entry.path === `/notes/${entry.slug}`) return 'note';
	if (entry.path === '/blog' || entry.path.startsWith('/blog/')) return 'blog';
	return 'other';
}

/** Newest first by date, then by path, so equal dates keep one order. */
export function compareNotes(a: Pick<Note, 'date' | 'path'>, b: Pick<Note, 'date' | 'path'>): number {
	if (a.date !== b.date) return a.date < b.date ? 1 : -1;
	return a.path < b.path ? -1 : a.path > b.path ? 1 : 0;
}

/**
 * One verified entry as a note. The two bodies are written here, at build
 * time. A body whose HTML and typed blocks disagree throws, which fails the
 * build before any page is written.
 */
export function noteFromEntry(entry: ProjectionEntry, origin: string = SITE_ORIGIN): Note {
	const url = `${origin}${entry.path}`;
	// This site serves a note's files under the note's own path and nowhere else.
	for (const attachment of entry.attachments) {
		if (!attachment.path.startsWith(`${entry.path}/`)) {
			throw new Error(`attachment ${attachment.path} is not under ${entry.path}, so this site cannot serve it`);
		}
	}
	return {
		id: entry.id,
		slug: entry.slug,
		path: entry.path,
		url,
		date: entry.date,
		updated: entry.updated,
		title: entry.title,
		summary: entry.summary,
		tags: [...entry.tags],
		cover: entry.cover,
		heading: entry.heading,
		attachments: entry.attachments.map((attachment) => ({ ...attachment })),
		blocks: entry.blocks,
		html: pageHtml(entry.html, entry.blocks),
		feedHtml: feedHtml(entry.html, entry.blocks, origin, url),
	};
}

/** The notes among verified entries, in list order, and the count of each ignored kind of path. */
export function notesFromEntries(entries: ProjectionEntry[]): {
	notes: Note[];
	ignoredBlog: number;
	ignoredOther: number;
} {
	const notes: Note[] = [];
	let ignoredBlog = 0;
	let ignoredOther = 0;
	for (const entry of entries) {
		const placement = placementOf(entry);
		if (placement === 'blog') ignoredBlog += 1;
		else if (placement === 'other') ignoredOther += 1;
		else notes.push(noteFromEntry(entry));
	}
	notes.sort(compareNotes);
	return { notes, ignoredBlog, ignoredOther };
}

const DAY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/**
 * True when the note asks for the heading stage on this calendar day: it has
 * a heading placement, and the day is on or before its last day when it has
 * one. The day is YYYY-MM-DD in the site's own time zone. It is the module's
 * showsInHeading.
 */
export function showsInHeading(note: Pick<Note, 'heading'>, day: string): boolean {
	if (!DAY_PATTERN.test(day)) throw new TypeError(`${day} is not a YYYY-MM-DD day`);
	if (note.heading === null) return false;
	return note.heading.until === null || day <= note.heading.until;
}

/** A note that asks for the heading stage, as the home page needs it. */
export interface HeadingNote {
	slug: string;
	path: string;
	url: string;
	title: string;
	summary: string;
	date: string;
	/** The last day it shows, or null. A page built earlier can check it again in the browser. */
	until: string | null;
	cover: NoteCover | null;
}

/**
 * The notes that ask for the heading stage on a day, newest first. This is
 * the heading data of the collection. No page shows it yet.
 */
export function headingNotes(notes: readonly Note[], day: string): HeadingNote[] {
	return notes
		.filter((note) => showsInHeading(note, day))
		.map(({ slug, path, url, title, summary, date, heading, cover }) => ({
			slug,
			path,
			url,
			title,
			summary,
			date,
			until: heading?.until ?? null,
			cover,
		}));
}

/**
 * The response headers an attachment is served with: its exact media type,
 * nosniff, and a policy that runs nothing. A diagram picture needs all
 * three, since an SVG opened on its own is a document. A sound or a video
 * plays inline, so no attachment carries a Content-Disposition. It is the
 * module's attachmentHeaders.
 */
export function attachmentHeaders(attachment: Pick<AttachmentRef, 'mediaType'>): Record<string, string> {
	return {
		'Content-Type': attachment.mediaType,
		'X-Content-Type-Options': 'nosniff',
		'Content-Security-Policy': "default-src 'none'; sandbox",
	};
}

/**
 * The file types the static adapter's precompress step writes a .br and a
 * .gz copy of, from the list in @sveltejs/kit's builder. Of the attachment
 * kinds only a diagram picture, an .svg, is on it.
 */
const PRECOMPRESSED_EXTENSIONS = ['.html', '.js', '.mjs', '.json', '.css', '.svg', '.xml', '.wasm', '.txt', '.md', '.mdx'];

/**
 * The headers of a compressed copy the precompress step wrote next to an
 * attachment. Its bytes are brotli or gzip with no Content-Encoding, so it
 * goes out as opaque bytes, with the same nosniff and the same policy that
 * runs nothing as the attachment.
 */
function compressedCopyHeaders(): Record<string, string> {
	return attachmentHeaders({ mediaType: 'application/octet-stream' });
}

/** The most header rules Cloudflare Pages reads from one _headers file. */
export const HEADER_RULE_LIMIT = 100;

const RULE_PATH = /^(\/[A-Za-z0-9_][A-Za-z0-9_.-]*)+$/;
const RULE_VALUE = /^[\x20-\x7e]+$/;

/**
 * The _headers file for the note attachments: one rule per attachment path,
 * with the headers of attachmentHeaders. Cloudflare Pages reads it from the
 * build output and applies each rule to that one file. A path is matched
 * whole, so no rule reaches a page. The build fails when a path or a value
 * could break the file's format, and when there are more rules than the
 * host reads, since an attachment must never go out without its headers.
 * An attachment the precompress step compresses, a diagram .svg, also gets
 * a rule for its .br and .gz copies.
 */
export function attachmentHeaderRules(notes: readonly Pick<Note, 'attachments'>[]): string {
	const rules = new Map<string, Record<string, string>>();
	for (const note of notes) {
		for (const attachment of note.attachments) {
			if (!RULE_PATH.test(attachment.path)) throw new Error(`attachment path ${JSON.stringify(attachment.path)} cannot be a header rule`);
			const headers = attachmentHeaders(attachment);
			for (const value of Object.values(headers)) {
				if (!RULE_VALUE.test(value)) throw new Error(`attachment ${attachment.path} has a header value this file cannot hold`);
			}
			rules.set(attachment.path, headers);
			if (PRECOMPRESSED_EXTENSIONS.some((extension) => attachment.path.endsWith(extension))) {
				rules.set(`${attachment.path}.br`, compressedCopyHeaders());
				rules.set(`${attachment.path}.gz`, compressedCopyHeaders());
			}
		}
	}
	if (rules.size > HEADER_RULE_LIMIT) {
		throw new Error(
			`the notes need ${rules.size} header rules for their attachments and the host reads ${HEADER_RULE_LIMIT}, so some would be served without their headers`,
		);
	}
	return [...rules.keys()]
		.sort()
		.map(
			(path) =>
				`${path}\n${Object.entries(rules.get(path) ?? {})
					.map(([name, value]) => `  ${name}: ${value}`)
					.join('\n')}\n`,
		)
		.join('\n');
}

/** The date of a post or note as a sort key. Dates the site cannot read sort last. */
function dateKey(date: string): number {
	const time = new Date(date).getTime();
	return Number.isNaN(time) ? Number.NEGATIVE_INFINITY : time;
}

/**
 * Merges notes into the post list of a feed or the sitemap. The posts keep
 * their order exactly. Each note goes before the first post that is strictly
 * older, so a post wins a tie. With no notes the result is the post list, and
 * the feed bytes of today do not change. Nothing here reads a clock.
 */
export function mergeNotesIntoPosts<P extends { date: string }, N extends Pick<Note, 'date'>>(
	posts: readonly P[],
	notes: readonly N[],
): Array<{ kind: 'post'; item: P } | { kind: 'note'; item: N }> {
	const merged: Array<{ kind: 'post'; item: P } | { kind: 'note'; item: N }> = [];
	let next = 0;
	for (const post of posts) {
		while (next < notes.length && dateKey(notes[next].date) > dateKey(post.date)) {
			merged.push({ kind: 'note', item: notes[next] });
			next += 1;
		}
		merged.push({ kind: 'post', item: post });
	}
	for (; next < notes.length; next += 1) merged.push({ kind: 'note', item: notes[next] });
	return merged;
}

/** Text for an XML element or attribute. */
export function escapeXml(value: string): string {
	return value
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&apos;');
}

/** Text inside a CDATA section. A "]]>" in the text is split across two sections. */
export function cdata(value: string): string {
	return `<![CDATA[${value.replace(/]]>/g, ']]]]><![CDATA[>')}]]>`;
}

/**
 * One RSS item for a note. Its guid is the canonical URL. Its body is the
 * feed body: a media block is its text alternative, never a media element.
 */
export function noteRssItem(note: Note): string {
	return `<item>
      <title>${cdata(note.title)}</title>
      <link>${escapeXml(note.url)}</link>
      <guid isPermaLink="true">${escapeXml(note.url)}</guid>
      <pubDate>${new Date(note.date).toUTCString()}</pubDate>
      <description>${cdata(note.summary)}</description>
      <content:encoded>${cdata(note.feedHtml)}</content:encoded>
      ${note.tags.map((tag) => `<category>${escapeXml(tag)}</category>`).join('\n      ')}
    </item>`;
}

/** One JSON Feed item for a note. Its id is the canonical URL, and its body is the feed body. */
export function noteJsonFeedItem(note: Note): Record<string, unknown> {
	return {
		id: note.url,
		url: note.url,
		title: note.title,
		summary: note.summary,
		content_html: note.feedHtml,
		date_published: new Date(note.date).toISOString(),
		...(note.updated ? { date_modified: new Date(note.updated).toISOString() } : {}),
		tags: note.tags,
	};
}

/** One sitemap url element for a note. */
export function noteSitemapUrl(note: Note): string {
	return `<url>
    <loc>${escapeXml(note.url)}</loc>
    <lastmod>${new Date(note.updated ?? note.date).toISOString().split('T')[0]}</lastmod>
    <changefreq>yearly</changefreq>
    <priority>0.6</priority>
  </url>`;
}
