import { describe, expect, it } from 'vitest';
import { profileFallback } from './fallback';
import { directionalNeighbor, markerPath, neighbors, point, visibleProjects } from './map';

describe('map evidence geometry', () => {
	it('uses a uniform positive scale without node displacement', () => {
		const [a, b] = profileFallback.repos;
		const ap = point(a),
			bp = point(b);
		expect((bp.x - ap.x) / (b.x - a.x)).toBeCloseTo((bp.y - ap.y) / (b.y - a.y), 10);
		expect(point({ x: 0, y: 0 })).toEqual({ x: 38, y: 38 });
		expect(point({ x: 1, y: 1 })).toEqual({ x: 682, y: 682 });
	});
	it('uses only supplied shared-similarity edges for connections', () => {
		const id = profileFallback.repos[0].id;
		for (const row of neighbors(profileFallback, id))
			expect(
				profileFallback.edges.some(
					(e) => e.w === row.similarity && [e.a, e.b].includes(id) && [e.a, e.b].includes(row.repo.id),
				),
			).toBe(true);
	});
	it('filters label and language without modifying corpus coordinates', () => {
		const rows = visibleProjects(profileFallback, 'Python', '');
		expect(rows.length).toBeGreaterThan(0);
		for (const row of rows) expect(row).toBe(profileFallback.repos.find((r) => r.id === row.id));
	});
	it('moves keyboard focus in screen direction and stops at boundaries', () => {
		const base = profileFallback.repos[0];
		const rows = [
			{ ...base, id: 'left', x: 0.2, y: 0.5 },
			{ ...base, id: 'right', x: 0.8, y: 0.5 },
		];
		expect(directionalNeighbor(rows, rows[0], 'ArrowRight').id).toBe('right');
		expect(directionalNeighbor(rows, rows[0], 'ArrowLeft').id).toBe('left');
	});
	it('keeps each category polygon equal in area to a circle', () => {
		for (const category of profileFallback.categories) {
			const path = markerPath(category.id, 6);
			if (path.includes('A')) continue;
			const p = path
				.slice(1, -1)
				.split('L')
				.map((pair) => pair.split(' ').map(Number));
			const area =
				Math.abs(p.reduce((s, [x, y], i) => s + x * p[(i + 1) % p.length][1] - y * p[(i + 1) % p.length][0], 0)) / 2;
			expect(area).toBeCloseTo(Math.PI * 36, 4);
		}
	});
});
