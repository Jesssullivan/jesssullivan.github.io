import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { STREAM_OUTPUT, buildCommittedStream, imageSize, readPosts, serializeStream, sourcesPresent } from '../../../scripts/lib/home-stream-sources.mjs';
import { STREAM_KINDS, isDated, type StreamFile } from './stream';

const committed = JSON.parse(readFileSync(STREAM_OUTPUT, 'utf-8')) as StreamFile;

describe('committed home stream (src/lib/data/home-stream.v1.json)', () => {
	it('has the stream shape, newest first, with unique ids and counts that add up', () => {
		expect(committed.version).toBe(1);
		const ids = committed.items.map((item) => item.id);
		expect(new Set(ids).size).toBe(ids.length);
		const days = committed.items.map((item) => item.date.slice(0, 10));
		expect(days).toEqual([...days].sort().reverse());
		for (const kind of STREAM_KINDS) expect(committed.counts[kind]).toBe(committed.items.filter((item) => item.kind === kind).length);
		for (const id of committed.heading) expect(ids).toContain(id);
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
	// redated or retitled fails here until the file is rebuilt, as the constellation's projection does.
	it('holds every published post and no other; otherwise run: just home-stream', () => {
		const facts = (rows: (string | number | undefined)[][]) => rows.map((row) => row.join(' | ')).sort();
		const posts = readPosts().filter((post) => isDated(post.date));
		const writing = committed.items.filter((item) => item.source === 'posts');
		expect(facts(writing.map((item) => [item.id, item.date, item.title, item.summary, item.minutes]))).toEqual(facts(posts.map((post) => [`post:${post.slug}`, post.date, post.title, post.description, post.minutes])));
	});

	// The whole file, byte for byte. It needs the gallery, the images and the posters on disk. A Bazel unit-test
	// sandbox holds only the code and the data under src, scripts and static/data, so there the build gate does this
	// check instead: scripts/run-sveltekit-vite-build-bazel.mjs runs the generator with --check before it builds.
	it.skipIf(!sourcesPresent())('is current with all its sources; otherwise run: just home-stream', () => {
		expect(existsSync(STREAM_OUTPUT)).toBe(true);
		expect(readFileSync(STREAM_OUTPUT, 'utf-8')).toBe(serializeStream(buildCommittedStream()));
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
