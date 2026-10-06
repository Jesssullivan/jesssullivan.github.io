// Pure scene model for the interactive project map: layout in stage pixels,
// adjacency from the supplied similarity edges (R76: kNN k=3, w >= 0.15),
// hit testing (d3-delaunay), category hulls (d3-polygon), keyboard
// navigation along edges, search and the cluster assembly / warm-start tween.
// No DOM access, so it is unit tested directly (mapScene.test.ts).
import { Delaunay } from 'd3-delaunay';
import { polygonHull } from 'd3-polygon';
import { topLanguages, type ProfileView } from '$lib/profile/view';
import { shapeFor, type Shape } from './shapes';

export { SHAPES, shapeFor, shapePath, type Shape } from './shapes';

export interface SceneNode {
	index: number;
	id: string;
	label: string;
	link: string | null;
	category: string;
	categoryLabel: string;
	catIndex: number;
	languages: string[];
	archived: boolean;
	/** Final layout position (stage px, before zoom). */
	x: number;
	y: number;
	/** Start of the entrance motion: previous release position when supplied, else the cluster centroid. */
	sx: number;
	sy: number;
	hasPrev: boolean;
}

export interface SceneEdge {
	a: number;
	b: number;
	w: number;
}

export interface SceneCategory {
	id: string;
	label: string;
	index: number;
	shape: Shape;
	members: number[];
	centroid: [number, number];
	hull: [number, number][] | null;
}

export interface PlotBox {
	x: number;
	y: number;
	size: number;
}

export interface Scene {
	width: number;
	height: number;
	plot: PlotBox;
	nodes: SceneNode[];
	edges: SceneEdge[];
	adjacency: number[][];
	categories: SceneCategory[];
	byId: Map<string, number>;
	delaunay: Delaunay<SceneNode>;
}

export interface SceneOptions {
	width: number;
	height: number;
	/** Inner margin in px kept clear for markers and labels. */
	padding?: number;
}

/** Largest centred square inside the stage, minus padding (t-SNE axes are isotropic). */
export function plotBox(width: number, height: number, padding = 32): PlotBox {
	const size = Math.max(1, Math.min(width, height) - padding * 2);
	return { x: (width - size) / 2, y: (height - size) / 2, size };
}

type SceneInput = Pick<ProfileView, 'repos' | 'edges' | 'categories'>;

export function buildScene(view: SceneInput, options: SceneOptions): Scene {
	const { width, height } = options;
	const plot = plotBox(width, height, options.padding ?? 32);
	const catIndex = new Map(view.categories.map((c, i) => [c.id, i]));
	const catLabel = new Map(view.categories.map((c) => [c.id, c.label]));
	const px = (u: number) => plot.x + u * plot.size;
	const py = (u: number) => plot.y + u * plot.size;

	const nodes: SceneNode[] = view.repos.map((r, index) => {
		const hasPrev = r.x_prev !== undefined && r.y_prev !== undefined;
		return {
			index,
			id: r.id,
			label: r.label,
			link: r.link,
			category: r.category,
			categoryLabel: catLabel.get(r.category) ?? r.category,
			catIndex: catIndex.get(r.category) ?? 0,
			languages: topLanguages(r, 3).map((l) => l.name),
			archived: r.archived,
			x: px(r.x),
			y: py(r.y),
			sx: hasPrev ? px(r.x_prev!) : 0,
			sy: hasPrev ? py(r.y_prev!) : 0,
			hasPrev,
		};
	});
	const byId = new Map(nodes.map((n) => [n.id, n.index]));

	const categories: SceneCategory[] = view.categories.map((c, index) => {
		const members = nodes.filter((n) => n.category === c.id).map((n) => n.index);
		const pts = members.map((i) => [nodes[i].x, nodes[i].y] as [number, number]);
		const centroid: [number, number] = pts.length
			? [pts.reduce((s, p) => s + p[0], 0) / pts.length, pts.reduce((s, p) => s + p[1], 0) / pts.length]
			: [plot.x + plot.size / 2, plot.y + plot.size / 2];
		return {
			id: c.id,
			label: c.label,
			index,
			shape: shapeFor(index),
			members,
			centroid,
			hull: pts.length >= 3 ? polygonHull(pts) : null,
		};
	});
	for (const n of nodes) {
		if (!n.hasPrev) {
			const c = categories[n.catIndex].centroid;
			n.sx = c[0];
			n.sy = c[1];
		}
	}

	const adjacency: number[][] = nodes.map(() => []);
	const edges: SceneEdge[] = [];
	for (const e of view.edges) {
		const a = byId.get(e.a);
		const b = byId.get(e.b);
		if (a === undefined || b === undefined || a === b) continue;
		edges.push({ a, b, w: e.w });
		adjacency[a].push(b);
		adjacency[b].push(a);
	}

	const delaunay = Delaunay.from(
		nodes,
		(n) => n.x,
		(n) => n.y,
	);
	return { width, height, plot, nodes, edges, adjacency, categories, byId, delaunay };
}

/**
 * Nearest visible node to a stage point within maxDist (stage px), or -1.
 * d3-delaunay answers the common case; a hidden hit falls back to a scan.
 */
export function nearestNode(
	scene: Scene,
	x: number,
	y: number,
	maxDist: number,
	visible?: (i: number) => boolean,
): number {
	if (scene.nodes.length === 0) return -1;
	let best = scene.delaunay.find(x, y);
	if (visible && !visible(best)) {
		best = -1;
		let bestD = Infinity;
		for (const n of scene.nodes) {
			if (!visible(n.index)) continue;
			const d = Math.hypot(n.x - x, n.y - y);
			if (d < bestD) {
				bestD = d;
				best = n.index;
			}
		}
		if (best < 0) return -1;
	}
	const n = scene.nodes[best];
	return Math.hypot(n.x - x, n.y - y) <= maxDist ? best : -1;
}

export type Direction = 'left' | 'right' | 'up' | 'down';
const VECTORS: Record<Direction, [number, number]> = {
	left: [-1, 0],
	right: [1, 0],
	up: [0, -1],
	down: [0, 1],
};

/**
 * Arrow-key navigation: follow the similarity edge that best matches the
 * direction; when no edge points that way, step to the nearest visible node
 * in that half-plane so every project stays reachable.
 */
export function neighborInDirection(
	scene: Scene,
	from: number,
	dir: Direction,
	visible?: (i: number) => boolean,
): number {
	const origin = scene.nodes[from];
	if (!origin) return -1;
	const [dx, dy] = VECTORS[dir];
	const score = (i: number, minCos: number): number | null => {
		const n = scene.nodes[i];
		const vx = n.x - origin.x;
		const vy = n.y - origin.y;
		const d = Math.hypot(vx, vy);
		if (d === 0) return null;
		const cos = (vx * dx + vy * dy) / d;
		if (cos < minCos) return null;
		return d * (2 - cos);
	};
	const pick = (candidates: Iterable<number>, minCos: number): number => {
		let best = -1;
		let bestScore = Infinity;
		for (const i of candidates) {
			if (i === from || (visible && !visible(i))) continue;
			const s = score(i, minCos);
			if (s !== null && s < bestScore) {
				bestScore = s;
				best = i;
			}
		}
		return best;
	};
	const viaEdge = pick(scene.adjacency[from], 0.35);
	if (viaEdge >= 0) return viaEdge;
	return pick(
		scene.nodes.map((n) => n.index),
		0.5,
	);
}

/** Case-insensitive match on label, category and language names. */
export function matchNodes(scene: Scene, query: string): Set<number> {
	const q = query.trim().toLowerCase();
	const out = new Set<number>();
	if (!q) return out;
	for (const n of scene.nodes) {
		const hay = `${n.label} ${n.categoryLabel} ${n.languages.join(' ')}`.toLowerCase();
		if (hay.includes(q)) out.add(n.index);
	}
	return out;
}

export function easeOutCubic(t: number): number {
	const c = Math.min(1, Math.max(0, t));
	return 1 - (1 - c) ** 3;
}

export interface AssemblyOptions {
	/** Per-node travel time, ms. */
	duration?: number;
	/** Delay between successive categories, ms (cluster-by-cluster arrival). */
	stagger?: number;
}

export interface AssemblyFrame {
	positions: Float32Array;
	alpha: Float32Array;
	done: boolean;
}

/** Total entrance time for a scene, ms. */
export function assemblyDuration(scene: Scene, options: AssemblyOptions = {}): number {
	const duration = options.duration ?? 900;
	const stagger = options.stagger ?? 140;
	const tween = scene.nodes.some((n) => n.hasPrev);
	return tween ? duration : duration + stagger * Math.max(0, scene.categories.length - 1);
}

/**
 * Entrance motion at `elapsed` ms. Without previous positions each cluster
 * grows out of its centroid, one category after another; with x_prev/y_prev
 * every node tweens from last release's place at once (R77 warm start).
 */
export function assemblyFrame(scene: Scene, elapsed: number, options: AssemblyOptions = {}): AssemblyFrame {
	const duration = options.duration ?? 900;
	const stagger = options.stagger ?? 140;
	const n = scene.nodes.length;
	const positions = new Float32Array(n * 2);
	const alpha = new Float32Array(n);
	const tween = scene.nodes.some((node) => node.hasPrev);
	let done = true;
	for (const node of scene.nodes) {
		const delay = tween ? 0 : node.catIndex * stagger;
		const raw = (elapsed - delay) / duration;
		if (raw < 1) done = false;
		const t = easeOutCubic(raw);
		positions[node.index * 2] = node.sx + (node.x - node.sx) * t;
		positions[node.index * 2 + 1] = node.sy + (node.y - node.sy) * t;
		alpha[node.index] = tween && node.hasPrev ? 1 : Math.min(1, Math.max(0, raw * 2.5));
	}
	return { positions, alpha, done };
}

/** Final positions (reduced motion, or after the entrance). */
export function restingFrame(scene: Scene): AssemblyFrame {
	const positions = new Float32Array(scene.nodes.length * 2);
	const alpha = new Float32Array(scene.nodes.length).fill(1);
	for (const node of scene.nodes) {
		positions[node.index * 2] = node.x;
		positions[node.index * 2 + 1] = node.y;
	}
	return { positions, alpha, done: true };
}
