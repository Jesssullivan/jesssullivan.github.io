// Category marker shapes (dependency-free so the legend and SSR markup can
// use them without pulling the d3 engine into the route chunk).
//
// R141 (per Jess, 2026-10-01): the shapes match the README SVG exactly. The
// order and geometry are ported from spear_resumes profile/render
// (svg_v2.Theme.CATEGORIES and chart_map_v2.marker_path): the same unit
// polygons, scaled so every marker has fill area pi * r^2.

/** Producer category order (profile.v1 `categories`), one shape each. */
export const CATEGORY_SHAPES = [
	['applied-ml', 'circle'],
	['kernel-security', 'diamond'],
	['compilers-hpc', 'triangle'],
	['systems', 'square'],
	['build-infra', 'hexagon'],
	['sdlc-automation', 'triangle-down'],
	['web-product', 'plus'],
	['gis-fabrication', 'star'],
] as const;

export const SHAPES = CATEGORY_SHAPES.map(([, shape]) => shape);
export type Shape = (typeof CATEGORY_SHAPES)[number][1];

/** Category marker shape by producer category index; the second channel next to colour. */
export function shapeFor(categoryIndex: number): Shape {
	return SHAPES[((categoryIndex % SHAPES.length) + SHAPES.length) % SHAPES.length];
}

type Pt = [number, number];

function unitPolygon(shape: Exclude<Shape, 'circle'>): Pt[] {
	switch (shape) {
		case 'square':
			return [
				[-1, -1],
				[1, -1],
				[1, 1],
				[-1, 1],
			];
		case 'triangle':
		case 'triangle-down': {
			const sign = shape === 'triangle' ? 1 : -1;
			return [
				[0, -sign],
				[Math.sqrt(3) / 2, sign / 2],
				[-Math.sqrt(3) / 2, sign / 2],
			];
		}
		case 'diamond':
			return [
				[0, -1],
				[1, 0],
				[0, 1],
				[-1, 0],
			];
		case 'hexagon':
			return Array.from({ length: 6 }, (_, i): Pt => {
				const a = Math.PI / 6 + (i * Math.PI) / 3;
				return [Math.cos(a), Math.sin(a)];
			});
		case 'star':
			return Array.from({ length: 10 }, (_, i): Pt => {
				const rr = i % 2 === 0 ? 1 : 0.44;
				const a = -Math.PI / 2 + (i * Math.PI) / 5;
				return [rr * Math.cos(a), rr * Math.sin(a)];
			});
		case 'plus': {
			const a = 0.35;
			return [
				[-a, -1],
				[a, -1],
				[a, -a],
				[1, -a],
				[1, a],
				[a, a],
				[a, 1],
				[-a, 1],
				[-a, a],
				[-1, a],
				[-1, -a],
				[-a, -a],
			];
		}
	}
}

/** Shoelace area of a closed polygon. */
export function polygonArea(points: readonly Pt[]): number {
	let sum = 0;
	for (let i = 0; i < points.length; i++) {
		const [x, y] = points[i];
		const [nx, ny] = points[(i + 1) % points.length];
		sum += x * ny - y * nx;
	}
	return Math.abs(sum) / 2;
}

function round(v: number): number {
	return Math.round(v * 100) / 100;
}

/** Marker vertices centred on 0,0 with fill area pi * r^2 (empty for the circle). */
export function shapePoints(shape: Shape, r: number): Pt[] {
	if (shape === 'circle') return [];
	const points = unitPolygon(shape);
	const scale = r * Math.sqrt(Math.PI / polygonArea(points));
	return points.map(([x, y]): Pt => [x * scale, y * scale]);
}

/**
 * SVG path for a marker centred on 0,0. Every shape has the same fill area
 * (category only: no importance or expertise weighting).
 */
export function shapePath(shape: Shape, r: number): string {
	if (shape === 'circle') return `M${-r} 0A${r} ${r} 0 1 0 ${r} 0A${r} ${r} 0 1 0 ${-r} 0Z`;
	return `M${shapePoints(shape, r)
		.map(([x, y]) => `${round(x)} ${round(y)}`)
		.join('L')}Z`;
}
