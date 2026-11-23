import { describe, expect, it } from 'vitest';
import type { Post } from '$lib/posts';
import type { ConstellationData } from './layout';
import { Painter, backdropTransforms, type Frame, type Palette } from './paint';
import { buildSky } from './scene';
import { FIT } from './view';

const post = (slug: string): Post => ({ slug, title: `Title of ${slug}`, date: '2026-01-01', description: '', tags: [], published: true });

const data: ConstellationData = {
	schema: 'constellation.v1',
	corpus_sha256: 'test',
	aspect: 1.5,
	categories: ['ecology', 'hardware'],
	labels: ['Ecology', 'Hardware'],
	groups: [{ name: 'Birding', wide: [300, 50], tall: [50, 300], glow: [300, 300, 200, 200], category: 0 }],
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
};

/** A canvas context that only counts what is drawn. */
function recorder() {
	const calls: Record<string, number> = {};
	const ctx = new Proxy({ measureText: () => ({ width: 80 }) } as Record<string, unknown>, {
		get: (target, key: string) => (key in target ? target[key] : () => (calls[key] = (calls[key] ?? 0) + 1)),
		set: () => true,
	});
	return { ctx: ctx as unknown as CanvasRenderingContext2D, calls };
}

const palette: Palette = { dark: true, ink: [240, 240, 240], paper: [10, 10, 10], accent: [200, 180, 120], stars: [[1, 2, 3], [4, 5, 6]], sprites: [{}, {}] as unknown as HTMLCanvasElement[] };
const sky = buildSky(data, ['a', 'b', 'c'].map(post))!;
const frame = (patch: Partial<Frame> = {}): Frame => ({ size: { w: 1000, h: 500 }, field: { x: 100, y: 50, w: 800, h: 400 }, view: FIT, scale: 1, active: -1, hover: -1, ring: false, filter: -1, group: -1, intro: 1, ...patch });

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
		// Before the sky assembles: the three stars, no glow and no figure line.
		expect(start.calls.arc).toBe(3);
		expect(start.calls.drawImage).toBeUndefined();
		expect(start.calls.lineTo).toBeUndefined();
		const end = recorder();
		painter.draw(end.ctx, frame());
		// Assembled: a core and a paler centre per star, a halo per star and both figure lines.
		expect(end.calls.arc).toBe(6);
		expect(end.calls.drawImage).toBe(3);
		expect(end.calls.lineTo).toBe(2);
		expect(end.calls.fillText).toBeUndefined();
	});

	it('joins the active star to its nearest posts, rings it, and names stars once zoomed in', () => {
		const painter = new Painter(sky, palette);
		const active = recorder();
		painter.draw(active.ctx, frame({ active: 1, ring: true }));
		// Two figure lines and two lines to the nearest posts. Six star arcs and two rings.
		expect(active.calls.lineTo).toBe(4);
		expect(active.calls.arc).toBe(8);
		const zoomed = recorder();
		painter.draw(zoomed.ctx, frame({ view: { k: 3, x: -1000, y: -500 } }));
		expect(zoomed.calls.fillText).toBeGreaterThan(0);
	});

	it('keeps a filtered-out category on the map without a halo', () => {
		const painter = new Painter(sky, palette);
		const filtered = recorder();
		painter.draw(filtered.ctx, frame({ filter: 1 }));
		// Only the hardware star keeps its halo and its paler centre. All three are still drawn.
		expect(filtered.calls.drawImage).toBe(1);
		expect(filtered.calls.arc).toBe(4);
	});

	it('draws the backdrop once and then only moves it', () => {
		const painter = new Painter(sky, palette);
		const glow = recorder();
		const dust = recorder();
		painter.drawBackdrop(glow.ctx, dust.ctx, { w: 1000, h: 500 }, { x: 100, y: 50, w: 800, h: 400 }, -1);
		expect(glow.calls.drawImage).toBe(1);
		expect(dust.calls.fillRect).toBeGreaterThan(100);
		// At rest nothing has moved. Zoomed in, the glow follows the map and the dust moves less.
		expect(backdropTransforms(FIT, { w: 1000, h: 500 })).toEqual({ glow: 'translate(0.00px,0.00px) scale(1.0000)', dust: 'translate(0.00px,0.00px) scale(1.0000)' });
		const moved = backdropTransforms({ k: 4, x: -3000, y: -1500 }, { w: 1000, h: 500 });
		expect(moved.glow).toBe('translate(-3000.00px,-1500.00px) scale(4.0000)');
		const dustScale = Number(moved.dust.match(/scale\(([\d.]+)\)/)?.[1]);
		expect(dustScale).toBeGreaterThan(1);
		expect(dustScale).toBeLessThan(4);
	});
});
