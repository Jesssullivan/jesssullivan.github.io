/**
 * Inputs for the home stream (TIN-8657). Shared by scripts/generate-home-stream.mts
 * and the freshness test in src/lib/home/committed-stream.test.ts, so both read the
 * same sources the same way. Every input is a committed file. Nothing is fetched.
 */
import { existsSync, openSync, readSync, closeSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseFrontmatter, parseFrontmatterRaw } from './frontmatter.mjs';
import { buildStream, type GalleryInput, type ImageFacts, type PostInput, type PulseInput, type StreamFile } from '../../src/lib/home/stream';
import { tracks, videos, shorts } from '../../src/lib/data/music';

export const POSTS_DIR = 'src/posts';
export const GALLERY_FILE = 'static/photo-gallery.json';
export const PULSE_FILE = 'static/data/pulse/public-snapshot.v2.json';
/**
 * Files the home page brings with it. The build gives each a content hash in its name,
 * so a browser may keep it for good. The stream names one as `asset:<path under this folder>`.
 */
export const ASSET_DIR = 'src/lib/assets/home';
export const ASSET_PREFIX = 'asset:';
export const POSTER_DIR = `${ASSET_DIR}/video`;
/** Under src, so the build hashes its name too. */
export const STREAM_OUTPUT = 'src/lib/data/home-stream.v1.json';

const WORDS_PER_MINUTE = 230;
/** The widest image scripts/optimize-images.mts leaves under static/images/posts. */
const MAX_WIDTH = 1200;

/** The same plain text and the same count scripts/generate-search-index.mts uses for reading time. */
function minutesOf(body: string): number {
	const plain = body
		.replace(/```[\s\S]*?```/g, '')
		.replace(/`[^`]*`/g, '')
		.replace(/<[^>]+>/g, '')
		.replace(/!\[[^\]]*\]\([^)]*\)/g, '')
		.replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
		.replace(/[#*_~>|\\-]/g, '')
		.replace(/\s+/g, ' ')
		.trim();
	return Math.max(1, Math.round(plain.split(/\s+/).filter((word) => word.length > 0).length / WORDS_PER_MINUTE));
}

/** Only posts with an explicit `published: true`, the rule the search index uses. */
export function readPosts(dir = POSTS_DIR): PostInput[] {
	const posts: PostInput[] = [];
	for (const file of readdirSync(dir).filter((name) => /\.(?:md|svx)$/.test(name)).sort()) {
		const content = readFileSync(join(dir, file), 'utf-8');
		const meta = parseFrontmatter(content);
		if (!meta || meta.published !== true) continue;
		const slug = (meta.slug as string) ?? file.replace(/\.(?:md|svx)$/, '').replace(/^\d{4}-\d{2}-\d{2}-/, '');
		const body = parseFrontmatterRaw(content)?.body ?? '';
		posts.push({
			slug,
			date: String(meta.date ?? ''),
			title: String(meta.title ?? slug),
			description: String(meta.excerpt ?? meta.description ?? ''),
			tags: Array.isArray(meta.tags) ? (meta.tags as unknown[]).map(String) : [],
			minutes: typeof meta.reading_time === 'number' ? meta.reading_time : minutesOf(body),
			...(typeof meta.feature_image === 'string' ? { featureImage: meta.feature_image } : {}),
			body,
		});
	}
	return posts;
}

/** Width and height from the first bytes of a PNG, JPEG, GIF or WebP file. */
export function imageSize(bytes: Uint8Array): { width: number; height: number } | null {
	const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
	const ascii = (start: number, length: number) => String.fromCharCode(...bytes.subarray(start, start + length));
	if (bytes.length >= 24 && view.getUint32(0) === 0x89504e47) return { width: view.getUint32(16), height: view.getUint32(20) };
	if (bytes.length >= 10 && ascii(0, 3) === 'GIF') return { width: view.getUint16(6, true), height: view.getUint16(8, true) };
	if (bytes.length >= 30 && ascii(0, 4) === 'RIFF' && ascii(8, 4) === 'WEBP') {
		const kind = ascii(12, 4);
		if (kind === 'VP8X') return { width: 1 + (view.getUint16(24, true) | (bytes[26] << 16)), height: 1 + (view.getUint16(27, true) | (bytes[29] << 16)) };
		if (kind === 'VP8 ') return { width: view.getUint16(26, true) & 0x3fff, height: view.getUint16(28, true) & 0x3fff };
		if (kind === 'VP8L') {
			const bits = view.getUint32(21, true);
			return { width: 1 + (bits & 0x3fff), height: 1 + ((bits >> 14) & 0x3fff) };
		}
	}
	if (bytes.length >= 4 && bytes[0] === 0xff && bytes[1] === 0xd8) {
		let at = 2;
		while (at + 9 < bytes.length) {
			if (bytes[at] !== 0xff) return null;
			const marker = bytes[at + 1];
			// A start-of-frame marker carries the size. C4, C8 and CC are tables, not frames.
			if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) return { width: view.getUint16(at + 7), height: view.getUint16(at + 5) };
			at += 2 + view.getUint16(at + 2);
		}
	}
	return null;
}

function readHead(path: string, length = 262_144): Uint8Array {
	const file = openSync(path, 'r');
	try {
		const bytes = new Uint8Array(length);
		return bytes.subarray(0, readSync(file, bytes, 0, length, 0));
	} finally {
		closeSync(file);
	}
}

// Firefox cannot decode this generated AVIF. src/lib/components/BlogCard.svelte keeps the same list.
const AVIF_DISABLED = new Set(['/images/posts/darwin-nic-bastion-flow.png']);

/**
 * Size from the committed file. The smaller formats are the ones
 * scripts/optimize-images.mts writes for every JPEG and PNG under
 * static/images/posts at prebuild, so their names follow from the source name.
 */
export function imageFacts(staticDir = 'static', assetDir = ASSET_DIR): ImageFacts {
	return (src) => {
		const bundled = src.startsWith(ASSET_PREFIX);
		const onDisk = (name: string) => (bundled ? join(assetDir, name.slice(ASSET_PREFIX.length)) : join(staticDir, name));
		const path = onDisk(src);
		if ((!bundled && !src.startsWith('/')) || !existsSync(path)) return null;
		const read = imageSize(readHead(path));
		if (!read) return null;
		const optimized = /^\/images\/posts\/[^/]+\.(?:jpe?g|png)$/i.test(src);
		// The prebuild step shrinks a wider source to 1200 pixels in place. The size given here is the one the built site serves.
		const size = optimized && read.width > MAX_WIDTH ? { width: MAX_WIDTH, height: Math.round((read.height * MAX_WIDTH) / read.width) } : read;
		const swap = (ext: string) => src.replace(/\.(?:jpe?g|png)$/i, ext);
		// A committed poster has its WebP beside it.
		const beside = src.replace(/\.(?:jpe?g|png)$/i, '.webp');
		return {
			...size,
			...(optimized ? { webp: swap('.webp') } : beside !== src && existsSync(onDisk(beside)) ? { webp: beside } : {}),
			...(optimized && !AVIF_DISABLED.has(src) ? { avif: swap('.avif') } : {}),
		};
	};
}

export function readSources(root = '.') {
	const gallery = JSON.parse(readFileSync(join(root, GALLERY_FILE), 'utf-8')) as GalleryInput[];
	const pulse = (JSON.parse(readFileSync(join(root, PULSE_FILE), 'utf-8')) as { items: PulseInput[] }).items;
	return {
		posts: readPosts(join(root, POSTS_DIR)),
		gallery,
		pulse,
		tracks,
		// The Music page lists shorts and videos apart. The stream takes both.
		videos: [...shorts, ...videos],
		image: imageFacts(join(root, 'static'), join(root, ASSET_DIR)),
		poster: (id: string) => (existsSync(join(root, POSTER_DIR, `${id}.jpg`)) ? `${ASSET_PREFIX}video/${id}.jpg` : null),
	};
}

/** True when every input the stream is built from is on disk. A Bazel unit-test sandbox holds only part of them. */
export const sourcesPresent = (root = '.') => [POSTS_DIR, GALLERY_FILE, PULSE_FILE, 'static/images/posts', POSTER_DIR].every((path) => existsSync(join(root, path)));

export const serializeStream = (file: StreamFile) => `${JSON.stringify(file)}\n`;

export const buildCommittedStream = (root = '.') => buildStream(readSources(root));
