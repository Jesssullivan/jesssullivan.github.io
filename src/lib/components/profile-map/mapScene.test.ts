import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseProfileV1 } from '$lib/profile/schema';
import { toProfileView, type ProfileView } from '$lib/profile/view';
import {
	assemblyDuration,
	assemblyFrame,
	buildScene,
	matchNodes,
	nearestNode,
	neighborInDirection,
	plotBox,
	restingFrame,
	SHAPES,
	shapeFor,
	shapePath,
	type Direction,
} from './mapScene';
import { CATEGORY_SHAPES, polygonArea, shapePoints } from './shapes';

// The real projection the page falls back to (spear_resumes profile/out-v2).
const view: ProfileView = toProfileView(
	parseProfileV1(
		JSON.parse(readFileSync(new URL('../../../../static/profile/v2/profile.v1.json', import.meta.url), 'utf8')),
	),
);
const W = 900;
const H = 700;

describe('plotBox', () => {
	it('is the largest centred square minus padding', () => {
		expect(plotBox(900, 700, 30)).toEqual({ x: 130, y: 30, size: 640 });
		expect(plotBox(390, 500, 20)).toEqual({ x: 20, y: 75, size: 350 });
	});
});

describe('buildScene', () => {
	const scene = buildScene(view, { width: W, height: H, padding: 30 });

	it('places every repository inside the plot box, preserving the supplied geometry', () => {
		expect(scene.nodes).toHaveLength(view.repos.length);
		const { x, y, size } = scene.plot;
		for (const [i, n] of scene.nodes.entries()) {
			expect(n.x).toBeCloseTo(x + view.repos[i].x * size, 6);
			expect(n.y).toBeCloseTo(y + view.repos[i].y * size, 6);
			expect(n.label).toBe(view.repos[i].label);
		}
	});

	it('keeps the supplied similarity edges and a symmetric adjacency', () => {
		expect(scene.edges).toHaveLength(view.edges.length);
		for (const e of scene.edges) {
			expect(scene.adjacency[e.a]).toContain(e.b);
			expect(scene.adjacency[e.b]).toContain(e.a);
			expect(e.w).toBeGreaterThanOrEqual(0.15);
		}
	});

	it('gives each category a distinct shape, a centroid and a hull when it has three or more members', () => {
		expect(new Set(scene.categories.map((c) => c.shape)).size).toBe(Math.min(SHAPES.length, scene.categories.length));
		for (const c of scene.categories) {
			expect(c.members.length).toBeGreaterThan(0);
			if (c.members.length >= 3) expect(c.hull?.length).toBeGreaterThanOrEqual(3);
		}
	});

	it('labels nodes with the producer label only (no counts)', () => {
		for (const n of scene.nodes) expect(n.label).not.toMatch(/\d+\s+(repos|projects|stars)/i);
	});
});

describe('hit testing', () => {
	const scene = buildScene(view, { width: W, height: H, padding: 30 });

	it('finds the node under the pointer and nothing beyond the radius', () => {
		const n = scene.nodes[7];
		expect(nearestNode(scene, n.x + 2, n.y - 2, 10)).toBe(7);
		const empty = { x: 2, y: 2 };
		expect(nearestNode(scene, empty.x, empty.y, 5)).toBe(-1);
	});

	it('skips nodes in hidden categories', () => {
		const n = scene.nodes[7];
		const visible = (i: number) => scene.nodes[i].category !== n.category;
		const hit = nearestNode(scene, n.x, n.y, 10_000, visible);
		expect(hit).not.toBe(7);
		expect(scene.nodes[hit].category).not.toBe(n.category);
	});
});

describe('keyboard navigation', () => {
	const scene = buildScene(view, { width: W, height: H, padding: 30 });
	const dirs: Record<Direction, [number, number]> = { left: [-1, 0], right: [1, 0], up: [0, -1], down: [0, 1] };

	it('prefers a similarity edge in the pressed direction', () => {
		let followedEdge = 0;
		for (const n of scene.nodes) {
			for (const [dir, [dx, dy]] of Object.entries(dirs) as [Direction, [number, number]][]) {
				const next = neighborInDirection(scene, n.index, dir);
				if (next < 0) continue;
				const m = scene.nodes[next];
				expect((m.x - n.x) * dx + (m.y - n.y) * dy).toBeGreaterThan(0);
				const edgeCandidates = scene.adjacency[n.index].filter((j) => {
					const o = scene.nodes[j];
					const d = Math.hypot(o.x - n.x, o.y - n.y);
					return d > 0 && ((o.x - n.x) * dx + (o.y - n.y) * dy) / d >= 0.35;
				});
				if (edgeCandidates.length > 0) {
					expect(scene.adjacency[n.index]).toContain(next);
					followedEdge++;
				}
			}
		}
		expect(followedEdge).toBeGreaterThan(0);
	});

	it('reaches every visible node from the first one', () => {
		const seen = new Set([0]);
		const queue = [0];
		while (queue.length) {
			const i = queue.shift()!;
			for (const dir of Object.keys(dirs) as Direction[]) {
				const j = neighborInDirection(scene, i, dir);
				if (j >= 0 && !seen.has(j)) {
					seen.add(j);
					queue.push(j);
				}
			}
		}
		expect(seen.size).toBe(scene.nodes.length);
	});

	it('never lands on a hidden node', () => {
		const hiddenCat = scene.nodes[0].category;
		const visible = (i: number) => scene.nodes[i].category !== hiddenCat;
		for (const n of scene.nodes) {
			for (const dir of Object.keys(dirs) as Direction[]) {
				const j = neighborInDirection(scene, n.index, dir, visible);
				if (j >= 0) expect(scene.nodes[j].category).not.toBe(hiddenCat);
			}
		}
	});
});

describe('search', () => {
	const scene = buildScene(view, { width: W, height: H, padding: 30 });
	it('matches labels, categories and languages case-insensitively', () => {
		const target = scene.nodes[3];
		const word = target.label.split(/\s+/).find((w) => w.length > 4) ?? target.label;
		expect(matchNodes(scene, word.toUpperCase()).has(3)).toBe(true);
		expect(matchNodes(scene, target.categoryLabel).has(3)).toBe(true);
		expect(matchNodes(scene, '   ').size).toBe(0);
		expect(matchNodes(scene, 'zzzz-no-such-project').size).toBe(0);
	});
});

describe('entrance motion', () => {
	const scene = buildScene(view, { width: W, height: H, padding: 30 });

	it('grows each cluster out of its centroid, one category after another', () => {
		const start = assemblyFrame(scene, 0);
		for (const n of scene.nodes) {
			const c = scene.categories[n.catIndex].centroid;
			expect(start.positions[n.index * 2]).toBeCloseTo(c[0], 4);
			expect(start.positions[n.index * 2 + 1]).toBeCloseTo(c[1], 4);
			expect(start.alpha[n.index]).toBe(0);
		}
		const mid = assemblyFrame(scene, 300);
		const first = scene.nodes.find((n) => n.catIndex === 0)!;
		const last = scene.nodes.find((n) => n.catIndex === scene.categories.length - 1)!;
		expect(mid.alpha[first.index]).toBeGreaterThan(mid.alpha[last.index]);
		const end = assemblyFrame(scene, assemblyDuration(scene) + 1);
		expect(end.done).toBe(true);
		expect(Array.from(end.positions)).toEqual(Array.from(restingFrame(scene).positions));
	});

	it('tweens from x_prev/y_prev when the release carries them', () => {
		const warm: ProfileView = {
			...view,
			repos: view.repos.map((r) => ({ ...r, x_prev: 0.5, y_prev: 0.5 })),
		};
		const s = buildScene(warm, { width: W, height: H, padding: 30 });
		const f = assemblyFrame(s, 0);
		const mid = s.plot.x + 0.5 * s.plot.size;
		expect(f.positions[0]).toBeCloseTo(mid, 4);
		expect(f.alpha[0]).toBe(1);
		expect(assemblyDuration(s)).toBe(900);
	});
});

describe('shapes', () => {
	it('cycles through eight closed paths', () => {
		expect(SHAPES).toHaveLength(8);
		expect(new Set(SHAPES).size).toBe(8);
		expect(shapeFor(8)).toBe(shapeFor(0));
		for (const s of SHAPES) expect(shapePath(s, 5)).toMatch(/^M.*Z$/);
	});

	it('gives every shape the same fill area (no size weighting)', () => {
		for (const s of SHAPES) {
			if (s === 'circle') continue;
			expect(polygonArea(shapePoints(s, 5))).toBeCloseTo(Math.PI * 25, 6);
		}
	});

	it('assigns shapes in the producer category order (R141)', () => {
		expect(view.categories.map((c) => c.id)).toEqual(CATEGORY_SHAPES.map(([id]) => id));
	});

	it('draws the same shape per category as the README SVG (R141)', () => {
		const svg = readFileSync(
			new URL('../../../../static/profile/v2/svg/project-map-light.svg', import.meta.url),
			'utf8',
		);
		const nodes = [
			...svg.matchAll(/<g class="map-node" data-repo-id="([^"]+)"[^>]*>(?:<title>[^<]*<\/title>)?<path d="([^"]+)"/g),
		];
		expect(nodes).toHaveLength(view.repos.length);
		const catIndex = new Map(view.categories.map((c, i) => [c.id, i]));
		const normalise = (pts: [number, number][]) => {
			const m = Math.max(...pts.map(([x, y]) => Math.hypot(x, y)));
			return pts.map(([x, y]) => [x / m, y / m]);
		};
		for (const [, id, d] of nodes) {
			const repo = view.repos.find((r) => r.id === id)!;
			const shape = shapeFor(catIndex.get(repo.category)!);
			if (d.includes('A')) {
				expect(shape, id).toBe('circle');
				continue;
			}
			const theirs = [...d.matchAll(/(-?[\d.]+) (-?[\d.]+)/g)].map(
				(m) => [Number(m[1]), Number(m[2])] as [number, number],
			);
			const ours = shapePoints(shape, 10);
			expect(ours.length, `${id} ${shape}`).toBe(theirs.length);
			const [a, b] = [normalise(ours), normalise(theirs)];
			a.forEach(([x, y], i) => {
				expect(x).toBeCloseTo(b[i][0], 3);
				expect(y).toBeCloseTo(b[i][1], 3);
			});
		}
	});
});
