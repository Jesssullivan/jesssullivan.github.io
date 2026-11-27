/**
 * The home stream (TIN-8657, ruling RM48): one flow, newest first, built from
 * what the site has. Every source maps into one item type here, and nothing in
 * this file reads a file, a clock or the network. The generator in
 * scripts/generate-home-stream.mts supplies the sources.
 */
import { excerptOf, plainText, SHORT_EXCERPT } from './excerpt';

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
	/** The same picture at a smaller size, for a row of pictures, a picture beside its words and a narrow screen. See scripts/generate-home-pictures.mts. */
	small?: { width: number; webp?: string; avif?: string };
	/**
	 * A moving picture (RM97). `src` is the file the post names. `still` is its first frame and `moving` the whole
	 * of it, both as WebP. The page shows the still, and asks for the moving one only while it plays.
	 */
	motion?: { still: string; moving: string };
}
/** What a recording or a video keeps of its own when it is folded into another item. */
interface OwnWords {
	title?: string;
	date?: string;
	url?: string;
	note?: string;
}
/** A SoundCloud track. `src` is the track page. */
export interface StreamSound extends OwnWords {
	type: 'soundcloud';
	src: string;
}
/** A YouTube video. `src` is the video id. */
export interface StreamFilm extends OwnWords {
	type: 'youtube';
	src: string;
	poster?: StreamImage;
	/** True when the post only points at the video from inside a sentence. It then stands small, after everything of the post's own. */
	aside?: boolean;
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
	/** Items with the same subject, folded into this one. Their media is in `media`. See `foldStream`. */
	holds?: { id: string; kind: StreamKind }[];
}

export interface StreamFile {
	version: 1;
	items: StreamItem[];
	/** Ids of the items shown as scenes in the heading, in order. An id may be one an item holds. */
	heading: string[];
	/** How many items hold each kind. A folded item counts under every kind it holds. */
	counts: Record<StreamKind, number>;
	leftOut: {
		/** Gallery photographs that no public post uses, so they have no date. */
		photographsWithoutPost: number;
		/** Videos on the Music page whose title states no day. */
		videosWithoutDate: number;
		/** Posts whose cover is a shared photograph their own text never uses. */
		coversNotOwn: number;
		/** Moving pictures in a post's text with no still made for them. One that has a still plays, with a pause (RM97). */
		picturesMoving: number;
		/** Pictures in a post's text that another site holds. This page asks no other site for anything. */
		picturesElsewhere: number;
		/** Picture files that more than one post's text shows. Such a file is no one post's own, so none shows it. */
		picturesShared: number;
		/** Videos a post gives a line of its own that have no poster in the repository. The page fetches none, so they stay links in the post. */
		videosWithoutPoster: number;
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
export type ImageFacts = (src: string) => { width: number; height: number; webp?: string; avif?: string; small?: StreamImage['small']; motion?: StreamImage['motion'] } | null;

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
/** How many videos of a post travel in the data file, and how many of the ones it only points at. */
export const FILM_SET = 6;
export const ASIDE_SET = 3;

/**
 * The count a set of photographs shows under it: every photograph of the post, and only when the
 * post holds more than the set shows. A set that is all on screen says nothing, because the reader sees it.
 */
export function setTotal(item: Pick<StreamItem, 'media' | 'more'>): number {
	const unseen = item.more ?? 0;
	return unseen > 0 ? item.media.filter((media) => media.type === 'image').length + unseen : 0;
}

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
	return new RegExp(`/images/posts/${escapeRe(name)}\\.(?:jpe?g|png|gif|webp|avif|svg)\\b`, 'i').test(body);
}

/**
 * Every picture a post's own text shows, in the order it shows them: a Markdown image or an image tag.
 * Code is not text, so a picture named inside a code block is not one the post shows.
 */
export function picturesIn(body: string): { src: string; alt: string }[] {
	const text = body.replace(CODE_BLOCK, '\n');
	const found: { src: string; alt: string }[] = [];
	for (const match of text.matchAll(/!\[([^\]]*)\]\(\s*<?([^)\s>]+)>?[^)]*\)|<img\b[^>]*>/gi)) {
		if (match[2]) found.push({ src: match[2], alt: match[1].trim() });
		else {
			const src = /\bsrc\s*=\s*["']([^"']+)["']/i.exec(match[0])?.[1];
			if (src) found.push({ src, alt: (/\balt\s*=\s*["']([^"']*)["']/i.exec(match[0])?.[1] ?? '').trim() });
		}
	}
	return found;
}

const CODE_BLOCK = /^[ \t]*(`{3,}|~{3,})[^\n]*\n[\s\S]*?(?:\n[ \t]*\1[^\n]*(?=\n|(?![\s\S]))|(?![\s\S]))/gm;
const FILM_ADDRESS = '(?:https?:)?\\/\\/(?:www\\.|m\\.)?(?:youtube(?:-nocookie)?\\.com\\/(?:watch\\?(?:[^)\\s#"\']*&)?v=|embed\\/|shorts\\/)|youtu\\.be\\/)([A-Za-z0-9_-]{11})';
const FILM_WORDS = `(?<!!)\\[((?:[^\\]\\\\]|\\\\.)+)\\]\\(\\s*<?${FILM_ADDRESS}[^)\\s]*>?\\s*\\)`;
/** A link to a video, wherever it stands. */
const FILM_LINK = new RegExp(FILM_WORDS, 'g');
/** A line that is one link to a video and nothing more, as a paragraph or as an item of a list. */
const FILM_LINE = new RegExp(`^[ \\t]*(?:(?:[-*+]|\\d+[.)])[ \\t]+)?${FILM_WORDS}[ \\t]*$`);
/** A frame that plays one. */
const FILM_FRAME = new RegExp(`<iframe\\b[^>]*\\bsrc\\s*=\\s*["']${FILM_ADDRESS}[^"']*["'][^>]*>`, 'gi');

/**
 * The YouTube videos a post's text names (RM95, RM99), each once, in the order of the text, with the words the post gives it.
 * `own` is true for a video the post gives a line of its own: a link that is the whole of a paragraph or of a list item, or a frame.
 * It is false for one the post only points at from inside a sentence, which is most often someone else's that the post talks about.
 */
export function filmsIn(body: string): { id: string; title: string; own: boolean }[] {
	const text = body.replace(CODE_BLOCK, '\n');
	const found: { id: string; title: string; own: boolean; at: number }[] = [];
	let at = 0;
	for (const line of text.split('\n')) {
		const whole = FILM_LINE.exec(line);
		if (whole) found.push({ id: whole[2], title: plainText(whole[1]), own: true, at });
		else for (const match of line.matchAll(FILM_LINK)) found.push({ id: match[2], title: plainText(match[1]), own: false, at: at + match.index });
		at += line.length + 1;
	}
	for (const match of text.matchAll(FILM_FRAME)) found.push({ id: match[1], title: (/\btitle\s*=\s*["']([^"']*)["']/i.exec(match[0])?.[1] ?? '').trim(), own: true, at: match.index });
	// A video named twice is the post's own when one of the two is a line of its own.
	const own = new Set(found.filter((film) => film.own).map((film) => film.id));
	const seen = new Set<string>();
	return found
		.sort((a, b) => a.at - b.at)
		.filter((film) => !seen.has(film.id) && seen.add(film.id))
		.map(({ id, title }) => ({ id, title, own: own.has(id) }));
}

const extension = (path: string) => (/\.([a-z0-9]+)(?:[?#].*)?$/i.exec(path)?.[1] ?? '').toLowerCase();

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
		...(facts?.small ? { small: facts.small } : {}),
		...(facts?.motion ? { motion: facts.motion } : {}),
	};
}

/** True when an item has something to see: a picture or a video. A recording alone is heard, so it has not. */
export const shows = (item: Pick<StreamItem, 'media'>): boolean => item.media.some((media) => media.type !== 'soundcloud');

/** Every kind an item holds: its own, the kinds folded into it, and video when it shows one of its own. A video it only points at does not make it one. */
export const kindsOf = (item: Pick<StreamItem, 'kind' | 'holds'> & Partial<Pick<StreamItem, 'media'>>): StreamKind[] => [
	...new Set<StreamKind>([item.kind, ...(item.holds ?? []).map((part) => part.kind), ...((item.media ?? []).some((media) => media.type === 'youtube' && !media.aside) ? (['video'] as const) : [])]),
];

/**
 * What a title says it is about: the words before a day written in it, and that day.
 * "Morning Metal 04.23.21" is ("morning metal", 2021-04-23). The day is month, day, year, as she writes it,
 * with one separator used twice: a full stop, a slash, a hyphen or a space. The year has two digits, or four from 1990 to 2099.
 * A title with no day has no subject.
 */
export function subjectOf(title: string): { name: string; day: string } | null {
	const match = /(^|[^\d])(\d{1,2})([./ -])(\d{1,2})\3(\d{4}|\d{2})(?!\d)/.exec(title);
	if (!match) return null;
	const [month, day, year] = [Number(match[2]), Number(match[4]), Number(match[5].length === 2 ? `20${match[5]}` : match[5])];
	if (month < 1 || month > 12 || day < 1 || day > 31 || year < 1990 || year > 2099) return null;
	const name = title
		.slice(0, match.index + match[1].length)
		.toLowerCase()
		.replace(/[^\p{L}\p{N}]+/gu, ' ')
		.trim();
	if (!name) return null;
	const two = (value: number) => String(value).padStart(2, '0');
	return { name, day: `${year}-${two(month)}-${two(day)}` };
}

const MEDIA_RANK: Record<StreamMedia['type'], number> = { image: 0, youtube: 1, soundcloud: 2 };

/** Puts `part` into `lead`. A recording or a video keeps its own title, day, address and note on its media. */
function hold(lead: StreamItem, part: StreamItem): void {
	const own = (media: StreamMedia): StreamMedia => (media.type === 'image' ? media : { ...media, title: media.title ?? part.title, date: media.date ?? part.date, url: media.url ?? part.url, ...(part.summary && !media.note ? { note: part.summary } : {}) });
	// One photograph may stand in two formats. It is one picture.
	const name = (media: StreamMedia) => (media.type === 'image' ? stem(media.src) : media.src);
	const seen = new Set(lead.media.map(name));
	const media = [...lead.media, ...part.media.filter((media) => !seen.has(name(media))).map(own)].sort((a, b) => MEDIA_RANK[a.type] - MEDIA_RANK[b.type]);
	// A post's own pictures and its set of photographs are mostly the same files. Together they still show `SET_SIZE` at most.
	const pictures = media.filter((entry) => entry.type === 'image');
	const over = Math.max(0, pictures.length - SET_SIZE);
	lead.media = media.filter((entry) => entry.type !== 'image' || pictures.indexOf(entry) < SET_SIZE);
	lead.holds = [...(lead.holds ?? []), { id: part.id, kind: part.kind }, ...(part.holds ?? [])];
	if (part.more || over) lead.more = (lead.more ?? 0) + (part.more ?? 0) + over;
}

/**
 * The join rule. Things with one subject show as one item, and the rule joins only what the data states.
 *
 * 1. A set of photographs joins the post whose address it carries: the set is built from that post's own text.
 * 2. A recording or a video joins a post when both titles open with the same words before a day written
 *    in the title, the day its title states is its own date, and that day is the post's date or the day
 *    the post's title states. If two posts answer, it joins neither.
 * 3. Recordings and videos that no post answers join each other when their titles state the same words and the same day.
 *
 * A title that states no day never joins by rule 2 or 3, so a shared series name alone joins nothing.
 * The words must be the same words, not words that hold them: "Shortest Morning Metal" is not "Morning Metal".
 */
export function foldStream(placed: Placed[]): Placed[] {
	const gone = new Set<StreamItem>();
	const articles = placed.filter((entry) => entry.item.kind === 'article');

	const byUrl = new Map(articles.map((entry) => [entry.item.url, entry.item]));
	for (const { item } of placed) {
		const post = item.kind === 'photos' ? byUrl.get(item.url) : undefined;
		if (!post) continue;
		hold(post, item);
		gone.add(item);
	}

	const key = (name: string, day: string) => `${name}\n${day}`;
	const posts = new Map<string, Set<StreamItem>>();
	for (const { item } of articles) {
		const subject = subjectOf(item.title);
		if (!subject) continue;
		for (const day of new Set([subject.day, item.date.slice(0, 10)])) {
			const at = key(subject.name, day);
			posts.set(at, (posts.get(at) ?? new Set()).add(item));
		}
	}
	const loose = new Map<string, Placed[]>();
	for (const entry of placed) {
		const { item } = entry;
		if (item.kind !== 'recording' && item.kind !== 'video') continue;
		const subject = subjectOf(item.title);
		if (!subject || subject.day !== item.date.slice(0, 10)) continue;
		const at = key(subject.name, subject.day);
		const answers = posts.get(at);
		if (answers?.size === 1) {
			hold([...answers][0], item);
			gone.add(item);
		} else if (!answers) {
			loose.set(at, [...(loose.get(at) ?? []), entry]);
		}
	}
	for (const group of loose.values()) {
		if (group.length < 2) continue;
		const [lead, ...rest] = [...group].sort(compareStream);
		for (const { item } of rest) {
			hold(lead.item, item);
			gone.add(item);
		}
	}
	return placed.filter((entry) => !gone.has(entry.item));
}

// At the same date an item stays beside the post it belongs to, with the writing first.
const RANK: Record<StreamKind, number> = { announcement: 0, note: 1, article: 2, photos: 3, recording: 4, video: 5 };

export interface Placed {
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
	const leftOut = { photographsWithoutPost: 0, videosWithoutDate: 0, coversNotOwn: 0, picturesMoving: 0, picturesElsewhere: 0, picturesShared: 0, videosWithoutPoster: 0, undated: 0 };
	// A video the Music page lists has an item of its own, so a post that names it does not show it a second time.
	const listed = new Set(sources.videos.map((video) => video.id));
	const posts = new Map(sources.posts.map((post) => [post.slug, post]));

	// A picture file that the text of more than one post shows is no one post's own. The old export gave several
	// uploads one name, so one file now stands in posts years apart. It is shown with none of them, as a shared cover is.
	const shownBy = new Map<string, number>();
	for (const post of sources.posts) {
		for (const name of new Set(picturesIn(post.body).filter((shown) => shown.src.startsWith('/')).map((shown) => stem(shown.src)))) shownBy.set(name, (shownBy.get(name) ?? 0) + 1);
	}
	const shared = new Set([...shownBy].filter(([, count]) => count > 1).map(([name]) => name));
	leftOut.picturesShared = shared.size;

	// Photographs: one set per post, in the order the post shows them. A photograph no public post uses has no date.
	// Each set is made as its own item here and folded into its post at the end, by the one join rule.
	const sets = new Map<string, GalleryInput[]>();
	for (const photo of sources.gallery) {
		const post = photo.post_slug ? posts.get(photo.post_slug) : undefined;
		if (!post || !isDated(post.date)) {
			leftOut.photographsWithoutPost += 1;
			continue;
		}
		if (shared.has(stem(photo.src))) continue;
		sets.set(post.slug, [...(sets.get(post.slug) ?? []), photo]);
	}

	for (const post of sources.posts) {
		if (!isDated(post.date)) {
			leftOut.undated += 1;
			continue;
		}
		// A post's pictures are the ones its own text shows, in its order. The cover is one of them only when the text uses it.
		const cover = post.featureImage && ownsImage(post.body, post.featureImage) && !shared.has(stem(post.featureImage)) ? post.featureImage : undefined;
		if (post.featureImage && !cover) leftOut.coversNotOwn += 1;
		const media: StreamImage[] = [];
		const seen = new Set<string>();
		for (const shown of picturesIn(post.body)) {
			const name = stem(shown.src);
			if (seen.has(name) || shared.has(name)) continue;
			seen.add(name);
			if (!shown.src.startsWith('/')) {
				if (/^https?:/i.test(shown.src)) leftOut.picturesElsewhere += 1;
				continue;
			}
			const kind = extension(shown.src);
			if (kind === 'gif') {
				// A moving picture shows when its still was made: the page then holds it still until it plays, and can stop it.
				const moving = picture(shown.src, shown.alt || altIn(post.body, shown.src), sources.image);
				if (moving?.motion) media.push(moving);
				else leftOut.picturesMoving += 1;
				continue;
			}
			// The cover is the same picture in the format the site serves. A drawing the text shows as SVG is shown here by its cover.
			const src = cover && stem(cover) === name ? cover : shown.src;
			if (extension(src) === 'svg') continue;
			const image = picture(src, shown.alt || altIn(post.body, src), sources.image);
			if (image) media.push(image);
		}
		// A cover the text uses in a way the reading above does not see, as inside a component, still counts.
		if (cover && !media.some((image) => stem(image.src) === stem(cover))) {
			const image = picture(cover, altIn(post.body, cover), sources.image);
			if (image) media.unshift(image);
		}
		// A video shows by its poster, which the repository holds. Nothing is fetched for one, so a video with no poster stays a link in the post.
		const films: StreamFilm[] = [];
		for (const shown of filmsIn(post.body)) {
			if (listed.has(shown.id)) continue;
			const posterSrc = sources.poster?.(shown.id) ?? null;
			const poster = posterSrc ? picture(posterSrc, '', sources.image) : null;
			if (poster) films.push({ type: 'youtube', src: shown.id, ...(shown.title ? { title: shown.title } : {}), poster, ...(shown.own ? {} : { aside: true }) });
			else leftOut.videosWithoutPoster += 1;
		}
		const own = films.filter((film) => !film.aside).slice(0, FILM_SET);
		const asides = films.filter((film) => film.aside).slice(0, ASIDE_SET);
		placed.push({
			anchor: post.slug,
			item: {
				id: `post:${post.slug}`,
				kind: 'article',
				date: post.date,
				title: post.title,
				summary: excerptOf(post),
				url: `/blog/${post.slug}`,
				media: [...media.slice(0, SET_SIZE), ...own, ...asides],
				tags: post.tags,
				source: 'posts',
				minutes: post.minutes,
			},
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

	const items = foldStream(placed)
		.sort(compareStream)
		.map((entry) => entry.item);
	// A post that is words alone takes a short excerpt (RM95): her first sentences still, and fewer of them.
	const bySlug = new Map(sources.posts.map((post) => [`post:${post.slug}`, post]));
	for (const item of items) {
		const post = item.source === 'posts' ? bySlug.get(item.id) : undefined;
		if (post && !shows(item)) item.summary = excerptOf(post, SHORT_EXCERPT);
	}
	const counts = Object.fromEntries(STREAM_KINDS.map((kind) => [kind, items.filter((item) => kindsOf(item).includes(kind)).length])) as Record<StreamKind, number>;
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
	// A moving picture is not a scene: the stage holds photographs still.
	const withImage = (item: StreamItem) => {
		const first = item.media[0];
		return first?.type === 'image' && !first.motion;
	};
	const set = (item: StreamItem) => (item.kind === 'photos' ? item.id : item.holds?.find((part) => part.kind === 'photos')?.id);
	const writing = items.find((item) => item.kind === 'article' && withImage(item) && !set(item));
	const photographs = items.find((item) => withImage(item) && set(item));
	return [writing?.id, photographs && set(photographs)].filter((id): id is string => typeof id === 'string');
}

/**
 * The item a heading id names. An id an item holds, as a set of photographs folded into its post is,
 * gives that item under the held id with no summary: the set has no words of its own.
 */
export function headingItem(items: readonly StreamItem[], id: string): StreamItem | undefined {
	const own = items.find((item) => item.id === id);
	if (own) return own;
	const lead = items.find((item) => item.holds?.some((part) => part.id === id));
	return lead && { ...lead, id, summary: '' };
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

/** A folded item shows under every kind it holds. */
export function filterItems(items: readonly StreamItem[], filter: FilterId): StreamItem[] {
	const kinds: readonly StreamKind[] = FILTERS.find((candidate) => candidate.id === filter)?.kinds ?? STREAM_KINDS;
	return items.filter((item) => kindsOf(item).some((kind) => kinds.includes(kind)));
}

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const SHORT = MONTHS.map((month) => month.slice(0, 3));

/** "June 2026". Read from the date text, so no time zone moves a day. */
export const monthOf = (date: string) => `${MONTHS[Number(date.slice(5, 7)) - 1] ?? ''} ${date.slice(0, 4)}`.trim();
/** "Jun 8, 2026". */
export const dayOf = (date: string) => `${SHORT[Number(date.slice(5, 7)) - 1] ?? ''} ${Number(date.slice(8, 10))}, ${date.slice(0, 4)}`.trim();

/** The marker for an item: its month, only when it differs from the item before it. Inside a year that names itself, the month alone. */
export function markerFor(items: readonly StreamItem[], index: number, inYear = false): string | null {
	const month = items[index].date.slice(0, 7);
	if (index !== 0 && items[index - 1].date.slice(0, 7) === month) return null;
	return inYear ? (MONTHS[Number(month.slice(5, 7)) - 1] ?? '') : monthOf(items[index].date);
}

/** Years before this one show as one line each, a year and its count, which opens on a press (RM95). */
export const FOLD_BEFORE = 2020;
export interface YearFold {
	year: string;
	items: StreamItem[];
}

/**
 * The stream in two parts: the items that show as they are, and the older years, each folded into one line.
 * It takes the list a filter has already cut, so a year counts and shows only what matches, and a year with nothing is absent.
 */
export function foldYears(items: readonly StreamItem[], before = FOLD_BEFORE): { open: StreamItem[]; years: YearFold[] } {
	const open: StreamItem[] = [];
	const years: YearFold[] = [];
	for (const item of items) {
		const year = item.date.slice(0, 4);
		if (Number(year) >= before) open.push(item);
		else if (years[years.length - 1]?.year === year) years[years.length - 1].items.push(item);
		else years.push({ year, items: [item] });
	}
	return { open, years };
}

/** What a title's tooltip says: the day, and the reading time for writing. */
export function tipFor(item: StreamItem): string {
	return item.minutes ? `${dayOf(item.date)} · ${item.minutes} min read` : dayOf(item.date);
}
