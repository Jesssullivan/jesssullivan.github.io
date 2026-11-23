/**
 * Browser-safe view of the constellation layout (TIN-5680, TIN-8628).
 *
 * The layout file is built ahead of time. Here it is only joined with the
 * posts the reader can already route to. A post that is not routeable (held,
 * unpublished or broker-only) is never drawn, and a routeable post the layout
 * does not know yet is reported, not invented. No numerical work happens here.
 */
import type { Post } from '$lib/posts';
import type { ConstellationData } from './layout';

export interface Star {
	index: number;
	slug: string;
	title: string;
	date: string;
	description: string;
	href: string;
	/** Position in the unit square of the frame in use (wide, or transposed for tall). */
	x: number;
	y: number;
	category: number;
	/** Index into `groups`, or -1. */
	group: number;
	/** 0 to 3 by length. */
	size: number;
	/** 0 to 2 by recency. */
	glow: number;
}

export interface Group {
	name: string;
	/** Label centre, unit square. */
	x: number;
	y: number;
	/** Glow centre and radii, unit square. */
	glow: [number, number, number, number];
	category: number;
	members: number[];
}

export interface Sky {
	stars: Star[];
	groups: Group[];
	figure: Array<[number, number]>;
	/** Per star, the nearest posts, strongest first. */
	near: number[][];
	categories: Array<{ id: string; label: string; count: number }>;
	bySlug: Map<string, number>;
	/** Routeable posts the layout has not placed yet. */
	unplaced: Post[];
}

export type Direction = 'left' | 'right' | 'up' | 'down';

const VECTORS: Record<Direction, [number, number]> = { left: [-1, 0], right: [1, 0], up: [0, -1], down: [0, 1] };
const GRID = 1000;

const isIndex = (value: unknown, limit: number) => Number.isInteger(value) && (value as number) >= 0 && (value as number) < limit;
const onGrid = (value: unknown) => Number.isFinite(value) && (value as number) >= 0 && (value as number) <= GRID;

export function isConstellationData(value: unknown): value is ConstellationData {
	if (!value || typeof value !== 'object') return false;
	const doc = value as Partial<ConstellationData>;
	if (doc.schema !== 'constellation.v1') return false;
	const { stars, groups, figure, near, categories, labels } = doc;
	if (!Array.isArray(stars) || !Array.isArray(groups) || !Array.isArray(figure) || !Array.isArray(near)) return false;
	if (!Array.isArray(categories) || !Array.isArray(labels) || labels.length !== categories.length || near.length !== stars.length) return false;
	return (
		stars.every(
			(star) =>
				Array.isArray(star) &&
				typeof star[0] === 'string' &&
				onGrid(star[1]) &&
				onGrid(star[2]) &&
				isIndex(star[3], categories.length) &&
				(star[4] === -1 || isIndex(star[4], groups.length)) &&
				isIndex(star[5], 4) &&
				isIndex(star[6], 3),
		) &&
		groups.every((group) => typeof group?.name === 'string' && [group.wide, group.tall].every((at) => Array.isArray(at) && at.length === 2 && at.every(Number.isFinite)) && Array.isArray(group.glow) && group.glow.length === 4 && isIndex(group.category, categories.length)) &&
		figure.every((line) => Array.isArray(line) && isIndex(line[0], stars.length) && isIndex(line[1], stars.length)) &&
		near.every((list) => Array.isArray(list) && list.every((index) => isIndex(index, stars.length)))
	);
}

/** Join the layout with routeable posts. Stars keep the layout's slug order. */
export function buildSky(data: unknown, routeablePosts: readonly Post[], tall = false): Sky | null {
	if (!isConstellationData(data)) return null;
	const routeable = new Map(routeablePosts.map((post) => [post.slug, post]));
	const kept = new Map<number, number>();
	const stars: Star[] = [];
	data.stars.forEach(([slug, x, y, category, group, size, glow], source) => {
		const post = routeable.get(slug);
		if (!post) return;
		kept.set(source, stars.length);
		stars.push({
			index: stars.length,
			slug,
			title: post.title,
			date: post.date,
			description: post.description ?? '',
			href: `/blog/${slug}`,
			x: (tall ? y : x) / GRID,
			y: (tall ? x : y) / GRID,
			category,
			group,
			size,
			glow,
		});
	});
	const remap = (list: readonly number[]) => list.map((index) => kept.get(index)).filter((index): index is number => index !== undefined);
	const groups = data.groups.map((group, g): Group => {
		const [x, y] = tall ? group.tall : group.wide;
		const [cx, cy, rx, ry] = group.glow;
		return {
			name: group.name,
			x: x / GRID,
			y: y / GRID,
			glow: tall ? [cy / GRID, cx / GRID, ry / GRID, rx / GRID] : [cx / GRID, cy / GRID, rx / GRID, ry / GRID],
			category: group.category,
			members: stars.filter((star) => star.group === g).map((star) => star.index),
		};
	});
	const placed = new Set(stars.map((star) => star.slug));
	return {
		stars,
		groups,
		figure: data.figure.map((line) => remap(line)).filter((line): line is [number, number] => line.length === 2),
		near: data.stars.map((_, source) => source).filter((source) => kept.has(source)).map((source) => remap(data.near[source])),
		categories: data.categories.map((id, index) => ({ id, label: data.labels[index], count: stars.filter((star) => star.category === index).length })),
		bySlug: new Map(stars.map((star) => [star.slug, star.index])),
		unplaced: routeablePosts.filter((post) => !placed.has(post.slug)),
	};
}

/**
 * The next star in an arrow-key direction: prefer one of its nearest posts
 * roughly that way, otherwise the nearest star within a 60-degree cone.
 * `aspect` is the drawn width over height, so directions match the screen.
 */
export function neighborInDirection(sky: Sky, from: number, dir: Direction, aspect = 1, allow: (index: number) => boolean = () => true): number {
	const origin = sky.stars[from];
	if (!origin) return -1;
	const [dx, dy] = VECTORS[dir];
	const pick = (candidates: Iterable<number>, minCos: number): number => {
		let best = -1;
		let bestScore = Infinity;
		for (const i of candidates) {
			if (i === from || !allow(i)) continue;
			const star = sky.stars[i];
			const vx = (star.x - origin.x) * aspect;
			const vy = star.y - origin.y;
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
	const viaNear = pick(sky.near[from] ?? [], 0.35);
	if (viaNear >= 0) return viaNear;
	return pick(
		sky.stars.map((star) => star.index),
		0.5,
	);
}

/** Reading order: top to bottom, then left to right. The first one is the map's tab stop. */
export function readingOrder(sky: Sky): number[] {
	return sky.stars.map((star) => star.index).sort((a, b) => sky.stars[a].y * 2 + sky.stars[a].x - (sky.stars[b].y * 2 + sky.stars[b].x) || a - b);
}

/** The nearest posts of one star, strongest first. */
export function nearOf(sky: Sky, index: number): Star[] {
	return (sky.near[index] ?? []).map((i) => sky.stars[i]);
}
