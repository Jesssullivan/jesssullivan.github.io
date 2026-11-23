/**
 * Canvas painter for the constellation (TIN-8628).
 *
 * One call draws one frame: figure lines, stars, the lines to the active
 * star's nearest posts, rings and, when zoomed in, post titles. The glows and
 * the dust behind them are drawn once and then only moved. Colours come from
 * the section's CSS custom properties, which derive from the theme tokens, so
 * the canvas follows all five themes in light and dark.
 */
import type { Sky } from './scene';
import { starRadius, type Size, type View } from './view';

type Rgb = [number, number, number];

export interface Palette {
	dark: boolean;
	ink: Rgb;
	paper: Rgb;
	accent: Rgb;
	stars: Rgb[];
	/** One soft round sprite per category, for star and group glows. */
	sprites: HTMLCanvasElement[];
}

export interface Rect {
	x: number;
	y: number;
	w: number;
	h: number;
}

export interface Frame {
	size: Size;
	field: Rect;
	view: View;
	/** Star size multiplier: smaller on narrow panels. */
	scale: number;
	/** Star whose card is open, star under the pointer, and whether to draw the keyboard ring. */
	active: number;
	hover: number;
	ring: boolean;
	/** Category to keep bright, or -1. */
	filter: number;
	/** Constellation whose name is under the pointer or focused, or -1. */
	group: number;
	/** 0 at the silhouette, 1 when the sky has assembled. */
	intro: number;
}

/** Opacity of the first-paint silhouette. The intro starts from it, so nothing jumps. */
export const SILHOUETTE_ALPHA = 0.55;
/** Titles appear beside stars from this zoom. */
const TITLE_ZOOM = 2;
const TITLE_FONT = "600 12px 'Inter', system-ui, sans-serif";

const rgba = ([r, g, b]: Rgb, alpha = 1) => `rgba(${r},${g},${b},${alpha})`;
const smooth = (t: number) => {
	const c = Math.min(1, Math.max(0, t));
	return c * c * (3 - 2 * c);
};

/** Resolve the section's colour properties to sRGB through a one-pixel canvas. */
export function readPalette(host: HTMLElement, categories: number): Palette {
	const probe = document.createElement('span');
	probe.style.cssText = 'position:absolute;width:0;height:0;visibility:hidden';
	host.append(probe);
	const scratch = document.createElement('canvas');
	scratch.width = scratch.height = 1;
	const ctx = scratch.getContext('2d', { willReadFrequently: true });
	const resolve = (property: string, fallback: Rgb): Rgb => {
		if (!ctx) return fallback;
		probe.style.color = `var(${property})`;
		ctx.clearRect(0, 0, 1, 1);
		ctx.fillStyle = '#000';
		ctx.fillStyle = getComputedStyle(probe).color;
		ctx.fillRect(0, 0, 1, 1);
		const [r, g, b, a] = ctx.getImageData(0, 0, 1, 1).data;
		return a ? [r, g, b] : fallback;
	};
	const dark = getComputedStyle(host).getPropertyValue('--sky-dark').trim() === '1';
	const ink = resolve('--sky-ink', dark ? [240, 240, 240] : [20, 20, 20]);
	const stars = Array.from({ length: categories }, (_, i) => resolve(`--star-${i % 8}`, ink));
	const palette: Palette = {
		dark,
		ink,
		paper: resolve('--sky-paper', dark ? [12, 14, 20] : [250, 250, 250]),
		accent: resolve('--sky-accent', ink),
		stars,
		sprites: stars.map((colour) => {
			const sprite = document.createElement('canvas');
			sprite.width = sprite.height = 64;
			const sctx = sprite.getContext('2d');
			if (sctx) {
				const gradient = sctx.createRadialGradient(32, 32, 0, 32, 32, 32);
				gradient.addColorStop(0, rgba(colour, 0.85));
				gradient.addColorStop(0.3, rgba(colour, 0.34));
				gradient.addColorStop(0.65, rgba(colour, 0.09));
				gradient.addColorStop(1, rgba(colour, 0));
				sctx.fillStyle = gradient;
				sctx.fillRect(0, 0, 64, 64);
			}
			return sprite;
		}),
	};
	probe.remove();
	return palette;
}

/** A stable 0 to 1 value per index, for the stagger of the intro and the dust. */
const jitter = (index: number) => ((Math.imul(index + 1, 2654435761) >>> 0) % 1000) / 1000;

/** Faint specks behind the map. They are scenery, not posts: they move less than the stars and cannot be picked. */
const DUST = Array.from({ length: 220 }, (_, i) => ({ x: jitter(i * 3 + 11), y: jitter(i * 7 + 5), weight: jitter(i * 13 + 2) }));
/** Dust moves and grows at this power of the zoom, so it sits behind the stars. */
const DUST_DEPTH = 0.55;

/** CSS transforms that carry the two backdrop canvases along with a view. */
export function backdropTransforms(view: View, size: Size): { glow: string; dust: string } {
	const depth = view.k ** DUST_DEPTH;
	const panX = view.k > 1 ? view.x / (size.w - size.w * view.k) : 0;
	const panY = view.k > 1 ? view.y / (size.h - size.h * view.k) : 0;
	return {
		glow: `translate(${view.x.toFixed(2)}px,${view.y.toFixed(2)}px) scale(${view.k.toFixed(4)})`,
		dust: `translate(${(panX * (size.w - size.w * depth)).toFixed(2)}px,${(panY * (size.h - size.h * depth)).toFixed(2)}px) scale(${depth.toFixed(4)})`,
	};
}

export class Painter {
	xs = new Float32Array(0);
	ys = new Float32Array(0);
	private radii = new Float32Array(0);
	private alphas = new Float32Array(0);
	private titleWidths: number[] = [];
	private titles: string[] = [];

	constructor(
		private sky: Sky,
		private palette: Palette,
	) {
		this.setSky(sky);
	}

	setSky(sky: Sky) {
		this.sky = sky;
		this.xs = new Float32Array(sky.stars.length);
		this.ys = new Float32Array(sky.stars.length);
		this.radii = new Float32Array(sky.stars.length);
		this.alphas = new Float32Array(sky.stars.length);
		this.titles = sky.stars.map((star) => (star.title.length > 38 ? `${star.title.slice(0, 36).trimEnd()}…` : star.title));
		this.titleWidths = [];
	}

	setPalette(palette: Palette) {
		this.palette = palette;
	}

	/** Screen positions for a view. Hit testing reads the same arrays the frame was drawn from. */
	project(frame: Pick<Frame, 'field' | 'view'>) {
		const { field, view } = frame;
		const { stars } = this.sky;
		for (let i = 0; i < stars.length; i += 1) {
			this.xs[i] = (field.x + stars[i].x * field.w) * view.k + view.x;
			this.ys[i] = (field.y + stars[i].y * field.h) * view.k + view.y;
		}
	}

	/**
	 * The scenery behind the stars: the soft glow of each constellation and the
	 * dust. Both are drawn once, into their own canvases, at the resting view.
	 * A frame then only moves those canvases, which costs no drawing at all.
	 */
	drawBackdrop(glow: CanvasRenderingContext2D, dust: CanvasRenderingContext2D, size: Size, field: Rect, filter: number) {
		const { sky, palette } = this;
		glow.clearRect(0, 0, size.w, size.h);
		for (const cluster of sky.groups) {
			const [cx, cy, rx, ry] = cluster.glow;
			const w = rx * field.w * 2;
			const h = ry * field.h * 2;
			glow.globalAlpha = (palette.dark ? 0.36 : 0.22) * (filter < 0 || cluster.category === filter ? 1 : 0.25);
			glow.drawImage(palette.sprites[cluster.category], field.x + cx * field.w - w / 2, field.y + cy * field.h - h / 2, w, h);
		}
		glow.globalAlpha = 1;
		dust.clearRect(0, 0, size.w, size.h);
		dust.fillStyle = rgba(palette.ink);
		for (const speck of DUST) {
			const side = speck.weight > 0.85 ? 1.6 : 1;
			dust.globalAlpha = palette.dark ? 0.1 + speck.weight * 0.3 : 0.05 + speck.weight * 0.12;
			dust.fillRect(speck.x * size.w, speck.y * size.h, side, side);
		}
		dust.globalAlpha = 1;
	}

	draw(ctx: CanvasRenderingContext2D, frame: Frame) {
		const { size, field, view, scale, active, hover, filter, group, intro } = frame;
		const { sky, palette, xs, ys } = this;
		const { stars } = sky;
		const { dark, ink, paper, accent } = palette;
		this.project(frame);
		ctx.clearRect(0, 0, size.w, size.h);
		const shown = (index: number) => filter < 0 || stars[index].category === filter;
		const onScreen = (index: number, margin: number) => xs[index] > -margin && xs[index] < size.w + margin && ys[index] > -margin && ys[index] < size.h + margin;
		// Figure lines, drawn from one end as the intro runs. The figure under the pointer, or of the active star, is brighter.
		const drawn = smooth((intro - 0.5) / 0.5);
		const lit = group >= 0 ? group : active >= 0 ? stars[active].group : -1;
		if (drawn > 0) {
			ctx.lineCap = 'round';
			for (const level of [0, 1, 2]) {
				ctx.beginPath();
				for (const [a, b] of sky.figure) {
					const is = !(shown(a) && shown(b)) ? 0 : lit >= 0 && stars[a].group === lit ? 2 : 1;
					if (is !== level) continue;
					ctx.moveTo(xs[a], ys[a]);
					ctx.lineTo(xs[a] + (xs[b] - xs[a]) * drawn, ys[a] + (ys[b] - ys[a]) * drawn);
				}
				ctx.lineWidth = level === 2 ? 1.5 : 1;
				ctx.strokeStyle = rgba(ink, [0.1, dark ? 0.4 : 0.42, 0.85][level]);
				ctx.stroke();
			}
		}

		// Lines to the active star's nearest posts.
		const near = active >= 0 ? (sky.near[active] ?? []) : [];
		if (near.length) {
			ctx.beginPath();
			for (const index of near) {
				ctx.moveTo(xs[active], ys[active]);
				ctx.lineTo(xs[index], ys[index]);
			}
			ctx.lineWidth = 1.75;
			ctx.strokeStyle = rgba(accent);
			ctx.stroke();
		}

		// Stars: halos first, so no halo covers a neighbour's core.
		const { radii, alphas } = this;
		for (let i = 0; i < stars.length; i += 1) {
			const star = stars[i];
			const t = intro >= 1 ? 1 : smooth((intro - 0.5 * (0.7 * star.x + 0.3 * jitter(i))) / 0.35);
			radii[i] = starRadius(star.size, view.k, scale) * (1 + 0.35 * Math.sin(Math.PI * t));
			alphas[i] = (SILHOUETTE_ALPHA + (1 - SILHOUETTE_ALPHA) * t) * (shown(i) ? 1 : 0.22);
			if (!onScreen(i, 40) || !shown(i) || t <= 0) continue;
			const halo = radii[i] * (star.glow === 2 ? 5 : star.glow === 1 ? 3.8 : 2.6);
			ctx.globalAlpha = t * (star.glow === 2 ? 1 : star.glow === 1 ? 0.7 : 0.4) * (dark ? 1 : 0.5);
			ctx.drawImage(palette.sprites[star.category], xs[i] - halo, ys[i] - halo, halo * 2, halo * 2);
		}
		for (let i = 0; i < stars.length; i += 1) {
			if (!onScreen(i, 12)) continue;
			ctx.globalAlpha = alphas[i];
			ctx.fillStyle = rgba(palette.stars[stars[i].category]);
			ctx.beginPath();
			ctx.arc(xs[i], ys[i], radii[i], 0, Math.PI * 2);
			ctx.fill();
			// A paler core, so a star reads as a light and not a disc. It arrives with the star, so the first frame matches the silhouette.
			const arrived = (alphas[i] - SILHOUETTE_ALPHA) / (1 - SILHOUETTE_ALPHA);
			if (dark && shown(i) && arrived > 0.01) {
				ctx.globalAlpha = 1;
				ctx.fillStyle = `rgba(255,255,255,${(0.5 * arrived).toFixed(3)})`;
				ctx.beginPath();
				ctx.arc(xs[i], ys[i], radii[i] * 0.45, 0, Math.PI * 2);
				ctx.fill();
			}
		}
		ctx.globalAlpha = 1;

		// Rings: one on the active star, a second one outside it for the keyboard.
		const ringOn = (index: number, width: number, gap: number, colour: Rgb) => {
			ctx.lineWidth = width + 2;
			ctx.strokeStyle = rgba(paper, 0.9);
			ctx.beginPath();
			ctx.arc(xs[index], ys[index], radii[index] + gap, 0, Math.PI * 2);
			ctx.stroke();
			ctx.lineWidth = width;
			ctx.strokeStyle = rgba(colour);
			ctx.stroke();
		};
		if (hover >= 0 && hover !== active) ringOn(hover, 1.5, 4, ink);
		if (active >= 0) {
			ringOn(active, 2, 4.5, ink);
			if (frame.ring) ringOn(active, 3, 9.5, accent);
		}

		// Titles.
		const titleAlpha = smooth((view.k - TITLE_ZOOM) / 0.5);
		if (titleAlpha > 0) {
			ctx.font = TITLE_FONT;
			ctx.textBaseline = 'middle';
			ctx.lineJoin = 'round';
			if (!this.titleWidths.length) this.titleWidths = this.titles.map((title) => ctx.measureText(title).width);
			// Titles keep clear of the constellation names, which sit on the map as buttons.
			const boxes: Array<[number, number, number]> = sky.groups.map((cluster) => {
				const half = cluster.name.length * 4.7 + 10;
				return [(field.x + cluster.x * field.w) * view.k + view.x - half, (field.y + cluster.y * field.h) * view.k + view.y, half * 2];
			});
			const order = stars
				.map((star) => star.index)
				.filter((index) => shown(index) && onScreen(index, 0))
				.sort((a, b) => Number(b === active) - Number(a === active) || stars[b].size - stars[a].size || stars[b].glow - stars[a].glow || a - b);
			ctx.globalAlpha = titleAlpha;
			for (const index of order) {
				const width = this.titleWidths[index];
				const offset = radii[index] + 7;
				// Right of the star, then left, below and above: the first spot that covers no star and no other title.
				const spots: Array<[number, number]> = [
					[xs[index] + offset, ys[index]],
					[xs[index] - offset - width, ys[index]],
					[xs[index] - width / 2, ys[index] + offset + 8],
					[xs[index] - width / 2, ys[index] - offset - 8],
				];
				const spot = spots.find(
					([x, y]) =>
						x >= 4 &&
						x + width <= size.w - 4 &&
						y >= 10 &&
						y <= size.h - 10 &&
						boxes.every(([bx, by, bw]) => x > bx + bw + 6 || x + width < bx - 6 || Math.abs(y - by) > 15) &&
						stars.every((_, other) => other === index || xs[other] < x - 5 || xs[other] > x + width + 5 || Math.abs(ys[other] - y) > 9),
				);
				if (!spot) continue;
				boxes.push([spot[0], spot[1], width]);
				ctx.lineWidth = 3.5;
				ctx.strokeStyle = rgba(paper, 0.92);
				ctx.strokeText(this.titles[index], spot[0], spot[1]);
				ctx.fillStyle = rgba(ink, index === active ? 1 : 0.82);
				ctx.fillText(this.titles[index], spot[0], spot[1]);
			}
			ctx.globalAlpha = 1;
		}
	}
}
