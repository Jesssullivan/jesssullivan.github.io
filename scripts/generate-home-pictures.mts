#!/usr/bin/env node
/**
 * Small sizes of the pictures of the home stream (TIN-8657).
 *
 *   tsx scripts/generate-home-pictures.mts          write the ones that are missing or stale
 *   tsx scripts/generate-home-pictures.mts --check  exit 1 when one is missing or stale
 *
 * The site keeps each picture of a post at one size, 1200 pixels wide at most. The home stream
 * draws many of them far smaller: in a row under a lead, and on a phone. For every picture the
 * stream shows that is wide enough to gain from it, this writes the same picture 640 pixels wide
 * under static/images/home, as WebP and, where the site serves AVIF for it, as AVIF.
 *
 * The files are committed, like the other sizes the site serves, so a build makes none. A file is
 * stale when its shape is not its source's shape. Nothing here reads a clock or the network.
 */
import { existsSync, mkdirSync, readdirSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import sharp from 'sharp';
import { SMALL_DIR, SMALL_WIDTH, buildCommittedStream, imageSize, readHead, smallNames } from './lib/home-stream-sources.mjs';
import type { StreamImage } from '../src/lib/home/stream';

const check = process.argv.includes('--check');
const STATIC = 'static';
const WEBP_QUALITY = 78;
const AVIF_QUALITY = 54;

const wanted = new Map<string, StreamImage>();
for (const item of buildCommittedStream().items) {
	for (const media of item.media) if (media.type === 'image' && media.small) wanted.set(media.src, media);
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

// A small file whose picture left the stream is of no use to anyone.
const dir = join(STATIC, SMALL_DIR);
const strays = existsSync(dir) ? readdirSync(dir).map((name) => join(dir, name)).filter((path) => !kept.has(path)) : [];
if (!check) for (const path of strays) unlinkSync(path);

console.log(`Home pictures: ${wanted.size} pictures of the stream have a small size, ${SMALL_WIDTH} pixels wide. ${check ? `${missing.length} missing or stale, ${strays.length} of no use.` : `Wrote ${made} files, removed ${strays.length}.`}`);
if (check && (missing.length || strays.length)) {
	for (const name of missing.slice(0, 20)) console.error(`  missing or stale: ${name}`);
	for (const path of strays.slice(0, 20)) console.error(`  of no use: ${path}`);
	console.error('Run: just home-pictures');
	process.exit(1);
}
