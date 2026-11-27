import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { ASSET_DIR, ASSET_PREFIX, POSTER_SMALL, POSTER_SMALL_FROM, SMALL_FROM, SMALL_WIDTH, STREAM_OUTPUT, buildCommittedStream, imageSize, motionNames, posterSmallName, readPosts, serializeStream, smallNames, sourcesPresent } from '../../../scripts/lib/home-stream-sources.mjs';
import { SHORT_EXCERPT, excerptOf, plainText } from './excerpt';
import { FOLD_BEFORE, STREAM_KINDS, filmsIn, foldYears, isDated, kindsOf, shows, type StreamFile } from './stream';

const committed = JSON.parse(readFileSync(STREAM_OUTPUT, 'utf-8')) as StreamFile;

describe('committed home stream (src/lib/data/home-stream.v1.json)', () => {
	it('has the stream shape, newest first, with unique ids and counts that add up', () => {
		expect(committed.version).toBe(1);
		const ids = committed.items.map((item) => item.id);
		expect(new Set(ids).size).toBe(ids.length);
		const days = committed.items.map((item) => item.date.slice(0, 10));
		expect(days).toEqual([...days].sort().reverse());
		const held = committed.items.flatMap((item) => (item.holds ?? []).map((part) => part.id));
		expect(new Set([...ids, ...held]).size).toBe(ids.length + held.length);
		for (const kind of STREAM_KINDS) expect(committed.counts[kind]).toBe(committed.items.filter((item) => kindsOf(item).includes(kind)).length);
		for (const id of committed.heading) expect([...ids, ...held]).toContain(id);
	});

	it('gives every image a size, and no item a clock or a developer string', () => {
		const text = JSON.stringify(committed);
		expect(text).not.toMatch(/generatedAt|1970-01-01|policyVersion|schemaVersion/);
		for (const item of committed.items) {
			for (const media of item.media) {
				const image = media.type === 'image' ? media : media.type === 'youtube' ? media.poster : undefined;
				if (!image) continue;
				expect(image.width, image.src).toBeGreaterThan(0);
				expect(image.height, image.src).toBeGreaterThan(0);
			}
		}
	});

	it('uses only the embed hosts the page policy allows, and local or SoundCloud and YouTube links', () => {
		for (const item of committed.items) {
			for (const media of item.media) {
				if (media.type === 'soundcloud') expect(media.src).toMatch(/^https:\/\/soundcloud\.com\/jesssullivan\//);
				if (media.type === 'youtube') expect(media.src).toMatch(/^[A-Za-z0-9_-]{11}$/);
				if (media.type === 'image') expect(media.src.startsWith('/images/') || media.src.startsWith('https://hub.tinyland.dev/')).toBe(true);
				// A poster is a file the page brings with it, named so the build can hash it.
				if (media.type === 'youtube' && media.poster) expect(media.poster.src).toMatch(/^asset:video\/[A-Za-z0-9_-]{11}\.jpg$/);
			}
		}
	});

	// The posts are in every sandbox, so this runs everywhere. A post that is new, withdrawn, renamed,
	// redated, retitled or given new first words fails here until the file is rebuilt, as the constellation's projection does.
	it('holds every published post and no other; otherwise run: just home-stream', () => {
		const facts = (rows: (string | number | undefined)[][]) => rows.map((row) => row.join(' | ')).sort();
		const posts = readPosts().filter((post) => isDated(post.date));
		const writing = committed.items.filter((item) => item.source === 'posts');
		// A post that is words alone carries the short excerpt, and a post with something to see the longer one.
		const seen = new Set(writing.filter((item) => shows(item)).map((item) => item.id));
		expect(facts(writing.map((item) => [item.id, item.date, item.title, item.summary, item.minutes]))).toEqual(
			facts(posts.map((post) => [`post:${post.slug}`, post.date, post.title, seen.has(`post:${post.slug}`) ? excerptOf(post) : excerptOf(post, SHORT_EXCERPT), post.minutes])),
		);
	});

	it('shows a video a post names only by a poster the repository holds, and marks one the post only points at', () => {
		const posts = new Map(readPosts().map((post) => [`post:${post.slug}`, post]));
		for (const item of committed.items.filter((entry) => entry.source === 'posts')) {
			const named = new Map(filmsIn(posts.get(item.id)!.body).map((film) => [film.id, film]));
			for (const media of item.media) {
				const film = media.type === 'youtube' ? named.get(media.src) : undefined;
				if (media.type !== 'youtube' || !film) continue;
				expect(media.poster, `${item.id} ${media.src}`).toBeDefined();
				// A video the post only points at from inside a sentence is marked, and stands small.
				expect(media.aside ?? false, `${item.id} ${media.src}`).toBe(!film.own);
				// A large poster names its small size, for a row of posters.
				expect(media.poster!.small?.webp).toBe(media.poster!.width >= POSTER_SMALL_FROM ? posterSmallName(media.poster!.src) : undefined);
				if (media.poster!.small) expect(media.poster!.small.width).toBe(POSTER_SMALL);
			}
		}
	});

	it('names the still and the moving file of every moving picture', () => {
		for (const media of committed.items.flatMap((item) => item.media)) {
			if (media.type !== 'image') continue;
			expect(media.motion, media.src).toEqual(/\.gif$/i.test(media.src) ? motionNames(media.src) : undefined);
		}
	});

	it('folds the years before 2020, and keeps every item in one place or the other', () => {
		const { open, years } = foldYears(committed.items);
		expect(open.every((item) => Number(item.date.slice(0, 4)) >= FOLD_BEFORE)).toBe(true);
		expect(years.every((fold) => Number(fold.year) < FOLD_BEFORE && fold.items.every((item) => item.date.startsWith(fold.year)))).toBe(true);
		expect(open.length + years.reduce((sum, fold) => sum + fold.items.length, 0)).toBe(committed.items.length);
		expect(years.map((fold) => fold.year)).toEqual([...years.map((fold) => fold.year)].sort().reverse());
	});

	// The whole file, byte for byte. It needs the gallery, the images and the posters on disk. A Bazel unit-test
	// sandbox holds only the code and the data under src, scripts and static/data, so there the build gate does this
	// check instead: scripts/run-sveltekit-vite-build-bazel.mjs runs the generator with --check before it builds.
	it.skipIf(!sourcesPresent())('is current with all its sources; otherwise run: just home-stream', () => {
		expect(existsSync(STREAM_OUTPUT)).toBe(true);
		expect(readFileSync(STREAM_OUTPUT, 'utf-8')).toBe(serializeStream(buildCommittedStream()));
	});
});

describe('the small sizes of the committed stream', () => {
	const pictures = committed.items.flatMap((item) => item.media).filter((media) => media.type === 'image');

	it('names a small size only for a picture of a post wide enough to gain from it', () => {
		for (const image of pictures) {
			expect(image.small !== undefined, image.src).toBe(image.width >= SMALL_FROM && image.src.startsWith('/images/posts/'));
			if (!image.small) continue;
			expect(image.small.width).toBe(SMALL_WIDTH);
			expect(image.small.webp).toBe(smallNames(image.src).webp);
			// The small AVIF goes with the whole one.
			expect(image.small.avif).toBe(image.avif ? smallNames(image.src).avif : undefined);
		}
	});

	// The small files are under static/images, which a Bazel unit-test sandbox does not hold. There the build gate checks them.
	it.skipIf(!existsSync('static/images/home'))('has every small file it names on disk; otherwise run: just home-pictures', () => {
		for (const image of pictures) {
			for (const path of [image.small?.webp, image.small?.avif, image.motion?.still, image.motion?.moving]) if (path) expect(existsSync(`static${path}`), path).toBe(true);
		}
	});

	it.skipIf(!existsSync(`${ASSET_DIR}/video`))('has every file of every poster on disk; otherwise run: just home-pictures', () => {
		const posters = committed.items.flatMap((item) => item.media).flatMap((media) => (media.type === 'youtube' && media.poster ? [media.poster] : []));
		expect(posters.length).toBeGreaterThan(0);
		for (const poster of posters) {
			expect(poster.webp, poster.src).toBeDefined();
			for (const name of [poster.src, poster.webp, poster.small?.webp]) if (name) expect(existsSync(`${ASSET_DIR}/${name.slice(ASSET_PREFIX.length)}`), name).toBe(true);
		}
	});
});

describe('the excerpts of the committed stream', () => {
	const writing = committed.items.filter((item) => item.source === 'posts' && item.summary);

	it('are short for a post that is words alone', () => {
		for (const item of writing) if (!shows(item)) expect(item.summary.length, item.id).toBeLessThanOrEqual(SHORT_EXCERPT.longest);
	});

	it('start with a letter, a figure or an opening quote, never with a stray mark', () => {
		for (const item of writing) expect(item.summary, item.id).toMatch(/^[\p{L}\p{N}"“'‘(]/u);
	});

	it('end where a sentence ends, or as her own summary ends', () => {
		const posts = new Map(readPosts().map((post) => [`post:${post.slug}`, post]));
		for (const item of writing) {
			const own = posts.get(item.id)!.description.trim().endsWith(item.summary.slice(-12));
			if (!own) expect(item.summary, item.id).toMatch(/[.!?…]["'”’)\]]*(?:\s*(?:\p{Extended_Pictographic}\uFE0F?|[:;]-?\)))*$/u);
		}
	});

	it('hold no address, no markup, no note of the export and no trace of a player', () => {
		for (const item of writing) {
			expect(item.summary, item.id).not.toMatch(/https?:\/\/|\]\(|<\/?[a-z][^>]*>|\s·\s|WordPress/i);
			expect(item.summary.length, item.id).toBeLessThanOrEqual(300);
		}
	});

	it('are her text: every one stands word for word in her summary or in her post', () => {
		const letters = (text: string) => text.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '');
		const posts = new Map(readPosts().map((post) => [`post:${post.slug}`, post]));
		for (const item of writing) {
			const post = posts.get(item.id)!;
			expect(letters(plainText(`${post.description} ${post.body}`)), item.id).toContain(letters(item.summary));
		}
	});
});

describe('image sizes read from file headers', () => {
	it('reads a PNG, a GIF and a JPEG', () => {
		const png = new Uint8Array(24);
		png.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52, 0, 0, 0x02, 0xa0, 0, 0, 0, 0xdb]);
		expect(imageSize(png)).toEqual({ width: 672, height: 219 });
		const gif = new Uint8Array([0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0x40, 0x01, 0xf0, 0x00]);
		expect(imageSize(gif)).toEqual({ width: 320, height: 240 });
		// SOI, an APP0 segment of 4 bytes, then a baseline frame of 720 by 1280.
		const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x04, 0x00, 0x00, 0xff, 0xc0, 0x00, 0x11, 0x08, 0x02, 0xd0, 0x05, 0x00, 0x03, 0x01, 0x22]);
		expect(imageSize(jpeg)).toEqual({ width: 1280, height: 720 });
		expect(imageSize(new Uint8Array([1, 2, 3, 4]))).toBeNull();
	});
});
