/**
 * The home stream (TIN-8657, ruling RM48): one flow, newest first, built from
 * what the site has. Every source maps into one item type here, and nothing in
 * this file reads a file, a clock or the network. The generator in
 * scripts/generate-home-stream.mts supplies the sources.
 */

export const STREAM_KINDS = ['note', 'article', 'announcement', 'photos', 'recording', 'video'] as const;
export type StreamKind = (typeof STREAM_KINDS)[number];
export type StreamSource = 'posts' | 'pulse' | 'gallery' | 'music' | 'hub';

export interface StreamImage {
	type: 'image';
	src: string;
	width: number;
	height: number;
	alt: string;
	webp?: string;
	avif?: string;
}
/** A SoundCloud track. `src` is the track page. */
export interface StreamSound {
	type: 'soundcloud';
	src: string;
}
/** A YouTube video. `src` is the video id. */
export interface StreamFilm {
	type: 'youtube';
	src: string;
	poster?: StreamImage;
}
export type StreamMedia = StreamImage | StreamSound | StreamFilm;

export interface StreamItem {
	id: string;
	kind: StreamKind;
	/** An ISO date or timestamp. */
	date: string;
	title: string;
	summary: string;
	url: string;
	media: StreamMedia[];
	tags: string[];
	source: StreamSource;
	/** Reading time in minutes, for writing. */
	minutes?: number;
	/** Photographs in the set beyond the ones in `media`. */
	more?: number;
	/** Placed in the heading stage. The publishing hub sets this. */
	heading?: boolean;
}

export interface StreamFile {
	version: 1;
	items: StreamItem[];
	/** Ids of the items shown as scenes in the heading, in order. */
	heading: string[];
	counts: Record<StreamKind, number>;
	leftOut: {
		/** Gallery photographs that no public post uses, so they have no date. */
		photographsWithoutPost: number;
		/** Videos on the Music page whose title states no day. */
		videosWithoutDate: number;
		/** Posts whose cover is a shared photograph their own text never uses. */
		coversNotOwn: number;
		/** Items from any source with no usable date. */
		undated: number;
	};
}

export interface PostInput {
	slug: string;
	date: string;
	title: string;
	description: string;
	tags: string[];
	minutes: number;
	featureImage?: string;
	/** The post's Markdown, without frontmatter. */
	body: string;
}

export interface GalleryInput {
	src: string;
	webp: string | null;
	width: number;
	height: number;
	post_slug: string | null;
	post_title: string | null;
}

export interface PulseInput {
	id: string;
	kind: 'note' | 'bird_sighting';
	occurredAt: string;
	summary: string;
	content: string;
	tags: string[];
	birdSighting?: { commonName: string; scientificName: string; count: number; placeLabel: string };
	leadImage?: { alt: string; preview: { url: string; width: number; height: number } };
}

export interface TrackInput {
	title: string;
	url: string;
	iso: string;
	note: string;
}

export interface VideoInput {
	id: string;
	title: string;
	iso?: string;
}

/**
 * An item from the publishing hub's projection. It already has the stream's
 * shape. A tombstone removes the item with the same id, whatever its source.
 */
export type HubInput = (Omit<StreamItem, 'source'> & { tombstone?: false }) | { id: string; tombstone: true };

/** What the caller knows about an image file: its size and its smaller formats. */
export type ImageFacts = (src: string) => { width: number; height: number; webp?: string; avif?: string } | null;

export interface StreamSources {
	posts: PostInput[];
	gallery: GalleryInput[];
	pulse: PulseInput[];
	tracks: TrackInput[];
	videos: VideoInput[];
	hub?: HubInput[];
	image: ImageFacts;
	/** A committed poster for a video id, when there is one. */
	poster?: (videoId: string) => string | null;
}

/** How many photographs of a set travel in the data file. The rest are counted in `more`. */
export const SET_SIZE = 5;

const ISO_DATE = /^\d{4}-\d{2}-\d{2}(?:T[\d:.]+(?:Z|[+-]\d{2}:\d{2})?)?$/;
export const isDated = (date: string) => ISO_DATE.test(date) && !Number.isNaN(Date.parse(date.length === 10 ? `${date}T00:00:00Z` : date));

const stem = (path: string) => (path.split('/').pop() ?? '').replace(/\.[a-z0-9]+$/i, '').toLowerCase();
const escapeRe = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * The cover rule. Many posts share a small pool of cover photographs that have
 * nothing to do with them. A cover is the post's own only when the post's text
 * uses the same image file, in any of its formats.
 */
export function ownsImage(body: string, image: string | undefined): boolean {
	if (!image) return false;
	const name = stem(image);
	if (!name) return false;
	return new RegExp(`/images/posts/${escapeRe(name)}\\.(?:jpe?g|png|gif|webp|avif)\\b`, 'i').test(body);
}

/** The alt text the post gives an image, or nothing. */
export function altIn(body: string, image: string): string {
	const match = new RegExp(`!\\[([^\\]]*)\\]\\(/images/posts/${escapeRe(stem(image))}\\.[a-z0-9]+\\)`, 'i').exec(body);
	return match ? match[1].trim() : '';
}

function picture(src: string, alt: string, image: ImageFacts, fallback?: { width: number; height: number; webp?: string | null }): StreamImage | null {
	const facts = image(src);
	const width = facts?.width || fallback?.width || 0;
	const height = facts?.height || fallback?.height || 0;
	if (!width || !height) return null;
	const webp = facts?.webp ?? fallback?.webp ?? undefined;
	return {
		type: 'image',
		src,
		width,
		height,
		alt,
		...(webp && webp !== src ? { webp } : {}),
		...(facts?.avif ? { avif: facts.avif } : {}),
	};
}

// At the same date an item stays beside the post it belongs to, with the writing first.
const RANK: Record<StreamKind, number> = { announcement: 0, note: 1, article: 2, photos: 3, recording: 4, video: 5 };

interface Placed {
	item: StreamItem;
	anchor: string;
}

/** Newest first. Ties are settled by the linked post, then the kind, then the id, so the order never depends on input order. */
export function compareStream(a: Placed, b: Placed): number {
	return (
		b.item.date.slice(0, 10).localeCompare(a.item.date.slice(0, 10)) ||
		b.item.date.localeCompare(a.item.date) ||
		a.anchor.localeCompare(b.anchor) ||
		RANK[a.item.kind] - RANK[b.item.kind] ||
		a.item.id.localeCompare(b.item.id)
	);
}

export function buildStream(sources: StreamSources): StreamFile {
	const placed: Placed[] = [];
	const leftOut = { photographsWithoutPost: 0, videosWithoutDate: 0, coversNotOwn: 0, undated: 0 };
	const posts = new Map(sources.posts.map((post) => [post.slug, post]));

	// Photographs: one set per post, in the order the post shows them. A photograph no public post uses has no date.
	const sets = new Map<string, GalleryInput[]>();
	for (const photo of sources.gallery) {
		const post = photo.post_slug ? posts.get(photo.post_slug) : undefined;
		if (!post || !isDated(post.date)) {
			leftOut.photographsWithoutPost += 1;
			continue;
		}
		sets.set(post.slug, [...(sets.get(post.slug) ?? []), photo]);
	}

	for (const post of sources.posts) {
		if (!isDated(post.date)) {
			leftOut.undated += 1;
			continue;
		}
		const media: StreamMedia[] = [];
		// The photographs of a post run as their own item, so the article does not repeat one of them.
		if (!sets.has(post.slug) && post.featureImage) {
			const own = ownsImage(post.body, post.featureImage) ? picture(post.featureImage, altIn(post.body, post.featureImage), sources.image) : null;
			if (own) media.push(own);
			else leftOut.coversNotOwn += 1;
		}
		placed.push({
			anchor: post.slug,
			item: { id: `post:${post.slug}`, kind: 'article', date: post.date, title: post.title, summary: post.description, url: `/blog/${post.slug}`, media, tags: post.tags, source: 'posts', minutes: post.minutes },
		});
	}

	for (const [slug, photos] of sets) {
		const post = posts.get(slug)!;
		const body = post.body.toLowerCase();
		const at = (photo: GalleryInput) => {
			const index = body.indexOf(`/images/posts/${stem(photo.src)}.`);
			return index < 0 ? Number.MAX_SAFE_INTEGER : index;
		};
		const ordered = [...photos].sort((a, b) => at(a) - at(b) || a.src.localeCompare(b.src));
		const images = ordered.map((photo) => picture(photo.src, altIn(post.body, photo.src), sources.image, photo)).filter((image): image is StreamImage => image !== null);
		if (!images.length) continue;
		placed.push({
			anchor: slug,
			item: {
				id: `photos:${slug}`,
				kind: 'photos',
				date: post.date,
				title: post.title,
				summary: '',
				url: `/blog/${slug}`,
				media: images.slice(0, SET_SIZE),
				tags: post.tags,
				source: 'gallery',
				...(images.length > SET_SIZE ? { more: images.length - SET_SIZE } : {}),
			},
		});
	}

	for (const note of sources.pulse) {
		if (!isDated(note.occurredAt)) {
			leftOut.undated += 1;
			continue;
		}
		const lead = note.leadImage;
		placed.push({
			anchor: `pulse:${note.id}`,
			item: {
				id: `pulse:${note.id}`,
				kind: 'note',
				date: note.occurredAt,
				title: note.birdSighting ? note.birdSighting.commonName : '',
				summary: note.content || note.summary,
				url: '/pulse',
				media: lead ? [{ type: 'image', src: lead.preview.url, width: lead.preview.width, height: lead.preview.height, alt: lead.alt }] : [],
				tags: note.tags,
				source: 'pulse',
			},
		});
	}

	for (const track of sources.tracks) {
		if (!isDated(track.iso)) {
			leftOut.undated += 1;
			continue;
		}
		placed.push({
			anchor: `track:${track.url}`,
			item: { id: `track:${track.url.split('/').pop()}`, kind: 'recording', date: track.iso, title: track.title, summary: track.note, url: track.url, media: [{ type: 'soundcloud', src: track.url }], tags: [], source: 'music' },
		});
	}

	for (const video of sources.videos) {
		if (!video.iso || !isDated(video.iso)) {
			leftOut.videosWithoutDate += 1;
			continue;
		}
		const posterSrc = sources.poster?.(video.id) ?? null;
		const poster = posterSrc ? picture(posterSrc, '', sources.image) : null;
		placed.push({
			anchor: `video:${video.id}`,
			item: {
				id: `video:${video.id}`,
				kind: 'video',
				date: video.iso,
				title: video.title,
				summary: '',
				url: `https://www.youtube.com/watch?v=${video.id}`,
				media: [{ type: 'youtube', src: video.id, ...(poster ? { poster } : {}) }],
				tags: [],
				source: 'music',
			},
		});
	}

	// The hub joins last: its item replaces a local one with the same id, and a tombstone removes it.
	for (const entry of sources.hub ?? []) {
		const index = placed.findIndex((candidate) => candidate.item.id === entry.id);
		if (index >= 0) placed.splice(index, 1);
		if (entry.tombstone) continue;
		if (!isDated(entry.date)) {
			leftOut.undated += 1;
			continue;
		}
		const item: StreamItem = { ...entry, source: 'hub' };
		delete (item as { tombstone?: boolean }).tombstone;
		placed.push({ anchor: entry.url.startsWith('/blog/') ? entry.url.slice('/blog/'.length) : entry.id, item });
	}

	placed.sort(compareStream);
	const items = placed.map((entry) => entry.item);
	const counts = Object.fromEntries(STREAM_KINDS.map((kind) => [kind, items.filter((item) => item.kind === kind).length])) as Record<StreamKind, number>;
	return { version: 1, items, heading: headingOf(items), counts, leftOut };
}

/**
 * What stands in the heading beside the sky and the heron. Items the hub marks
 * come first, newest first. Until it marks one, the heading shows the newest
 * piece of writing that has its own image and the newest photographs.
 */
export function headingOf(items: readonly StreamItem[]): string[] {
	const marked = items.filter((item) => item.heading);
	if (marked.length) return marked.map((item) => item.id);
	const withImage = (item: StreamItem) => item.media[0]?.type === 'image';
	const writing = items.find((item) => item.kind === 'article' && withImage(item));
	const photographs = items.find((item) => item.kind === 'photos' && withImage(item));
	return [writing, photographs].filter((item): item is StreamItem => item !== undefined).map((item) => item.id);
}

/** The plain-word filters above the stream. Announcements show under All only. */
export const FILTERS = [
	{ id: 'all', label: 'All', kinds: STREAM_KINDS as readonly StreamKind[] },
	{ id: 'notes', label: 'Notes', kinds: ['note'] },
	{ id: 'writing', label: 'Writing', kinds: ['article'] },
	{ id: 'photos', label: 'Photos', kinds: ['photos'] },
	{ id: 'recordings', label: 'Recordings', kinds: ['recording'] },
	{ id: 'video', label: 'Video', kinds: ['video'] },
] as const satisfies ReadonlyArray<{ id: string; label: string; kinds: readonly StreamKind[] }>;
export type FilterId = (typeof FILTERS)[number]['id'];

export const filterOf = (value: string | null | undefined): FilterId => FILTERS.find((filter) => filter.id === value)?.id ?? 'all';

/** A filter is offered only when the stream has something of its kind. */
export function offeredFilters(counts: Record<StreamKind, number>) {
	return FILTERS.filter((filter) => filter.id === 'all' || filter.kinds.some((kind) => counts[kind] > 0));
}

export function filterItems(items: readonly StreamItem[], filter: FilterId): StreamItem[] {
	const kinds: readonly StreamKind[] = FILTERS.find((candidate) => candidate.id === filter)?.kinds ?? STREAM_KINDS;
	return items.filter((item) => kinds.includes(item.kind));
}

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const SHORT = MONTHS.map((month) => month.slice(0, 3));

/** "June 2026". Read from the date text, so no time zone moves a day. */
export const monthOf = (date: string) => `${MONTHS[Number(date.slice(5, 7)) - 1] ?? ''} ${date.slice(0, 4)}`.trim();
/** "Jun 8, 2026". */
export const dayOf = (date: string) => `${SHORT[Number(date.slice(5, 7)) - 1] ?? ''} ${Number(date.slice(8, 10))}, ${date.slice(0, 4)}`.trim();

/** The marker for an item: its month, only when it differs from the item before it. */
export function markerFor(items: readonly StreamItem[], index: number): string | null {
	const month = items[index].date.slice(0, 7);
	return index === 0 || items[index - 1].date.slice(0, 7) !== month ? monthOf(items[index].date) : null;
}

/** What a title's tooltip says: the day, and the reading time for writing. */
export function tipFor(item: StreamItem): string {
	return item.minutes ? `${dayOf(item.date)} · ${item.minutes} min read` : dayOf(item.date);
}
