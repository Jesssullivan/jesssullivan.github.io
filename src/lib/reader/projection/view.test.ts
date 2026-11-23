import { describe, expect, it } from 'vitest';
import { FIT, MAX_ZOOM, clampView, isFit, mixView, nearestIndex, placeCard, restoreView, starRadius, storeView, viewForBox, viewToShow, zoomAt } from './view';

const size = { w: 1000, h: 500 };

describe('constellation view', () => {
	it('keeps the zoom in range and the panel covered', () => {
		expect(clampView({ k: 0.2, x: 50, y: 50 }, size)).toEqual(FIT);
		expect(clampView({ k: 99, x: 0, y: 0 }, size).k).toBe(MAX_ZOOM);
		expect(clampView({ k: 2, x: 400, y: -900 }, size)).toEqual({ k: 2, x: 0, y: -500 });
		expect(isFit(FIT)).toBe(true);
		expect(isFit({ k: 1.5, x: 0, y: 0 })).toBe(false);
	});

	it('zooms about the pointer', () => {
		const view = zoomAt(FIT, 250, 125, 2, size);
		expect(view.k).toBe(2);
		// The world point under the pointer stays under it.
		expect(250 * view.k + view.x).toBeCloseTo(250);
		expect(125 * view.k + view.y).toBeCloseTo(125);
		expect(zoomAt(view, 250, 125, 0.01, size)).toEqual(FIT);
	});

	it('frames a box and brings a point on screen', () => {
		const view = viewForBox([100, 100, 300, 200], size, 50);
		expect(view.k).toBe(4);
		expect(200 * view.k + view.x).toBeCloseTo(500);
		expect(150 * view.k + view.y).toBeCloseTo(250);
		// A box larger than the panel falls back to the whole map.
		expect(viewForBox([0, 0, 1000, 500], size)).toEqual(FIT);
		const shown = viewToShow({ k: 4, x: 0, y: 0 }, 900, 400, size, 40);
		expect(900 * shown.k + shown.x).toBeCloseTo(960);
		expect(400 * shown.k + shown.y).toBeCloseTo(460);
		// Already on screen: nothing moves.
		expect(viewToShow({ k: 4, x: 0, y: 0 }, 100, 50, size, 40)).toEqual({ k: 4, x: 0, y: 0 });
	});

	it('mixes two views from end to end', () => {
		const a = FIT;
		const b = { k: 4, x: -1200, y: -600 };
		expect(mixView(a, b, 0, size)).toEqual(a);
		const end = mixView(a, b, 1, size);
		expect(end.k).toBeCloseTo(4);
		expect(end.x).toBeCloseTo(-1200);
		expect(end.y).toBeCloseTo(-600);
		expect(mixView(a, b, 0.5, size).k).toBeCloseTo(2);
	});

	it('grows stars more slowly than the map', () => {
		expect(starRadius(0, 1)).toBe(2.8);
		expect(starRadius(3, 1)).toBeGreaterThan(starRadius(0, 1));
		expect(starRadius(0, 8)).toBeLessThan(2.8 * 8 * 0.3);
		expect(starRadius(9, 1)).toBe(starRadius(3, 1));
	});

	it('selects the nearest star in a dense cluster, never a farther one', () => {
		// Five stars packed into 12 pixels, closer together than a touch target.
		const xs = [200, 204, 208, 200, 212, 600];
		const ys = [200, 200, 202, 208, 212, 400];
		const reach = 28;
		// A tap exactly on a star selects it, even with its neighbours inside the reach.
		xs.forEach((x, index) => expect(nearestIndex(xs, ys, x, ys[index], reach)).toBe(index));
		// Between the first two but closer to the second.
		expect(nearestIndex(xs, ys, 202.4, 200, reach)).toBe(1);
		// Every tap in a grid over the cluster picks a star no farther than any other.
		for (let x = 160; x <= 250; x += 1.5) {
			for (let y = 160; y <= 250; y += 1.5) {
				const picked = nearestIndex(xs, ys, x, y, reach);
				const distances = xs.map((sx, index) => Math.hypot(sx - x, ys[index] - y));
				const closest = Math.min(...distances);
				if (closest > reach) expect(picked).toBe(-1);
				else expect(distances[picked]).toBe(closest);
			}
		}
		// Out of reach selects nothing. A sparse star has a target twice the reach wide.
		expect(nearestIndex(xs, ys, 400, 300, reach)).toBe(-1);
		expect(nearestIndex(xs, ys, 600 + 27, 400, reach)).toBe(5);
		expect(nearestIndex([], [], 0, 0, reach)).toBe(-1);
		// An exact tie goes to the lower index, so the pick is stable.
		expect(nearestIndex([100, 300], [50, 50], 200, 50, 100)).toBe(0);
		// A filtered-out star cannot be picked.
		expect(nearestIndex(xs, ys, 204, 200, reach, (index) => index !== 1)).toBe(0);
	});

	it('puts the card beside the star, inside the panel', () => {
		const card = { w: 300, h: 160 };
		expect(placeCard(200, 250, card, size)).toEqual({ left: 218, top: 170 });
		// No room on the right: the card goes to the left of the star.
		expect(placeCard(900, 250, card, size)).toEqual({ left: 582, top: 170 });
		// Near the top and bottom edges it stays inside.
		expect(placeCard(200, 10, card, size).top).toBe(12);
		expect(placeCard(200, 495, card, size).top).toBe(500 - 12 - 160);
		// The card keeps away from the star's nearest posts: they are down and to the right, so it goes up and to the left.
		expect(placeCard(500, 250, card, size, { x: 560, y: 300 })).toEqual({ left: 500 - 18 - 300, top: 250 - 160 + 30 });
		expect(placeCard(500, 250, card, size, { x: 440, y: 200 })).toEqual({ left: 518, top: 220 });
		// No room on the wanted side: the other side.
		expect(placeCard(100, 250, card, size, { x: 160, y: 250 }).left).toBe(118);
	});

	it('stores a view as fractions and restores it at another size', () => {
		const view = clampView({ k: 3, x: -900, y: -400 }, size);
		const stored = storeView(view, size);
		const back = restoreView(stored, size);
		expect(back.k).toBeCloseTo(view.k, 3);
		expect(back.x).toBeCloseTo(view.x, 0);
		expect(back.y).toBeCloseTo(view.y, 0);
		const half = restoreView(stored, { w: 500, h: 250 });
		expect(half.x).toBeCloseTo(view.x / 2, 0);
		expect(restoreView(undefined, size)).toEqual(FIT);
		expect(restoreView([1, 'x', 0], size)).toEqual(FIT);
		expect(restoreView([50, 0.5, 0.5], size).k).toBe(MAX_ZOOM);
	});
});
