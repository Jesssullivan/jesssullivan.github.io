#!/usr/bin/env node
/**
 * Producer for the home stream (TIN-8657).
 *
 *   tsx scripts/generate-home-stream.mts          write src/lib/data/home-stream.v1.json
 *   tsx scripts/generate-home-stream.mts --check  exit 1 when the committed file is stale
 *
 * One file holds every item of the stream, newest first, in one shape: posts,
 * the committed Pulse snapshot, the photo gallery, and the recordings and
 * videos of the Music page. Things with one subject are folded into one item
 * by the join rule in src/lib/home/stream.ts. It is built from committed files only, with no
 * clock and no network, so the same sources always give the same bytes.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { STREAM_OUTPUT, buildCommittedStream, readPosts, serializeStream } from './lib/home-stream-sources.mjs';
import { isCutFromBody, plainText } from '../src/lib/home/excerpt';
import { formOf } from '../src/lib/home/forms';

const check = process.argv.includes('--check');
const stream = buildCommittedStream();
const next = serializeStream(stream);
const current = existsSync(STREAM_OUTPUT) ? readFileSync(STREAM_OUTPUT, 'utf-8') : '';

const kinds = Object.entries(stream.counts)
	.map(([kind, count]) => `${kind} ${count}`)
	.join(', ');
const left = stream.leftOut;
console.log(`Home stream: ${stream.items.length} items (${kinds}). Heading: ${stream.heading.join(', ') || 'none'}.`);
// Every group the join rule formed, so a wrong join shows in the log of the run that made it.
const groups = stream.items.filter((item) => item.holds?.length);
const sets = groups.filter((item) => item.holds!.every((part) => part.kind === 'photos'));
console.log(`Folded: ${groups.reduce((sum, item) => sum + item.holds!.length, 0)} items into ${groups.length}. ${sets.length} posts hold their own photographs.`);
for (const item of groups.filter((group) => !sets.includes(group))) console.log(`  ${item.id} holds ${item.holds!.map((part) => part.id).join(', ')}`);
console.log(`Left out: ${left.photographsWithoutPost} photographs no public post uses, ${left.videosWithoutDate} videos with no date, ${left.undated} undated. ${left.coversNotOwn} posts show no cover, because their text never uses it.`);
console.log(`Left out of posts: ${left.picturesMoving} moving pictures, ${left.picturesElsewhere} pictures another site holds, ${left.picturesShared} picture files that more than one post shows.`);
// How much of the stream there is to look at, and how much of it is words alone.
const withPicture = stream.items.filter((item) => item.media.some((media) => media.type === 'image')).length;
const withVideo = stream.items.filter((item) => !item.media.some((media) => media.type === 'image') && item.media.some((media) => media.type === 'youtube')).length;
const withSummary = stream.items.filter((item) => item.kind === 'article' && item.summary).length;
console.log(`To see: ${withPicture} items show a picture of their own, ${withVideo} more show a video, ${stream.items.length - withPicture - withVideo} are words alone. ${withSummary} of ${stream.counts.article} posts have an excerpt.`);
const pictures = stream.items.reduce((sum, item) => sum + item.media.filter((media) => media.type === 'image').length, 0);
const forms = stream.items.reduce<Record<string, number>>((count, item) => ({ ...count, [formOf(item)]: (count[formOf(item)] ?? 0) + 1 }), {});
console.log(`Pictures: ${pictures} in all. On a wide screen: ${forms.plate ?? 0} plates, ${forms.beside ?? 0} beside their words, ${forms.small ?? 0} rows of small pictures, ${forms.words ?? 0} words alone.`);
// Where each excerpt comes from: her own summary, whole or cut at a sentence end, or her first sentences read from the post.
const posts = new Map(readPosts().map((post) => [`post:${post.slug}`, post]));
const from = { whole: 0, cut: 0, post: 0, absent: 0 };
for (const item of stream.items) {
	const post = posts.get(item.id);
	if (!post) continue;
	if (!item.summary) from.absent += 1;
	else if (post.description.trim() === '' || isCutFromBody(post.description, post.body)) from.post += 1;
	else if (item.summary === plainText(post.description)) from.whole += 1;
	else from.cut += 1;
}
console.log(`Excerpts: ${from.whole} are her summary whole, ${from.cut} her summary cut at a sentence end, ${from.post} her first sentences read from the post, ${from.absent} absent.`);

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
