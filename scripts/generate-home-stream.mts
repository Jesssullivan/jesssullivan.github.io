#!/usr/bin/env node
/**
 * Producer for the home stream (TIN-8657).
 *
 *   tsx scripts/generate-home-stream.mts          write static/data/home-stream.v1.json
 *   tsx scripts/generate-home-stream.mts --check  exit 1 when the committed file is stale
 *
 * One file holds every item of the stream, newest first, in one shape: posts,
 * the committed Pulse snapshot, the photo gallery, and the recordings and
 * videos of the Music page. It is built from committed files only, with no
 * clock and no network, so the same sources always give the same bytes.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { STREAM_OUTPUT, buildCommittedStream, serializeStream } from './lib/home-stream-sources.mjs';

const check = process.argv.includes('--check');
const stream = buildCommittedStream();
const next = serializeStream(stream);
const current = existsSync(STREAM_OUTPUT) ? readFileSync(STREAM_OUTPUT, 'utf-8') : '';

const kinds = Object.entries(stream.counts)
	.map(([kind, count]) => `${kind} ${count}`)
	.join(', ');
const left = stream.leftOut;
console.log(`Home stream: ${stream.items.length} items (${kinds}). Heading: ${stream.heading.join(', ') || 'none'}.`);
console.log(`Left out: ${left.photographsWithoutPost} photographs no public post uses, ${left.videosWithoutDate} videos with no date, ${left.undated} undated. ${left.coversNotOwn} posts show no cover, because their text never uses it.`);

if (check) {
	if (current !== next) {
		console.error(`Stale: ${STREAM_OUTPUT}. Run: just home-stream`);
		process.exit(1);
	}
	console.log(`${STREAM_OUTPUT} is current.`);
} else if (current !== next) {
	writeFileSync(STREAM_OUTPUT, next);
	console.log(`Wrote ${STREAM_OUTPUT} (${Buffer.byteLength(next)} bytes).`);
} else {
	console.log(`${STREAM_OUTPUT} is unchanged.`);
}
