// Pure blend/merge for the shadow ingestion "stream": one reverse-chronological,
// tier-weighted timeline that interleaves long-form blog POSTS with public
// PULSE items. Kept framework-free so the merge+sort is unit-testable without a
// DOM, and so /stream/+page.ts can call it at prerender time.
//
// Tiers here are reader-weight / IA ONLY (docs/blog-editorial-taxonomy-2026-07-03.md):
// never authorization, privacy, or ActivityPub-delivery signals. `editorial_tier`
// (posts) and `salience` (pulses) are the same display union.

import type { Post, PostEditorialTier } from '$lib/types';
import type { PublicPulseItem } from '@blog/pulse-core/schema';

export type StreamItemKind = 'post' | 'pulse';

/** A single blended timeline entry — a post or a pulse flattened to one shape. */
export interface StreamItem {
	readonly kind: StreamItemKind;
	/** Stable, namespaced id (`post:<slug>` / `pulse:<id>`) — also the sort tie-break. */
	readonly id: string;
	readonly title: string;
	readonly summary: string;
	/** ISO date (post `YYYY-MM-DD`) or ISO datetime (pulse `occurredAt`). */
	readonly date: string;
	/** Reader-weight tier: post `editorial_tier` or pulse `salience`. Absent = untiered. */
	readonly tier?: PostEditorialTier;
	readonly url: string;
	/** Present only for pulses, so the reader can show the pulse sub-kind icon. */
	readonly pulseKind?: PublicPulseItem['kind'];
}

export function postToStreamItem(post: Post): StreamItem {
	return {
		kind: 'post',
		id: `post:${post.slug}`,
		title: post.title,
		summary: post.description ?? post.excerpt ?? post.body_excerpt ?? '',
		date: post.date,
		tier: post.editorial_tier,
		url: `/blog/${post.slug}`,
	};
}

export function pulseItemToStreamItem(item: PublicPulseItem): StreamItem {
	const summary = item.kind === 'bird_sighting' ? (item.birdSighting?.placeLabel ?? '') : item.content;
	return {
		kind: 'pulse',
		id: `pulse:${item.id}`,
		title: item.summary,
		summary,
		date: item.occurredAt,
		tier: item.salience,
		url: '/pulse',
		pulseKind: item.kind,
	};
}

// `noteworthy` floats gently up WITHIN an equal date; untiered and
// less-noteworthy keep weight 0. Mirrors the #217 blog-index comparator so the
// two surfaces rank consistently. This never influences delivery or policy.
function noteworthyWeight(tier: PostEditorialTier | undefined): number {
	return tier === 'noteworthy' ? 1 : 0;
}

/**
 * Total order over blended items: date desc primary; within an equal date,
 * noteworthy first; then a stable id tie-break so the result is fully
 * deterministic regardless of input order (never relies on sort stability).
 */
export function compareStreamItems(a: StreamItem, b: StreamItem): number {
	const ad = new Date(a.date).getTime();
	const bd = new Date(b.date).getTime();
	if (ad !== bd) return bd - ad;

	const weightDiff = noteworthyWeight(b.tier) - noteworthyWeight(a.tier);
	if (weightDiff !== 0) return weightDiff;

	if (a.id < b.id) return -1;
	if (a.id > b.id) return 1;
	return 0;
}

/**
 * Merge published posts + public pulses into one reverse-chronological,
 * tier-weighted timeline. Pure and deterministic: same inputs (in any order)
 * always yield the same ordering. Handles empty inputs and absent tiers.
 */
export function blendStream(posts: readonly Post[], pulseItems: readonly PublicPulseItem[]): StreamItem[] {
	const items: StreamItem[] = [...posts.map(postToStreamItem), ...pulseItems.map(pulseItemToStreamItem)];
	return items.sort(compareStreamItems);
}
