#!/usr/bin/env node
/**
 * Producer for the reader constellation (TIN-5680, TIN-8628, child of TIN-2413).
 *
 *   tsx scripts/generate-posts-projection.mts          warm refit from the committed projection
 *   tsx scripts/generate-posts-projection.mts --cold   explicit cold refit (seeded random start)
 *   tsx scripts/generate-posts-projection.mts --check  exit 1 when a committed file is stale
 *
 * Inputs are only published posts (`published: true`) under src/posts: title,
 * description, tags, category, date and body text. No network access, no
 * numerical packages. Three files are committed under src/lib/data:
 *
 *   posts-projection.v1.json           the t-SNE fit: where each post sits
 *   constellation.v1.json              the map layout built from it: constellations, names,
 *                                      figure lines, sizes, glows, neighbours and
 *                                      where each title shows
 *   constellation-silhouette.v1.json   the same stars as paths, for the first paint
 *
 * The build does no layout work. It emits constellation.v1.json with a content
 * hash in its name, and the section fetches it when it nears the viewport.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { embedPosts, serializeProjection } from '../src/lib/reader/projection/embed.ts';
import { layoutConstellation, serializeLayout, silhouetteOf } from '../src/lib/reader/projection/layout.ts';
import { CONSTELLATION_OUTPUT, PROJECTION_OUTPUT, SILHOUETTE_OUTPUT, readPublishedPosts } from './lib/posts-projection-sources.mts';

const read = (path: string) => (existsSync(path) ? readFileSync(path, 'utf-8') : null);

function main(argv: string[]): number {
	const cold = argv.includes('--cold');
	const check = argv.includes('--check');
	const previousText = read(PROJECTION_OUTPUT);
	const previous = previousText ? JSON.parse(previousText) : null;
	const started = performance.now();
	const posts = readPublishedPosts();
	const projection = embedPosts(posts, previous, { cold });
	const layout = layoutConstellation(projection, posts);
	const outputs: Array<[string, string]> = [
		[PROJECTION_OUTPUT, serializeProjection(projection)],
		[CONSTELLATION_OUTPUT, serializeLayout(layout)],
		[SILHOUETTE_OUTPUT, serializeLayout(silhouetteOf(layout))],
	];
	const stale = outputs.filter(([path, text]) => read(path) !== text).map(([path]) => path);
	const summary =
		`${projection.posts.length} posts, ${projection.edges.length} edges, ` +
		`${projection.embedding.initialization}, ${projection.embedding.iterations} iterations, ` +
		`KL ${projection.embedding.kl_divergence}, neighbour overlap ${projection.metrics.neighbor_overlap}, ` +
		`displacement max ${projection.metrics.display_displacement_max}, ` +
		`${layout.groups.filter((group) => group.name).length} named constellations (${layout.groups.map((group) => group.name).filter(Boolean).join(', ')}), ` +
		`${layout.groups.filter((group) => !group.name).length} figures without a name, ` +
		`${layout.figure.length} figure lines, ${layout.stars.filter((star) => star[4] < 0).length} stars outside a figure, ` +
		`${layout.titles.wide.filter(Boolean).length} and ${layout.titles.tall.filter(Boolean).length} titles placed (${Math.round(performance.now() - started)} ms)`;
	if (check) {
		if (stale.length === 0) {
			console.log(`Posts projection and constellation layout are current: ${outputs.map(([path]) => path).join(', ')}`);
			return 0;
		}
		const before = new Set<string>((previous?.posts ?? []).map((post: { slug: string }) => post.slug));
		const after = new Set(projection.posts.map((post) => post.slug));
		const added = [...after].filter((slug) => !before.has(slug)).length;
		const removed = [...before].filter((slug) => !after.has(slug)).length;
		console.error(`Stale: ${stale.join(', ')} (${added} posts added, ${removed} removed). Run: just posts-projection`);
		return 1;
	}
	if (stale.length === 0) {
		console.log(`Posts projection unchanged: ${summary}`);
		return 0;
	}
	for (const [path, text] of outputs) if (stale.includes(path)) writeFileSync(path, text, 'utf-8');
	console.log(`Wrote ${stale.join(', ')}: ${summary}`);
	return 0;
}

process.exitCode = main(process.argv.slice(2));
