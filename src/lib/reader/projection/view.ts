/**
 * Pan and zoom for the constellation (TIN-8628). Pure functions: the only
 * maths the browser does on the map is these transforms.
 *
 * World coordinates are panel pixels at rest. Screen = world * k + (x, y).
 */
export interface View {
	k: number;
	x: number;
	y: number;
}

export interface Size {
	w: number;
	h: number;
}

export const FIT: View = { k: 1, x: 0, y: 0 };
export const MAX_ZOOM = 8;
/** Star radius in pixels by size step, at rest. */
export const STAR_RADIUS = [2.8, 3.8, 5.2, 7] as const;
/** Stars grow with this power of the zoom, much more slowly than the map. */
export const STAR_GROWTH = 0.35;
/**
 * The generator places names and titles on a small field of each kind, in pixels:
 * the full-bleed map area of the narrowest desktop window and of a small phone.
 * A larger field only moves stars apart, so what is clear here is clear on every
 * larger one.
 */
export const LABEL_FIELD = { wide: [760, 360], tall: [290, 350] } as const;
/** Stars are drawn larger on a large field and smaller on a phone, within these limits. */
export const STAR_SCALE = [0.85, 1.3] as const;
/** Titles are drawn in this font, this far from the edge of their star. */
export const TITLE_FONT = "600 12px 'Inter', system-ui, sans-serif";
export const TITLE_GAP = 7;

/** The title as the map shows it beside a star. */
export function shortTitle(title: string): string {
	const letters = [...title];
	return letters.length > 30 ? `${letters.slice(0, 28).join('').trimEnd()}…` : title;
}

/** The map scale the generator placed titles for: the zoom times how much larger the field is than the reference field. */
export function labelScale(k: number, field: Size, tall: boolean): number {
	const [width, height] = tall ? LABEL_FIELD.tall : LABEL_FIELD.wide;
	return k * Math.min(field.w / width, field.h / height);
}

const clamp = (value: number, low: number, high: number) => Math.min(high, Math.max(low, value));

export const isFit = (view: View) => view.k < 1.001;

/** The star size multiplier for a panel: 1 at about 900 pixels across the middle of its area. */
export function starScale(size: Size): number {
	return clamp(Math.round((Math.sqrt(size.w * size.h) / 900) * 100) / 100, STAR_SCALE[0], STAR_SCALE[1]);
}

/**
 * Keep the zoom in range and the panel covered: the sky never slides off its frame.
 * `lift` lets the map ride up by that many pixels, so a star under a docked card can come clear of it.
 */
export function clampView(view: View, size: Size, lift = 0): View {
	const k = clamp(view.k, 1, MAX_ZOOM);
	return { k, x: clamp(view.x, size.w - size.w * k, 0), y: clamp(view.y, size.h - size.h * k - lift, 0) };
}

/** Zoom by `factor` keeping the screen point (px, py) still. */
export function zoomAt(view: View, px: number, py: number, factor: number, size: Size, lift = 0): View {
	const k = clamp(view.k * factor, 1, MAX_ZOOM);
	const ratio = k / view.k;
	return clampView({ k, x: px - (px - view.x) * ratio, y: py - (py - view.y) * ratio }, size, lift);
}

/** The view that frames a world box [x0, y0, x1, y1] with `pad` pixels around it. */
export function viewForBox(box: readonly [number, number, number, number], size: Size, pad = 56, maxZoom = 5): View {
	const [x0, y0, x1, y1] = box;
	const k = clamp(Math.min((size.w - pad * 2) / Math.max(x1 - x0, 1), (size.h - pad * 2) / Math.max(y1 - y0, 1)), 1, maxZoom);
	return clampView({ k, x: size.w / 2 - ((x0 + x1) / 2) * k, y: size.h / 2 - ((y0 + y1) / 2) * k }, size);
}

/**
 * The view with the same zoom that puts a world point inside the panel, `margin` pixels from its edges
 * and `foot` pixels above its bottom edge. With `lift` the map may ride up that far to do it.
 */
export function viewToShow(view: View, wx: number, wy: number, size: Size, margin = 48, foot = margin, lift = 0): View {
	const sx = wx * view.k + view.x;
	const sy = wy * view.k + view.y;
	return clampView({ k: view.k, x: view.x + clamp(sx, margin, size.w - margin) - sx, y: view.y + clamp(sy, margin, size.h - Math.max(margin, foot)) - sy }, size, lift);
}

/** Between two views: zoom moves geometrically, the centre of the panel moves in a straight line. */
export function mixView(a: View, b: View, t: number, size: Size): View {
	const k = a.k * (b.k / a.k) ** t;
	const centre = (view: View, half: number, offset: number) => (half - offset) / view.k;
	const cx = centre(a, size.w / 2, a.x) + (centre(b, size.w / 2, b.x) - centre(a, size.w / 2, a.x)) * t;
	const cy = centre(a, size.h / 2, a.y) + (centre(b, size.h / 2, b.y) - centre(a, size.h / 2, a.y)) * t;
	return { k, x: size.w / 2 - cx * k, y: size.h / 2 - cy * k };
}

export const easeOut = (t: number) => 1 - (1 - clamp(t, 0, 1)) ** 3;

/** Stars grow much more slowly than the map, so zooming in pulls a dense group apart. */
export function starRadius(size: number, k: number, scale = 1): number {
	return STAR_RADIUS[clamp(size, 0, STAR_RADIUS.length - 1)] * scale * k ** STAR_GROWTH;
}

/**
 * The index whose screen point is nearest to (x, y), or -1 when none lies
 * within `reach` pixels. Pointer and touch selection use this instead of hit
 * areas, so a tap never picks a star farther away than another star, and the
 * touch target is `2 * reach` wide wherever stars are sparse. A tie goes to
 * the lower index, so the pick is stable.
 */
export function nearestIndex(xs: ArrayLike<number>, ys: ArrayLike<number>, x: number, y: number, reach: number, allow: (index: number) => boolean = () => true): number {
	let best = -1;
	let bestDistance = Infinity;
	for (let i = 0; i < xs.length; i += 1) {
		if (!allow(i)) continue;
		const distance = Math.hypot(xs[i] - x, ys[i] - y);
		if (distance < bestDistance) {
			bestDistance = distance;
			best = i;
		}
	}
	return best >= 0 && bestDistance <= reach ? best : -1;
}

/** Something the card should not cover: a point in panel pixels and what covering it costs. */
export type Keep = readonly [x: number, y: number, cost: number];

/** The card is never nearer to its star than this, in pixels. */
const CARD_GAP = 16;
/** Spots are tried on a grid of this pitch, out to this far from the star. */
const CARD_STEP = 20;
const CARD_RANGE = 220;
/** A point that costs this much is never covered while any other spot exists: the picked star's nearest posts. */
export const CARD_BLOCKED = 1000;

/**
 * Where the pinned card goes: the free spot nearest the star. The card never
 * covers the star itself. Every point in `keep` it would cover adds that
 * point's cost, and every 30 pixels away from the star costs 1, so the card
 * moves out only as far as it must to leave the map in view. `box` is the part
 * of the panel the card may use, as [x0, y0, x1, y1]. `held` is the spot the
 * card has now, as its offset from the star: it stays there unless another
 * spot is clearly better, so a moving map does not make the card jump. Returns
 * the card's left and top in panel pixels and the offset it took.
 */
export function placeCard(sx: number, sy: number, card: Size, box: readonly [number, number, number, number], keep: readonly Keep[] = [], held: readonly [number, number] | null = null): { left: number; top: number; at: [number, number] } {
	const [x0, y0, x1, y1] = box;
	const maxLeft = Math.max(x0, x1 - card.w);
	const maxTop = Math.max(y0, y1 - card.h);
	let best = { left: clamp(sx + CARD_GAP, x0, maxLeft), top: clamp(sy - card.h / 2, y0, maxTop), at: [CARD_GAP, -card.h / 2] as [number, number], cost: Infinity };
	const consider = (ox: number, oy: number) => {
		const left = clamp(sx + ox, x0, maxLeft);
		const top = clamp(sy + oy, y0, maxTop);
		const away = Math.hypot(Math.max(left - sx, 0, sx - left - card.w), Math.max(top - sy, 0, sy - top - card.h));
		// On the star, or crowding it.
		if (away < CARD_GAP - 2) return;
		// Level with the star and to its right is best when nothing else decides.
		let cost = away / 30 + Math.abs(top + card.h / 2 - sy) / 300 + (left + card.w / 2 < sx ? 0.15 : 0) - (held && held[0] === ox && held[1] === oy ? 2.5 : 0);
		for (const [x, y, weight] of keep) {
			if (cost >= best.cost) return;
			if (x > left - 6 && x < left + card.w + 6 && y > top - 6 && y < top + card.h + 6) cost += weight;
		}
		if (cost < best.cost) best = { left, top, at: [ox, oy], cost };
	};
	// Beside the star and level with it, then above and below it, then the spot it has, then the grid.
	consider(CARD_GAP, -card.h / 2);
	consider(-card.w - CARD_GAP, -card.h / 2);
	consider(-card.w / 2, -card.h - CARD_GAP);
	consider(-card.w / 2, CARD_GAP);
	if (held) consider(held[0], held[1]);
	for (let oy = -card.h - CARD_RANGE; oy <= CARD_RANGE; oy += CARD_STEP) {
		for (let ox = -card.w - CARD_RANGE; ox <= CARD_RANGE; ox += CARD_STEP) consider(ox, oy);
	}
	return { left: best.left, top: best.top, at: best.at };
}

/**
 * The spot a placed card keeps while the map moves: the offset `at` it took from
 * its star, held inside `box`. No other spot is tried, so this costs nothing on
 * a frame. Null when the box would push the card onto its star: the caller then
 * looks for a new spot.
 */
export function holdCard(sx: number, sy: number, card: Size, box: readonly [number, number, number, number], at: readonly [number, number]): { left: number; top: number } | null {
	const [x0, y0, x1, y1] = box;
	const left = clamp(sx + at[0], x0, Math.max(x0, x1 - card.w));
	const top = clamp(sy + at[1], y0, Math.max(y0, y1 - card.h));
	const away = Math.hypot(Math.max(left - sx, 0, sx - left - card.w), Math.max(top - sy, 0, sy - top - card.h));
	return away < CARD_GAP - 2 ? null : { left, top };
}

/**
 * Where a tooltip goes: beside the star and clear of it. The spots are tried in
 * order: the side in `want` (1 right, -1 left), the other side, above, below.
 * A spot that does not fit in the panel is left out. `covers` counts what a
 * spot would hide: the spot that hides least wins, and the earlier one wins a
 * tie. Without it the first spot that fits is taken.
 */
export function placeTip(sx: number, sy: number, radius: number, tip: Size, size: Size, want: 1 | -1 = 1, covers: ((spot: { left: number; top: number }) => number) | null = null, gap = 9, margin = 8): { left: number; top: number } {
	const off = radius + gap;
	const level = clamp(sy - tip.h / 2, margin, Math.max(margin, size.h - margin - tip.h));
	const centred = clamp(sx - tip.w / 2, margin, Math.max(margin, size.w - margin - tip.w));
	const spots: Array<{ left: number; top: number }> = [];
	for (const side of [want, -want]) {
		if (side > 0 ? sx + off + tip.w <= size.w - margin : sx - off - tip.w >= margin) spots.push({ left: side > 0 ? sx + off : sx - off - tip.w, top: level });
	}
	if (sy - off - tip.h >= margin) spots.push({ left: centred, top: sy - off - tip.h });
	if (sy + off + tip.h <= size.h - margin || spots.length === 0) spots.push({ left: centred, top: sy + off });
	if (!covers) return spots[0];
	let best = spots[0];
	let least = Infinity;
	for (const spot of spots) {
		const hidden = covers(spot);
		if (hidden < least) {
			least = hidden;
			best = spot;
		}
	}
	return best;
}

/** A view as fractions of the panel, so it survives a resize and a reload. */
export function storeView(view: View, size: Size): [number, number, number] {
	const round = (value: number) => Math.round(value * 1e4) / 1e4;
	return [round(view.k), round((size.w / 2 - view.x) / view.k / size.w), round((size.h / 2 - view.y) / view.k / size.h)];
}

export function restoreView(stored: unknown, size: Size): View {
	if (!Array.isArray(stored) || stored.length !== 3 || !stored.every((value) => Number.isFinite(value))) return FIT;
	const [k, cx, cy] = stored as [number, number, number];
	const zoom = clamp(k, 1, MAX_ZOOM);
	return clampView({ k: zoom, x: size.w / 2 - cx * size.w * zoom, y: size.h / 2 - cy * size.h * zoom }, size);
}
