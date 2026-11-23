/**
 * Canvas painter for the constellation (TIN-8628).
 *
 * One call draws one frame: dust, figure lines, stars, the lines to the active
 * star's nearest posts, rings and, when zoomed in, post titles. Every soft
 * thing (the glow of each constellation and of each star) is drawn once into
 * its own canvas and then only moved, so a frame fills a few hundred small
 * shapes and blends nothing large. Colours come from the section's CSS custom
 * properties, which derive from the theme tokens, so the canvas follows all
 * five themes in light and dark.
 */
import type { Sky } from './scene';
import { TITLE_FONT, TITLE_GAP, labelScale, shortTitle, starRadius, type Size, type View } from './view';

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
	/** True on the tall (phone) frame. */
	tall: boolean;
	/** Star size multiplier: smaller on narrow panels. */
	scale: number;
	/** Strips at the top and the foot of the panel that hold controls or the picked post. No title is drawn there. */
	strips?: [number, number];
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
/** A title fades in over this much scale past the scale it was placed for. */
const TITLE_FADE = 0.25;

const rgba = ([r, g, b]: Rgb, alpha = 1) => `rgba(${r},${g},${b},${alpha})`;
const smooth = (t: number) => {
	const c = Math.min(1, Math.max(0, t));
	return c * c * (3 - 2 * c);
};

/** An sRGB triple from a computed colour: `rgb(r, g, b)` or `color(srgb r g b)`. Null when it is neither. */
export function parseColour(value: string): Rgb | null {
	const parts = value.match(/-?\d*\.?\d+(?:e[-+]?\d+)?/gi)?.map(Number);
	if (!parts || parts.length < 3 || !/^(?:rgba?|color\(srgb )/.test(value)) return null;
	const scale = value.startsWith('color(') ? 255 : 1;
	return [0, 1, 2].map((i) => Math.round(Math.min(255, Math.max(0, parts[i] * scale)))) as Rgb;
}

/**
 * Resolve the section's colour properties to sRGB. The browser does the
 * conversion: a mix in sRGB computes to an sRGB colour whatever space the
 * token is written in. A property the browser cannot resolve takes the text
 * colour the section inherits, so nothing here names a colour. Null when even
 * that cannot be read: the silhouette then stays as the map.
 */
export function readPalette(host: HTMLElement, categories: number): Palette | null {
	const probe = document.createElement('span');
	// No transition, or the value read back is the one before the change. The site's reduced-motion rule gives every element a very short one.
	probe.style.cssText = 'position:absolute;width:0;height:0;visibility:hidden;transition:none!important';
	host.append(probe);
	const mixed = (colour: string) => {
		probe.style.color = '';
		probe.style.color = `color-mix(in srgb, ${colour} 100%, transparent)`;
		return parseColour(getComputedStyle(probe).color);
	};
	const text = mixed('currentColor');
	if (!text) {
		probe.remove();
		return null;
	}
	const resolve = (property: string): Rgb => mixed(`var(${property})`) ?? text;
	const stars = Array.from({ length: categories }, (_, i) => resolve(`--star-${i % 8}`));
	const palette: Palette = {
		dark: getComputedStyle(host).getPropertyValue('--sky-dark').trim() === '1',
		ink: resolve('--sky-ink'),
		paper: resolve('--sky-paper'),
		accent: resolve('--sky-accent'),
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

/** Faint specks behind the map, brightest first. They are scenery, not posts: they ride with the map and cannot be picked. */
const DUST = Array.from({ length: 180 }, (_, i) => ({ x: jitter(i * 3 + 11), y: jitter(i * 7 + 5), weight: jitter(i * 13 + 2) })).sort((a, b) => b.weight - a.weight);
const BRIGHT_DUST = DUST.findIndex((speck) => speck.weight <= 0.8);

/** The CSS transform that carries the glow canvas along with a view. */
export function glowTransform(view: View): string {
	return `translate(${view.x.toFixed(2)}px,${view.y.toFixed(2)}px) scale(${view.k.toFixed(4)})`;
}

export class Painter {
	xs = new Float32Array(0);
	ys = new Float32Array(0);
	private radii = new Float32Array(0);
	private titles: string[] = [];
	/** Star indices by category, so one fill paints a whole category. */
	private byCategory: number[][] = [];

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
		this.titles = sky.stars.map((star) => shortTitle(star.title));
		this.byCategory = sky.categories.map((_, category) => sky.stars.filter((star) => star.category === category).map((star) => star.index));
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
	 * Everything soft: the glow of each constellation and the halo of each
	 * star, by recency. Drawn once at the resting view, at one pixel per CSS
	 * pixel. A frame then only moves this canvas, which costs no drawing at all.
	 */
	drawGlow(ctx: CanvasRenderingContext2D, size: Size, field: Rect, scale: number, filter: number) {
		const { sky, palette } = this;
		const lit = (category: number) => filter < 0 || category === filter;
		ctx.clearRect(0, 0, size.w, size.h);
		for (const cluster of sky.groups) {
			const [cx, cy, rx, ry] = cluster.glow;
			const w = rx * field.w * 2;
			const h = ry * field.h * 2;
			ctx.globalAlpha = (palette.dark ? 0.36 : 0.2) * (lit(cluster.category) ? 1 : 0.25);
			ctx.drawImage(palette.sprites[cluster.category], field.x + cx * field.w - w / 2, field.y + cy * field.h - h / 2, w, h);
		}
		for (const star of sky.stars) {
			if (!lit(star.category)) continue;
			const halo = starRadius(star.size, 1, scale) * [2.6, 3.8, 5][star.glow];
			ctx.globalAlpha = [0.4, 0.7, 1][star.glow] * (palette.dark ? 1 : 0.5);
			ctx.drawImage(palette.sprites[star.category], field.x + star.x * field.w - halo, field.y + star.y * field.h - halo, halo * 2, halo * 2);
		}
		ctx.globalAlpha = 1;
	}

	draw(ctx: CanvasRenderingContext2D, frame: Frame) {
		const { size, field, view, scale, active, hover, filter, group, intro } = frame;
		const { sky, palette, xs, ys, radii } = this;
		const { stars } = sky;
		const { dark, ink, paper, accent } = palette;
		this.project(frame);
		ctx.clearRect(0, 0, size.w, size.h);
		const shown = (index: number) => filter < 0 || stars[index].category === filter;
		const onScreen = (index: number, margin: number) => xs[index] > -margin && xs[index] < size.w + margin && ys[index] > -margin && ys[index] < size.h + margin;
		// The scenery arrives in the second half of the intro: dust, figure lines and the pale centre of each star.
		const drawn = smooth((intro - 0.5) / 0.5);

		if (drawn > 0) {
			ctx.fillStyle = rgba(ink);
			DUST.forEach((speck, i) => {
				if (i === 0 || i === BRIGHT_DUST) ctx.globalAlpha = drawn * (i === 0 ? (dark ? 0.38 : 0.16) : dark ? 0.2 : 0.09);
				const x = speck.x * size.w * view.k + view.x;
				const y = speck.y * size.h * view.k + view.y;
				if (x > 0 && x < size.w && y > 0 && y < size.h) ctx.fillRect(x, y, i < BRIGHT_DUST ? 1.6 : 1, i < BRIGHT_DUST ? 1.6 : 1);
			});
			ctx.globalAlpha = 1;

			// Figure lines, drawn from one end as the intro runs. The figure under the pointer, or of the active star, is brighter.
			const lit = group >= 0 ? group : active >= 0 ? stars[active].group : -1;
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

		// Stars. Once the sky has assembled, one fill paints a whole category.
		for (let i = 0; i < stars.length; i += 1) radii[i] = starRadius(stars[i].size, view.k, scale);
		const disc = (index: number, radius: number) => {
			ctx.moveTo(xs[index] + radius, ys[index]);
			ctx.arc(xs[index], ys[index], radius, 0, Math.PI * 2);
		};
		this.byCategory.forEach((members, category) => {
			ctx.fillStyle = rgba(palette.stars[category]);
			if (intro < 1) {
				// Assembling: each star swells and brightens in its own time, left to right.
				for (const i of members) {
					if (!onScreen(i, 12)) continue;
					const t = smooth((intro - 0.5 * (0.7 * stars[i].x + 0.3 * jitter(i))) / 0.35);
					radii[i] *= 1 + 0.35 * Math.sin(Math.PI * t);
					ctx.globalAlpha = (SILHOUETTE_ALPHA + (1 - SILHOUETTE_ALPHA) * t) * (shown(i) ? 1 : 0.22);
					ctx.beginPath();
					disc(i, radii[i]);
					ctx.fill();
				}
				return;
			}
			ctx.globalAlpha = filter < 0 || category === filter ? 1 : 0.22;
			ctx.beginPath();
			for (const i of members) if (onScreen(i, 12)) disc(i, radii[i]);
			ctx.fill();
		});
		// At night a paler centre, so a star reads as a light and not a disc.
		if (dark && drawn > 0) {
			ctx.globalAlpha = 0.5 * drawn;
			ctx.fillStyle = rgba(ink);
			ctx.beginPath();
			for (let i = 0; i < stars.length; i += 1) if (shown(i) && onScreen(i, 12)) disc(i, radii[i] * 0.45);
			ctx.fill();
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

		// Titles. The generator chose the side of each star and the scale it shows from. Nothing is searched here.
		const at = labelScale(view.k, field, frame.tall);
		const [top, foot] = frame.strips ?? [0, 0];
		ctx.font = TITLE_FONT;
		ctx.textBaseline = 'middle';
		ctx.lineJoin = 'round';
		ctx.lineWidth = 3;
		ctx.strokeStyle = rgba(paper, 0.9);
		ctx.fillStyle = rgba(ink);
		for (let i = 0; i < stars.length; i += 1) {
			const { label, labelWidth } = stars[i];
			const alpha = label ? smooth((at - (label >> 2) / 10) / TITLE_FADE) : 0;
			if (alpha <= 0 || !shown(i) || !onScreen(i, 0)) continue;
			const side = label & 3;
			const offset = radii[i] + TITLE_GAP;
			const x = xs[i] + (side === 0 ? offset : side === 1 ? -offset : 0);
			const y = ys[i] + (side === 2 ? offset + 8 : side === 3 ? -offset - 8 : 0);
			// A title the panel would cut is left out.
			const left = side === 0 ? x : side === 1 ? x - labelWidth : x - labelWidth / 2;
			if (left < 4 || left + labelWidth > size.w - 4 || y < top + 10 || y > size.h - foot - 10) continue;
			ctx.textAlign = side === 0 ? 'left' : side === 1 ? 'right' : 'center';
			ctx.globalAlpha = alpha;
			ctx.strokeText(this.titles[i], x, y, labelWidth);
			ctx.fillText(this.titles[i], x, y, labelWidth);
		}
		ctx.globalAlpha = 1;
	}
}
