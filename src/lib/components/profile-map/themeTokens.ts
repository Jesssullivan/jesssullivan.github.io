// Theme tokens for the map's canvas layers. Colors are defined once, in CSS
// (ProjectMap.svelte maps --pm-* onto the active Skeleton theme's
// --color-* scale per data-mode), so the SVG overlay, the legend and the
// WebGL/2D layers always agree. Custom properties compute with var()
// substituted, so reading --pm-cat-0 on the map element yields the theme's
// own oklch()/hex value; a 1x1 canvas probe converts it to sRGB for WebGL.

export const CATEGORY_TOKEN_COUNT = 8;

export type Rgb = [number, number, number];

export interface MapTokens {
	mode: 'light' | 'dark';
	theme: string;
	categories: Rgb[];
	background: Rgb;
	ink: Rgb;
	muted: Rgb;
	edge: Rgb;
	focus: Rgb;
}

let probe: CanvasRenderingContext2D | null | undefined;

function probeContext(): CanvasRenderingContext2D | null {
	if (probe !== undefined) return probe;
	const canvas = document.createElement('canvas');
	canvas.width = canvas.height = 1;
	probe = canvas.getContext('2d', { willReadFrequently: true });
	return probe;
}

/** Any CSS color string to sRGB floats in [0, 1]; falls back when unparseable. */
export function resolveColor(value: string, fallback: Rgb = [0.5, 0.5, 0.5]): Rgb {
	const ctx = probeContext();
	const v = value.trim();
	if (!ctx || !v) return fallback;
	ctx.clearRect(0, 0, 1, 1);
	ctx.fillStyle = '#000';
	ctx.fillStyle = v;
	ctx.fillRect(0, 0, 1, 1);
	const [r, g, b, a] = ctx.getImageData(0, 0, 1, 1).data;
	if (a === 0) return fallback;
	return [r / 255, g / 255, b / 255];
}

export function rgbCss([r, g, b]: Rgb, alpha = 1): string {
	return `rgb(${Math.round(r * 255)} ${Math.round(g * 255)} ${Math.round(b * 255)} / ${alpha})`;
}

export function readMapTokens(el: Element): MapTokens {
	const style = getComputedStyle(el);
	const get = (name: string, fallback: Rgb) => resolveColor(style.getPropertyValue(name), fallback);
	const root = document.documentElement;
	const mode = root.getAttribute('data-mode') === 'dark' ? 'dark' : 'light';
	const ink: Rgb = mode === 'dark' ? [0.95, 0.95, 0.95] : [0.08, 0.08, 0.1];
	return {
		mode,
		theme: root.getAttribute('data-theme') ?? '',
		categories: Array.from({ length: CATEGORY_TOKEN_COUNT }, (_, i) => get(`--pm-cat-${i}`, [0.5, 0.5, 0.5])),
		background: get('--pm-bg', mode === 'dark' ? [0.06, 0.06, 0.08] : [0.98, 0.98, 0.98]),
		ink: get('--pm-ink', ink),
		muted: get('--pm-muted', [0.5, 0.5, 0.5]),
		edge: get('--pm-edge', [0.5, 0.5, 0.5]),
		focus: get('--pm-focus', [0.3, 0.5, 0.9]),
	};
}

/**
 * Calls back (next frame, after the theme's custom properties apply) whenever
 * the site theme or color mode changes. Returns the disconnect function.
 */
export function observeTheme(callback: () => void): () => void {
	let frame = 0;
	const observer = new MutationObserver(() => {
		cancelAnimationFrame(frame);
		frame = requestAnimationFrame(callback);
	});
	observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme', 'data-mode'] });
	return () => {
		cancelAnimationFrame(frame);
		observer.disconnect();
	};
}
