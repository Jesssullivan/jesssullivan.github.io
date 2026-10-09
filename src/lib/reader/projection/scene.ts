/**
 * Browser-safe view of the committed posts projection (TIN-5680).
 *
 * No fetch, no numerical work: the projection JSON is imported at build time
 * and joined with the posts the reader can already route to. A post that is
 * not routeable (held, unpublished or broker-only) is never drawn, and a
 * routeable post the projection does not know yet is reported, not invented.
 */
import type { Post } from '#lib/posts.js';

export interface ProjectionDocument {
	schema: string;
	note: string;
	posts: ReadonlyArray<{ slug: string; x: number; y: number }>;
	edges: ReadonlyArray<readonly [number, number, number]>;
}

export interface SceneNode {
	index: number;
	slug: string;
	title: string;
	date: string;
	href: string;
	x: number;
	y: number;
}

export interface Scene {
	nodes: SceneNode[];
	edges: Array<[number, number]>;
	adjacency: number[][];
	bySlug: Map<string, number>;
	/** Routeable posts the committed projection has not placed yet. */
	unplaced: Post[];
	note: string;
}

export type Direction = 'left' | 'right' | 'up' | 'down';

const VECTORS: Record<Direction, [number, number]> = {
	left: [-1, 0],
	right: [1, 0],
	up: [0, -1],
	down: [0, 1],
};

export function isProjectionDocument(value: unknown): value is ProjectionDocument {
	if (!value || typeof value !== 'object') return false;
	const doc = value as Partial<ProjectionDocument>;
	return (
		doc.schema === 'posts-projection.v1' &&
		typeof doc.note === 'string' &&
		Array.isArray(doc.posts) &&
		Array.isArray(doc.edges) &&
		doc.posts.every(
			(post) =>
				typeof post?.slug === 'string' &&
				Number.isFinite(post.x) &&
				Number.isFinite(post.y) &&
				post.x >= 0 &&
				post.x <= 1 &&
				post.y >= 0 &&
				post.y <= 1,
		) &&
		doc.edges.every(
			(edge) =>
				Array.isArray(edge) &&
				Number.isInteger(edge[0]) &&
				Number.isInteger(edge[1]) &&
				edge[0] >= 0 &&
				edge[1] < (doc.posts as unknown[]).length &&
				edge[0] < edge[1],
		)
	);
}

/** Join the projection with routeable posts; nodes keep the projection's slug order. */
export function buildScene(projection: unknown, routeablePosts: readonly Post[]): Scene | null {
	if (!isProjectionDocument(projection)) return null;
	const routeable = new Map(routeablePosts.map((post) => [post.slug, post]));
	const nodes: SceneNode[] = [];
	const projected = new Map<number, number>();
	projection.posts.forEach((point, sourceIndex) => {
		const post = routeable.get(point.slug);
		if (!post) return;
		projected.set(sourceIndex, nodes.length);
		nodes.push({
			index: nodes.length,
			slug: post.slug,
			title: post.title,
			date: post.date,
			href: `/blog/${post.slug}`,
			x: point.x,
			y: point.y,
		});
	});
	const edges: Array<[number, number]> = [];
	const weighted: Array<Array<[number, number]>> = nodes.map(() => []);
	for (const [a, b, weight] of projection.edges) {
		const from = projected.get(a);
		const to = projected.get(b);
		if (from === undefined || to === undefined) continue;
		edges.push([from, to]);
		weighted[from].push([to, weight]);
		weighted[to].push([from, weight]);
	}
	// Strongest input similarity first; ties by slug order (node index).
	const adjacency = weighted.map((list) => list.sort((p, q) => q[1] - p[1] || p[0] - q[0]).map(([i]) => i));
	const placed = new Set(nodes.map((node) => node.slug));
	return {
		nodes,
		edges,
		adjacency,
		bySlug: new Map(nodes.map((node) => [node.slug, node.index])),
		unplaced: routeablePosts.filter((post) => !placed.has(post.slug)),
		note: projection.note,
	};
}

/**
 * The next node in an arrow-key direction: prefer a similarity neighbour
 * roughly that way, otherwise the nearest node within a 60-degree cone.
 * Mirrors the #288 project map's `neighborInDirection`.
 */
export function neighborInDirection(scene: Scene, from: number, dir: Direction): number {
	const origin = scene.nodes[from];
	if (!origin) return -1;
	const [dx, dy] = VECTORS[dir];
	const pick = (candidates: Iterable<number>, minCos: number): number => {
		let best = -1;
		let bestScore = Infinity;
		for (const i of candidates) {
			if (i === from) continue;
			const node = scene.nodes[i];
			const vx = node.x - origin.x;
			const vy = node.y - origin.y;
			const distance = Math.hypot(vx, vy);
			if (distance === 0) continue;
			const cos = (vx * dx + vy * dy) / distance;
			if (cos < minCos) continue;
			const score = distance * (2 - cos);
			if (score < bestScore) {
				bestScore = score;
				best = i;
			}
		}
		return best;
	};
	const viaEdge = pick(scene.adjacency[from] ?? [], 0.35);
	if (viaEdge >= 0) return viaEdge;
	return pick(
		scene.nodes.map((node) => node.index),
		0.5,
	);
}

/** Reading order entry point: the top-left-most node. */
export function firstInReadingOrder(scene: Scene): number {
	let best = -1;
	let score = Infinity;
	for (const node of scene.nodes) {
		const value = node.y * 2 + node.x;
		if (value < score) {
			score = value;
			best = node.index;
		}
	}
	return best;
}

/** Similarity neighbours of one node, strongest first. */
export function neighboursOf(scene: Scene, index: number): SceneNode[] {
	return (scene.adjacency[index] ?? []).map((i) => scene.nodes[i]);
}
