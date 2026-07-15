// Pure, framework-free model for the "/" Observatory Ledger reader (TIN-2903).
// This is the ONLY place the reader decides what is "noteworthy", and it does so
// strictly from the explicit `editorial_tier` frontmatter field. Tier is
// reader-weight / IA ONLY (docs/blog-editorial-taxonomy-2026-07-03.md): it is
// NEVER inferred from `featured`, category, tags, length, recency, or author,
// and it is never an authorization, privacy, or ActivityPub-delivery signal.
// Kept DOM-free so the partition + grouping stay unit-testable and callable at
// prerender time.

import type { Post, PostEditorialTier } from '$lib/types';
import type { PublicPulseItem } from '@blog/pulse-core/schema';

// Node provenance in the constellation model. `pulse` items ride alongside blog
// `post`s; the union is intentionally open so a future stratum (e.g. a
// git-pulse or signal-boost node) can join without reshaping callers.
export type LedgerNodeKind = 'post' | 'pulse';

export interface PartitionedLedger {
	readonly noteworthy: Post[];
	readonly lessNoteworthy: Post[];
	readonly unclassified: Post[];
}

// Date-desc primary, slug asc tie-break: a total order that does not rely on
// input order or sort stability, so a reordered input yields identical output.
function byDateDescThenSlug(a: Post, b: Post): number {
	const ad = new Date(a.date).getTime();
	const bd = new Date(b.date).getTime();
	if (ad !== bd) return bd - ad;
	if (a.slug < b.slug) return -1;
	if (a.slug > b.slug) return 1;
	return 0;
}

/**
 * Split posts into the two editorial registers plus an `unclassified` bucket,
 * strictly on the explicit `editorial_tier`. A post that is `featured` (or in
 * any category, or heavily tagged) but carries no tier lands in `unclassified`
 * — never promoted by inference. Every input post appears in exactly one
 * bucket (N in -> N out); each bucket is date-desc with a slug tie-break.
 */
export function partitionLedger(posts: readonly Post[]): PartitionedLedger {
	const noteworthy: Post[] = [];
	const lessNoteworthy: Post[] = [];
	const unclassified: Post[] = [];

	for (const post of posts) {
		if (post.editorial_tier === 'noteworthy') noteworthy.push(post);
		else if (post.editorial_tier === 'less-noteworthy') lessNoteworthy.push(post);
		else unclassified.push(post);
	}

	noteworthy.sort(byDateDescThenSlug);
	lessNoteworthy.sort(byDateDescThenSlug);
	unclassified.sort(byDateDescThenSlug);

	return { noteworthy, lessNoteworthy, unclassified };
}

// A single point in the constellation — a post or a pulse flattened to one
// shape the masthead render and the accessible disclosure section can share.
export interface ConstellationNode {
	readonly kind: LedgerNodeKind;
	// Stable, namespaced id (`post:<slug>` / `pulse:<id>`).
	readonly id: string;
	readonly label: string;
	readonly href: string;
	// Reader-weight tier (post `editorial_tier` / pulse `salience`). Absent = untiered.
	readonly tier?: PostEditorialTier;
}

export interface ConstellationGroup {
	// Normalized grouping key (lowercased category / tag, or `pulse`).
	readonly key: string;
	readonly label: string;
	// How this group was formed — honest by construction, never an embedding.
	readonly basis: 'category' | 'tag' | 'pulse';
	readonly nodes: ConstellationNode[];
}

function postToNode(post: Post): ConstellationNode {
	return {
		kind: 'post',
		id: `post:${post.slug}`,
		label: post.title,
		href: `/blog/${post.slug}`,
		tier: post.editorial_tier,
	};
}

function pulseToNode(item: PublicPulseItem): ConstellationNode {
	return {
		kind: 'pulse',
		id: `pulse:${item.id}`,
		label: item.summary,
		href: '/pulse',
		tier: item.salience,
	};
}

// A post's honest home: its typed `category`, else its first tag, else a shared
// `uncategorized` group. No embedding, no similarity model — just the metadata
// already on the post.
function groupingFor(post: Post): { key: string; label: string; basis: 'category' | 'tag' } {
	if (post.category) return { key: post.category, label: post.category, basis: 'category' };
	const firstTag = post.tags.find((t) => t.trim().length > 0);
	if (firstTag) return { key: firstTag.toLowerCase(), label: firstTag, basis: 'tag' };
	return { key: 'uncategorized', label: 'uncategorized', basis: 'category' };
}

/**
 * Group posts by their existing category/tag metadata, plus a single `pulse`
 * group for the live snapshot. Deterministic and honest by construction: every
 * post falls into exactly one group (N in -> N out) sorted date-desc/slug, the
 * post groups are ordered by key so any input reordering yields identical
 * output, and the pulse group preserves producer order (never re-ranked). The
 * pulse group is appended last as a distinct live stratum.
 */
export function buildConstellationGroups(
	posts: readonly Post[],
	pulseItems: readonly PublicPulseItem[],
): ConstellationGroup[] {
	const byKey = new Map<string, { label: string; basis: 'category' | 'tag'; posts: Post[] }>();

	for (const post of posts) {
		const { key, label, basis } = groupingFor(post);
		const bucket = byKey.get(key);
		if (bucket) bucket.posts.push(post);
		else byKey.set(key, { label, basis, posts: [post] });
	}

	const groups: ConstellationGroup[] = [...byKey.entries()]
		.sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0))
		.map(([key, bucket]) => ({
			key,
			label: bucket.label,
			basis: bucket.basis,
			nodes: [...bucket.posts].sort(byDateDescThenSlug).map(postToNode),
		}));

	if (pulseItems.length > 0) {
		groups.push({
			key: 'pulse',
			label: 'pulse',
			basis: 'pulse',
			// Producer order preserved — pulse is never re-ranked.
			nodes: pulseItems.map(pulseToNode),
		});
	}

	return groups;
}
