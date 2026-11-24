/**
 * The notes collection: its types, the rule that decides which projection
 * entries this site builds, its order and how notes join the feeds.
 *
 * The data comes only from src/lib/projection-data, the directory that
 * projection/step.mjs writes after the xoxd_projection module verified the
 * hub's signed manifest for target "blog". src/lib/server/notes.ts reads it.
 * This module has no data of its own, so the client bundle carries no note.
 */

export const SITE_ORIGIN = 'https://transscendsurvival.org';

/** Notes per list page, the same as the /blog list. */
export const NOTES_PER_PAGE = 20;

/** One attachment of a note, served at its own site path. */
export interface NoteAttachment {
	id: string;
	kind: string;
	mediaType: string;
	path: string;
	sha256: string;
	alt: string | null;
}

/** A verified projection entry as posts/<id>.json holds it. */
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
	attachments: NoteAttachment[];
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
	attachments: NoteAttachment[];
	html: string;
}

export type Placement = 'note' | 'blog' | 'other';

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
		else
			notes.push({
				id: entry.id,
				slug: entry.slug,
				path: entry.path,
				url: `${SITE_ORIGIN}${entry.path}`,
				date: entry.date,
				updated: entry.updated,
				title: entry.title,
				summary: entry.summary,
				tags: [...entry.tags],
				attachments: entry.attachments.map((attachment) => ({ ...attachment })),
				html: entry.html,
			});
	}
	notes.sort(compareNotes);
	return { notes, ignoredBlog, ignoredOther };
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

/** One RSS item for a note. Its guid is the canonical URL. */
export function noteRssItem(note: Note): string {
	return `<item>
      <title>${cdata(note.title)}</title>
      <link>${escapeXml(note.url)}</link>
      <guid isPermaLink="true">${escapeXml(note.url)}</guid>
      <pubDate>${new Date(note.date).toUTCString()}</pubDate>
      <description>${cdata(note.summary)}</description>
      <content:encoded>${cdata(note.html)}</content:encoded>
      ${note.tags.map((tag) => `<category>${escapeXml(tag)}</category>`).join('\n      ')}
    </item>`;
}

/** One JSON Feed item for a note. Its id is the canonical URL. */
export function noteJsonFeedItem(note: Note): Record<string, unknown> {
	return {
		id: note.url,
		url: note.url,
		title: note.title,
		summary: note.summary,
		content_html: note.html,
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
