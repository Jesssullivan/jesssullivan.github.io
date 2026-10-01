// Category marker shapes (dependency-free so the legend and SSR markup can
// use them without pulling the d3 engine into the route chunk).

export const SHAPES = ['circle', 'square', 'diamond', 'triangle', 'hexagon', 'triangle-down', 'plus', 'star'] as const;
export type Shape = (typeof SHAPES)[number];

/** Category marker shape; the second channel next to color (never color alone). */
export function shapeFor(categoryIndex: number): Shape {
	return SHAPES[((categoryIndex % SHAPES.length) + SHAPES.length) % SHAPES.length];
}

function polygon(points: [number, number][]): string {
	return `M${points.map(([x, y]) => `${round(x)} ${round(y)}`).join('L')}Z`;
}

function round(v: number): number {
	return Math.round(v * 100) / 100;
}

/**
 * SVG path for a marker centred on 0,0. Shapes are scaled to roughly equal
 * area (category only: no importance or expertise weighting).
 */
export function shapePath(shape: Shape, r: number): string {
	switch (shape) {
		case 'circle':
			return `M${-r} 0A${r} ${r} 0 1 0 ${r} 0A${r} ${r} 0 1 0 ${-r} 0Z`;
		case 'square': {
			const s = r * 0.886;
			return polygon([
				[-s, -s],
				[s, -s],
				[s, s],
				[-s, s],
			]);
		}
		case 'diamond': {
			const s = r * 1.253;
			return polygon([
				[0, -s],
				[s, 0],
				[0, s],
				[-s, 0],
			]);
		}
		case 'triangle':
		case 'triangle-down': {
			const s = r * 1.347;
			const dir = shape === 'triangle' ? 1 : -1;
			return polygon([
				[0, -s * dir],
				[s * 0.866, s * 0.5 * dir],
				[-s * 0.866, s * 0.5 * dir],
			]);
		}
		case 'hexagon': {
			const s = r * 1.1;
			return polygon(
				Array.from({ length: 6 }, (_, i) => {
					const a = (Math.PI / 3) * i;
					return [s * Math.cos(a), s * Math.sin(a)] as [number, number];
				}),
			);
		}
		case 'plus': {
			const a = r * 1.2;
			const b = r * 0.42;
			return polygon([
				[-b, -a],
				[b, -a],
				[b, -b],
				[a, -b],
				[a, b],
				[b, b],
				[b, a],
				[-b, a],
				[-b, b],
				[-a, b],
				[-a, -b],
				[-b, -b],
			]);
		}
		case 'star': {
			const outer = r * 1.35;
			const inner = outer * 0.48;
			return polygon(
				Array.from({ length: 10 }, (_, i) => {
					const a = -Math.PI / 2 + (Math.PI / 5) * i;
					const rr = i % 2 === 0 ? outer : inner;
					return [rr * Math.cos(a), rr * Math.sin(a)] as [number, number];
				}),
			);
		}
	}
}
