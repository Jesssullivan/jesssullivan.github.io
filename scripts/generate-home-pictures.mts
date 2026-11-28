#!/usr/bin/env node
/**
 * Small sizes of the pictures of the home stream (TIN-8657).
 *
 *   tsx scripts/generate-home-pictures.mts          write the ones that are missing or stale
 *   tsx scripts/generate-home-pictures.mts --check  exit 1 when one is missing or stale
 *
 * The site keeps each picture of a post at one size, 1200 pixels wide at most. The home stream
 * draws many of them far smaller: in a row under a lead, and on a phone. For every picture the
 * stream shows that is wide enough to gain from it, this writes the same picture 720 pixels wide
 * under static/images/home, as WebP and, where the site serves AVIF for it, as AVIF.
 *
 * It also writes the two files of a moving picture: its first frame, and the whole of it as an animated
 * WebP. And beside the poster of a video, which is a committed JPEG under src/lib/assets/home/video, it
 * writes the poster as WebP, and at 640 pixels wide when the poster is 1000 wide or more.
 *
 * The files are committed, like the other sizes the site serves, so a build makes none. A file is
 * stale when its shape is not its source's shape. Nothing here reads a clock or the network.
 */
import { existsSync, mkdirSync, readdirSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import sharp from 'sharp';
import { ASSET_DIR, ASSET_PREFIX, SMALL_DIR, SMALL_WIDTH, buildCommittedStream, imageSize, readHead, smallNames } from './lib/home-stream-sources.mjs';
import type { StreamImage } from '../src/lib/home/stream';

const check = process.argv.includes('--check');
const STATIC = 'static';
const WEBP_QUALITY = 78;
const AVIF_QUALITY = 54;

const STILL_QUALITY = 80;
const MOVING_QUALITY = 70;

const wanted = new Map<string, StreamImage>();
const moving = new Map<string, StreamImage>();
const posters = new Map<string, StreamImage>();
for (const item of buildCommittedStream().items) {
	for (const media of item.media) {
		if (media.type === 'image' && media.small) wanted.set(media.src, media);
		if (media.type === 'image' && media.motion) moving.set(media.src, media);
		if (media.type === 'youtube' && media.poster) posters.set(media.poster.src, media.poster);
	}
}

const heightFor = (image: StreamImage) => Math.round((image.height * SMALL_WIDTH) / image.width);
/** A small file is current when it is there and has its source's shape. Only a WebP states its size in a way read here. */
function current(path: string, image: StreamImage): boolean {
	if (!existsSync(path)) return false;
	if (!path.endsWith('.webp')) return true;
	const size = imageSize(readHead(path));
	return size?.width === SMALL_WIDTH && Math.abs(size.height - heightFor(image)) <= 1;
}

let made = 0;
const missing: string[] = [];
const kept = new Set<string>();
if (!check) mkdirSync(join(STATIC, SMALL_DIR), { recursive: true });
for (const [src, image] of [...wanted].sort(([a], [b]) => a.localeCompare(b))) {
	const names = smallNames(src);
	const webp = join(STATIC, names.webp);
	const avif = image.small?.avif ? join(STATIC, names.avif) : null;
	kept.add(webp);
	if (avif) kept.add(avif);
	// The AVIF follows the WebP: when the source changed shape, both are made again.
	const fresh = current(webp, image) && (!avif || existsSync(avif));
	if (fresh) continue;
	if (check) {
		missing.push(names.webp);
		continue;
	}
	const source = join(STATIC, src);
	await sharp(source).resize(SMALL_WIDTH).webp({ quality: WEBP_QUALITY }).toFile(webp);
	if (avif) await sharp(source).resize(SMALL_WIDTH).avif({ quality: AVIF_QUALITY }).toFile(avif);
	made += avif ? 2 : 1;
}

/** True when a WebP is on disk with this shape. */
const shaped = (path: string, width: number, height: number) => {
	if (!existsSync(path)) return false;
	const size = imageSize(readHead(path));
	return size?.width === width && Math.abs((size?.height ?? 0) - height) <= 1;
};

// A moving picture: its first frame, to show while it rests, and the whole of it in a format a fifth of the size.
for (const [src, image] of [...moving].sort(([a], [b]) => a.localeCompare(b))) {
	const still = join(STATIC, image.motion!.still);
	const whole = join(STATIC, image.motion!.moving);
	kept.add(still);
	kept.add(whole);
	if (shaped(still, image.width, image.height) && shaped(whole, image.width, image.height)) continue;
	if (check) {
		missing.push(image.motion!.still);
		continue;
	}
	const source = join(STATIC, src);
	await sharp(source, { pages: 1 }).webp({ quality: STILL_QUALITY }).toFile(still);
	await sharp(source, { animated: true }).webp({ quality: MOVING_QUALITY, effort: 4 }).toFile(whole);
	made += 2;
}

// A video's poster: the committed JPEG as WebP beside it, and a small size of a large one.
const onDisk = (name: string) => join(ASSET_DIR, name.slice(ASSET_PREFIX.length));
for (const [src, poster] of [...posters].sort(([a], [b]) => a.localeCompare(b))) {
	const source = onDisk(src);
	const jobs: { path: string; name: string; width: number }[] = [];
	if (poster.webp) jobs.push({ path: onDisk(poster.webp), name: poster.webp, width: poster.width });
	if (poster.small?.webp) jobs.push({ path: onDisk(poster.small.webp), name: poster.small.webp, width: poster.small.width });
	// A poster with no WebP yet gets one: the stream names it once the file is there.
	if (!poster.webp) jobs.push({ path: source.replace(/\.jpe?g$/i, '.webp'), name: src.replace(/\.jpe?g$/i, '.webp'), width: poster.width });
	for (const job of jobs) {
		if (shaped(job.path, job.width, Math.round((poster.height * job.width) / poster.width))) continue;
		if (check) {
			missing.push(job.name);
			continue;
		}
		await sharp(source).resize(job.width).webp({ quality: WEBP_QUALITY }).toFile(job.path);
		made += 1;
	}
}

// A small file whose picture left the stream is of no use to anyone.
const dir = join(STATIC, SMALL_DIR);
const strays = existsSync(dir) ? readdirSync(dir).map((name) => join(dir, name)).filter((path) => !kept.has(path)) : [];
if (!check) for (const path of strays) unlinkSync(path);

console.log(`Home pictures: ${wanted.size} pictures of the stream have a small size, ${SMALL_WIDTH} pixels wide. ${moving.size} moving pictures have a still. ${posters.size} videos have a poster. ${check ? `${missing.length} missing or stale, ${strays.length} of no use.` : `Wrote ${made} files, removed ${strays.length}.`}`);
if (check && (missing.length || strays.length)) {
	for (const name of missing.slice(0, 20)) console.error(`  missing or stale: ${name}`);
	for (const path of strays.slice(0, 20)) console.error(`  of no use: ${path}`);
	console.error('Run: just home-pictures');
	process.exit(1);
}
