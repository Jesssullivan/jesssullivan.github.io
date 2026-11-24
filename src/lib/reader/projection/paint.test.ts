import { describe, expect, it } from 'vitest';
import type { Post } from '$lib/posts';
import type { ConstellationData } from './layout';
import { Painter, glowTransform, parseColour, type Frame, type Palette } from './paint';
import { buildSky } from './scene';
import { FIT } from './view';

const post = (slug: string): Post => ({ slug, title: `Title of ${slug}`, date: '2026-01-01', description: '', tags: [], published: true });

// Titles: 80 pixels wide. On the wide frame b shows on its right from scale 2 and c on its left from scale 4. a never shows.
const data: ConstellationData = {
	schema: 'constellation.v1',
	corpus_sha256: 'test',
	aspect: 1.5,
	categories: ['ecology', 'hardware'],
	labels: ['Ecology', 'Hardware'],
	groups: [{ name: 'Ecology', wide: [300, 50], tall: [50, 300], glow: [300, 300, 200, 200], category: 0 }],
	stars: [
		['a', 0, 0, 0, 0, 0, 0],
		['b', 500, 500, 0, 0, 1, 2],
		['c', 1000, 1000, 1, 0, 3, 1],
	],
	figure: [
		[0, 1],
		[1, 2],
	],
	near: [[1], [0, 2], [1]],
	titles: { width: [80, 80, 80], wide: [0, 20 * 4, 40 * 4 + 1], tall: [0, 0, 0] },
};

/** A canvas context that only counts what is drawn. */
function recorder() {
	const calls: Record<string, number> = {};
	const ctx = new Proxy({} as Record<string, unknown>, {
		get: (_, key: string) => () => (calls[key] = (calls[key] ?? 0) + 1),
		set: () => true,
	});
	return { ctx: ctx as unknown as CanvasRenderingContext2D, calls };
}

const palette: Palette = { dark: true, ink: [240, 240, 240], paper: [10, 10, 10], accent: [200, 180, 120], stars: [[1, 2, 3], [4, 5, 6]], sprites: [{}, {}] as unknown as HTMLCanvasElement[] };
const sky = buildSky(data, ['a', 'b', 'c'].map(post))!;
// The field is 1.25 times the reference field across and a little more than once down, so the title scale is 1.05 times the zoom.
const frame = (patch: Partial<Frame> = {}): Frame => ({ size: { w: 1000, h: 500 }, field: { x: 100, y: 50, w: 800, h: 400 }, view: FIT, tall: false, scale: 1, active: -1, hover: -1, focus: -1, filter: -1, group: -1, intro: 1, ...patch });

describe('constellation painter', () => {
	it('puts each star where the silhouette has it: inside the field, by its unit position', () => {
		const painter = new Painter(sky, palette);
		painter.project(frame());
		expect([...painter.xs]).toEqual([100, 500, 900]);
		expect([...painter.ys]).toEqual([50, 250, 450]);
		// A view only scales and shifts.
		painter.project(frame({ view: { k: 2, x: -100, y: -50 } }));
		expect([...painter.xs]).toEqual([100, 900, 1700]);
		expect([...painter.ys]).toEqual([50, 450, 850]);
	});

	it('starts as the silhouette and ends as the sky', () => {
		const painter = new Painter(sky, palette);
		const start = recorder();
		painter.draw(start.ctx, frame({ intro: 0 }));
		// Before the sky assembles: the three stars and nothing else.
		expect(start.calls.arc).toBe(3);
		expect(start.calls.lineTo).toBeUndefined();
		expect(start.calls.fillRect).toBeUndefined();
		const end = recorder();
		painter.draw(end.ctx, frame());
		// Assembled: a disc and a paler centre per star, both figure lines and the dust.
		expect(end.calls.arc).toBe(6);
		expect(end.calls.lineTo).toBe(2);
		expect(end.calls.fillRect).toBeGreaterThan(100);
		expect(end.calls.fillText).toBeUndefined();
	});

	it('blends nothing in a frame and fills each category once', () => {
		const painter = new Painter(sky, palette);
		const rest = recorder();
		painter.draw(rest.ctx, frame());
		// No sprite and no gradient: the soft layer is drawn elsewhere, once.
		expect(rest.calls.drawImage).toBeUndefined();
		// Two categories and the pale centres.
		expect(rest.calls.fill).toBe(3);
	});

	it('joins the pinned star to its nearest posts and rings it', () => {
		const painter = new Painter(sky, palette);
		const active = recorder();
		painter.draw(active.ctx, frame({ active: 1, focus: 1 }));
		// Two figure lines and two lines to the nearest posts. Six star arcs and two rings.
		expect(active.calls.lineTo).toBe(4);
		expect(active.calls.arc).toBe(8);
	});

	it('ties a card that sits away from its star to the star with one more line', () => {
		const painter = new Painter(sky, palette);
		const tied = recorder();
		painter.draw(tied.ctx, frame({ active: 1, leader: [700, 300] }));
		expect(tied.calls.lineTo).toBe(5);
		// A leader with nothing pinned is not drawn.
		const loose = recorder();
		painter.draw(loose.ctx, frame({ leader: [700, 300] }));
		expect(loose.calls.lineTo).toBe(2);
	});

	it('rings the star under the pointer and the star the keyboard is on, without joining them to anything', () => {
		const painter = new Painter(sky, palette);
		const pointed = recorder();
		painter.draw(pointed.ctx, frame({ hover: 0, focus: 2 }));
		expect(pointed.calls.lineTo).toBe(2);
		expect(pointed.calls.arc).toBe(8);
	});

	it('draws each title from the scale the layout gave it, and never one the panel would cut', () => {
		const painter = new Painter(sky, palette);
		const titles = (view: Frame['view']) => {
			const shot = recorder();
			painter.draw(shot.ctx, frame({ view }));
			return shot.calls.fillText ?? 0;
		};
		// Scale 1.9: below every title.
		expect(titles({ k: 1.8, x: -400, y: -200 })).toBe(0);
		// Scale 3.2: b, in the middle of the panel, shows. c waits for scale 4.
		expect(titles({ k: 3, x: -1000, y: -500 })).toBe(1);
		// The painter says where it drew that title, so a tooltip can keep off it: b is at 500, 250 and its title is 80 wide, to its right.
		expect(painter.labelBoxes).toHaveLength(5);
		expect(painter.labelBoxes[0]).toBeGreaterThan(500);
		expect(painter.labelBoxes[2] - painter.labelBoxes[0]).toBe(80);
		expect([painter.labelBoxes[1], painter.labelBoxes[3], painter.labelBoxes[4]]).toEqual([242, 258, 1]);
		// Scale 4.7 with c near the middle: c shows. b is off the panel.
		expect(titles({ k: 4.5, x: -3550, y: -1775 })).toBe(1);
		// Scale 3.2 with b at the right edge: its title would be cut, so it is left out.
		expect(titles({ k: 3, x: -520, y: -500 })).toBe(0);
		// A strip that holds controls takes no title either.
		const strip = recorder();
		painter.draw(strip.ctx, frame({ view: { k: 3, x: -1000, y: -500 }, strips: [260, 0] }));
		expect(strip.calls.fillText).toBeUndefined();
		// A star with a tooltip or a card is already named: its title is not drawn a second time.
		for (const patch of [{ hover: 1 }, { focus: 1 }, { active: 1 }]) {
			const named = recorder();
			painter.draw(named.ctx, frame({ view: { k: 3, x: -1000, y: -500 }, ...patch }));
			expect(named.calls.fillText).toBeUndefined();
			expect(painter.labelBoxes).toEqual([]);
		}
	});

	it('keeps a filtered-out category on the map without its pale centre', () => {
		const painter = new Painter(sky, palette);
		const filtered = recorder();
		painter.draw(filtered.ctx, frame({ filter: 1 }));
		// All three stars are still drawn. Only the hardware star keeps its centre.
		expect(filtered.calls.arc).toBe(4);
	});

	it('draws the glows once and then only moves them', () => {
		const painter = new Painter(sky, palette);
		const glow = recorder();
		painter.drawGlow(glow.ctx, { w: 1000, h: 500 }, { x: 100, y: 50, w: 800, h: 400 }, 1, -1);
		// One for the constellation and one halo per star.
		expect(glow.calls.drawImage).toBe(4);
		const filtered = recorder();
		painter.drawGlow(filtered.ctx, { w: 1000, h: 500 }, { x: 100, y: 50, w: 800, h: 400 }, 1, 1);
		expect(filtered.calls.drawImage).toBe(2);
		expect(glowTransform(FIT)).toBe('translate(0.00px,0.00px) scale(1.0000)');
		expect(glowTransform({ k: 4, x: -3000, y: -1500 })).toBe('translate(-3000.00px,-1500.00px) scale(4.0000)');
	});

	it('reads a computed colour in either form the browser gives', () => {
		expect(parseColour('rgb(12, 34, 56)')).toEqual([12, 34, 56]);
		expect(parseColour('rgba(12, 34, 56, 0.5)')).toEqual([12, 34, 56]);
		expect(parseColour('color(srgb 0.5 0.25 1)')).toEqual([128, 64, 255]);
		// A colour outside sRGB is brought to its edge.
		expect(parseColour('color(srgb 1.2 -0.1 0.5)')).toEqual([255, 0, 128]);
		expect(parseColour('oklch(0.5 0.1 120)')).toBeNull();
		expect(parseColour('')).toBeNull();
	});
});
