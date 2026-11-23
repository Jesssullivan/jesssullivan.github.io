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

const clamp = (value: number, low: number, high: number) => Math.min(high, Math.max(low, value));

export const isFit = (view: View) => view.k < 1.001;

/** Keep the zoom in range and the panel covered: the sky never slides off its frame. */
export function clampView(view: View, size: Size): View {
	const k = clamp(view.k, 1, MAX_ZOOM);
	return { k, x: clamp(view.x, size.w - size.w * k, 0), y: clamp(view.y, size.h - size.h * k, 0) };
}

/** Zoom by `factor` keeping the screen point (px, py) still. */
export function zoomAt(view: View, px: number, py: number, factor: number, size: Size): View {
	const k = clamp(view.k * factor, 1, MAX_ZOOM);
	const ratio = k / view.k;
	return clampView({ k, x: px - (px - view.x) * ratio, y: py - (py - view.y) * ratio }, size);
}

/** The view that frames a world box [x0, y0, x1, y1] with `pad` pixels around it. */
export function viewForBox(box: readonly [number, number, number, number], size: Size, pad = 56, maxZoom = 5): View {
	const [x0, y0, x1, y1] = box;
	const k = clamp(Math.min((size.w - pad * 2) / Math.max(x1 - x0, 1), (size.h - pad * 2) / Math.max(y1 - y0, 1)), 1, maxZoom);
	return clampView({ k, x: size.w / 2 - ((x0 + x1) / 2) * k, y: size.h / 2 - ((y0 + y1) / 2) * k }, size);
}

/** The view with the same zoom that puts a world point inside the panel, `margin` pixels from its edges. */
export function viewToShow(view: View, wx: number, wy: number, size: Size, margin = 48): View {
	const sx = wx * view.k + view.x;
	const sy = wy * view.k + view.y;
	return clampView({ k: view.k, x: view.x + clamp(sx, margin, size.w - margin) - sx, y: view.y + clamp(sy, margin, size.h - margin) - sy }, size);
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
	return STAR_RADIUS[clamp(size, 0, STAR_RADIUS.length - 1)] * scale * k ** 0.35;
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

/**
 * Where the card goes: beside the star, kept inside the panel. With `avoid`
 * (the middle of the star's nearest posts) the card takes the opposite side
 * and the opposite half, so it does not cover the lines it explains. Without
 * it, the side with more room. Returns the card's left and top in panel pixels.
 */
export function placeCard(sx: number, sy: number, card: Size, size: Size, avoid: { x: number; y: number } | null = null, gap = 18, margin = 12): { left: number; top: number } {
	const roomRight = size.w - margin - (sx + gap + card.w);
	const roomLeft = sx - gap - card.w - margin;
	const wantRight = avoid ? avoid.x < sx : roomRight >= roomLeft;
	const right = wantRight ? roomRight >= 0 || roomRight >= roomLeft : roomLeft < 0 && roomRight > roomLeft;
	const top = !avoid ? sy - card.h / 2 : avoid.y >= sy ? sy - card.h + 30 : sy - 30;
	return {
		left: clamp(right ? sx + gap : sx - gap - card.w, margin, Math.max(margin, size.w - margin - card.w)),
		top: clamp(top, margin, Math.max(margin, size.h - margin - card.h)),
	};
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
