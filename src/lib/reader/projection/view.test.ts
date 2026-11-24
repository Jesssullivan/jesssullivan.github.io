import { describe, expect, it } from 'vitest';
import { CARD_BLOCKED, FIT, LABEL_FIELD, MAX_ZOOM, STAR_SCALE, clampView, holdCard, isFit, labelScale, mixView, nearestIndex, placeCard, placeTip, restoreView, shortTitle, starRadius, starScale, storeView, viewForBox, viewToShow, zoomAt, type Keep } from './view';

const size = { w: 1000, h: 500 };

describe('constellation view', () => {
	it('keeps the zoom in range and the panel covered', () => {
		expect(clampView({ k: 0.2, x: 50, y: 50 }, size)).toEqual(FIT);
		expect(clampView({ k: 99, x: 0, y: 0 }, size).k).toBe(MAX_ZOOM);
		expect(clampView({ k: 2, x: 400, y: -900 }, size)).toEqual({ k: 2, x: 0, y: -500 });
		expect(isFit(FIT)).toBe(true);
		expect(isFit({ k: 1.5, x: 0, y: 0 })).toBe(false);
	});

	it('lets the map ride up under a docked card, and no farther', () => {
		// At rest the map cannot move. With a card docked over its foot it may ride up by the height of the card.
		expect(clampView({ k: 1, x: 0, y: -120 }, size)).toEqual(FIT);
		expect(clampView({ k: 1, x: 0, y: -120 }, size, 90)).toEqual({ k: 1, x: 0, y: -90 });
		expect(clampView({ k: 2, x: 0, y: -900 }, size, 90)).toEqual({ k: 2, x: 0, y: -590 });
		// A star under the card comes to rest above it.
		const shown = viewToShow(FIT, 500, 480, size, 36, 108, 90);
		expect(480 + shown.y).toBeCloseTo(500 - 108);
		// Zooming keeps the lift it was given.
		expect(zoomAt({ k: 1, x: 0, y: -90 }, 500, 250, 1, size, 90).y).toBe(-90);
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
		// A strip at the foot of the panel is kept clear: the point comes to rest above it.
		const above = viewToShow({ k: 4, x: 0, y: 0 }, 100, 115, size, 40, 180);
		expect(115 * above.k + above.y).toBeCloseTo(320);
	});

	it('shortens a long title for the map and knows the scale titles were placed for', () => {
		expect(shortTitle('Turkey Probe')).toBe('Turkey Probe');
		expect(shortTitle('Wolf Pine @ Fox Park #3: 3/3/17, Noon-ish time')).toBe('Wolf Pine @ Fox Park #3: 3/3…');
		expect([...shortTitle('x'.repeat(80))]).toHaveLength(29);
		// A field the size of the reference field is scale 1. A larger one counts by its tighter axis.
		const [width, height] = LABEL_FIELD.wide;
		expect(labelScale(1, { w: width, h: height }, false)).toBe(1);
		expect(labelScale(2, { w: width * 3, h: height * 1.5 }, false)).toBe(3);
		expect(labelScale(1, { w: LABEL_FIELD.tall[0] * 2, h: LABEL_FIELD.tall[1] * 2 }, true)).toBe(2);
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

	it('draws stars larger on a large sky and smaller on a phone', () => {
		expect(starScale({ w: 1000, h: 810 })).toBe(1);
		expect(starScale({ w: 390, h: 760 })).toBe(STAR_SCALE[0]);
		expect(starScale({ w: 1920, h: 929 })).toBe(STAR_SCALE[1]);
		expect(starScale({ w: 1440, h: 774 })).toBeGreaterThan(1);
		expect(starScale({ w: 1440, h: 774 })).toBeLessThan(STAR_SCALE[1]);
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

	it('puts the pinned card in free space near the star, never over the star or its nearest posts', () => {
		const card = { w: 240, h: 200 };
		const box = [10, 28, 990, 440] as const;
		const inside = (spot: { left: number; top: number }, x: number, y: number, pad = 0) => x > spot.left - pad && x < spot.left + card.w + pad && y > spot.top - pad && y < spot.top + card.h + pad;
		const covered = (spot: { left: number; top: number }, keep: readonly Keep[]) => keep.filter(([x, y]) => inside(spot, x, y, 4)).length;
		// Nothing in the way: beside the star, on the right, level with it.
		expect(placeCard(300, 240, card, box)).toMatchObject({ left: 316, top: 140 });
		// No room on the right: the left.
		expect(placeCard(900, 240, card, box)).toMatchObject({ left: 900 - 16 - 240, top: 140 });
		// It stays inside the part of the panel it may use, and off the star.
		for (const [x, y] of [[300, 430], [20, 40], [980, 430], [500, 30]] as const) {
			const spot = placeCard(x, y, card, box);
			expect(spot.left).toBeGreaterThanOrEqual(10);
			expect(spot.left + card.w).toBeLessThanOrEqual(990);
			expect(spot.top).toBeGreaterThanOrEqual(28);
			expect(spot.top + card.h).toBeLessThanOrEqual(440);
			expect(inside(spot, x, y, 12), `${x},${y}`).toBe(false);
		}
		// The star's nearest posts are to its right: the card goes where it covers none of them.
		const near: Keep[] = [
			[360, 230, CARD_BLOCKED],
			[420, 300, CARD_BLOCKED],
			[380, 150, CARD_BLOCKED],
		];
		const clear = placeCard(300, 240, card, box, near);
		expect(covered(clear, near)).toBe(0);
		expect(inside(clear, 300, 240, 12)).toBe(false);
		// Hemmed in on every side by its nearest posts, it moves out past them and still never covers the star.
		const ring: Keep[] = Array.from({ length: 12 }, (_, step): Keep => [500 + Math.cos((step * Math.PI) / 6) * 90, 240 + Math.sin((step * Math.PI) / 6) * 90, CARD_BLOCKED]);
		const hemmed = placeCard(500, 240, card, box, ring);
		expect(inside(hemmed, 500, 240, 12)).toBe(false);
		expect(covered(hemmed, ring)).toBe(0);
		// Other stars cost a little: a crowded side loses to an empty one, and the card stays close.
		const crowd: Keep[] = [
			[400, 200, 4],
			[450, 260, 4],
			[380, 290, 4],
		];
		const quiet = placeCard(300, 240, card, box, crowd);
		expect(covered(quiet, crowd)).toBe(0);
		expect(quiet.left + card.w).toBeLessThan(300);
		expect(300 - quiet.left - card.w).toBeLessThan(40);
		// One star in the way is not worth a long move: the card slides clear of it and stays beside its own star.
		const one: Keep[] = [[330, 250, 4]];
		const slid = placeCard(300, 240, card, box, one);
		expect(covered(slid, one)).toBe(0);
		expect(Math.hypot(Math.max(slid.left - 300, 0, 300 - slid.left - card.w), Math.max(slid.top - 240, 0, 240 - slid.top - card.h))).toBeLessThan(60);
		// A card that is already placed stays put when another spot is only a little better.
		const held = placeCard(300, 240, card, box);
		const nudge: Keep[] = [[330, 250, 1]];
		expect(placeCard(300, 240, card, box, nudge).at).not.toEqual(held.at);
		expect(placeCard(300, 240, card, box, nudge, held.at)).toEqual(held);
		// A clearly better spot still wins over the one it has.
		expect(placeCard(300, 240, card, box, one.map(([x, y]): Keep => [x, y, CARD_BLOCKED]), held.at).at).not.toEqual(held.at);
	});

	it('holds a placed card at its offset while the map moves, and gives it up when that would cover the star', () => {
		const card = { w: 240, h: 200 };
		const box = [10, 28, 990, 440] as const;
		const placed = placeCard(300, 240, card, box);
		// The star moved with the map: the card keeps its offset and no other spot is tried.
		expect(holdCard(360, 200, card, box, placed.at)).toEqual({ left: placed.left + 60, top: placed.top - 40 });
		// Near an edge the card stays inside the part of the panel it may use.
		expect(holdCard(700, 240, card, box, placed.at)).toEqual({ left: 716, top: 140 });
		expect(holdCard(300, 60, card, box, placed.at)).toEqual({ left: 316, top: 28 });
		// Pushed onto its star by the edge, it gives the spot up: the caller searches again.
		expect(holdCard(900, 240, card, box, placed.at)).toBeNull();
	});

	it('puts the tooltip beside the star, never on it, and flips it at an edge', () => {
		const tip = { w: 200, h: 44 };
		// Right of the star, level with it, clear of its edge.
		expect(placeTip(300, 200, 8, tip, size)).toEqual({ left: 317, top: 178 });
		// Near the right edge it flips to the left.
		expect(placeTip(900, 200, 8, tip, size)).toEqual({ left: 900 - 17 - 200, top: 178 });
		// Asked for the left first, it takes the left, and flips right at the left edge.
		expect(placeTip(500, 200, 8, tip, size, -1).left).toBe(500 - 17 - 200);
		expect(placeTip(100, 200, 8, tip, size, -1).left).toBe(117);
		// At the top and the foot it stays inside and still beside the star.
		expect(placeTip(300, 6, 8, tip, size).top).toBe(8);
		expect(placeTip(300, 496, 8, tip, size).top).toBe(500 - 8 - 44);
		// A panel too narrow for either side: above the star, or below it at the top.
		const narrow = { w: 300, h: 500 };
		expect(placeTip(150, 200, 8, tip, narrow)).toEqual({ left: 50, top: 200 - 17 - 44 });
		expect(placeTip(150, 30, 8, tip, narrow).top).toBe(47);
		// Told what each spot would hide, it takes the spot that hides least: here the one above the star. A tie keeps the first spot.
		expect(placeTip(500, 200, 8, tip, size, 1, (spot) => (spot.top + tip.h <= 200 - 17 ? 0 : 3))).toEqual({ left: 400, top: 200 - 17 - 44 });
		expect(placeTip(500, 200, 8, tip, size, 1, (spot) => (spot.top >= 200 + 17 ? 0 : 3))).toEqual({ left: 400, top: 217 });
		expect(placeTip(500, 200, 8, tip, size, 1, () => 1)).toEqual({ left: 517, top: 178 });
		// It never covers the star it describes.
		for (const x of [20, 150, 480, 700, 980]) {
			for (const y of [10, 250, 490]) {
				for (const spot of [placeTip(x, y, 8, tip, size), placeTip(x, y, 8, tip, size, -1, (at) => at.left + at.top)])
				expect(x > spot.left - 8 && x < spot.left + tip.w + 8 && y > spot.top - 8 && y < spot.top + tip.h + 8, `${x},${y}`).toBe(false);
			}
		}
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
