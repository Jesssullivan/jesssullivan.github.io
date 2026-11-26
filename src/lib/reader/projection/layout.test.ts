import { describe, expect, it } from 'vitest';
import { CATEGORY_ORDER, GRID, TITLE_FLOOR, layoutConstellation, serializeLayout, silhouetteOf, titleWidth, wordCount, type LayoutSource, type ProjectionInput } from './layout';
import { isConstellationData } from './scene';
import { LABEL_FIELD, STAR_RADIUS, TITLE_GAP, shortTitle } from './view';

// Three tight groups along a diagonal, so the long axis is not horizontal to begin with.
function fixture(): { projection: ProjectionInput; sources: LayoutSource[] } {
	const sources: LayoutSource[] = [];
	const posts: Array<{ slug: string; x: number; y: number }> = [];
	const groups = [
		{ at: [0.15, 0.2], category: 'ecology', tags: ['Birding', 'Featured'], count: 12 },
		{ at: [0.5, 0.5], category: 'hardware', tags: ['3d-printing', 'Featured'], count: 12 },
		{ at: [0.85, 0.8], category: 'music', tags: ['Music'], count: 12 },
	];
	groups.forEach((group, g) => {
		for (let i = 0; i < group.count; i += 1) {
			const slug = `g${g}-p${String(i).padStart(2, '0')}`;
			const angle = (i / group.count) * Math.PI * 2;
			const reach = 0.02 + 0.03 * ((i * 7) % 5) / 5;
			posts.push({ slug, x: group.at[0] + Math.cos(angle) * reach, y: group.at[1] + Math.sin(angle) * reach });
			// The middle group is split across two categories, so only its tag is shared by all of it.
			const category = g === 1 && i % 2 ? 'software' : group.category;
			sources.push({ slug, title: `Post ${i} of group ${g}, ${'long '.repeat(i % 4)}title`, date: `20${10 + g * 5}-0${1 + (i % 9)}-01`, tags: group.tags, category, body: 'word '.repeat(g === 2 && i === 0 ? 2000 : 50 + i * 60) });
		}
	});
	const edges: Array<[number, number, number]> = [
		[0, 1, 0.9],
		[0, 2, 0.5],
		[12, 13, 0.4],
	];
	return { projection: { corpus_sha256: 'fixture', posts, edges }, sources };
}

describe('constellation layout', () => {
	const { projection, sources } = fixture();
	const data = layoutConstellation(projection, sources);

	it('is a valid document and gives the same bytes every time', () => {
		expect(isConstellationData(data)).toBe(true);
		expect(serializeLayout(layoutConstellation(projection, sources))).toBe(serializeLayout(data));
		expect(serializeLayout(layoutConstellation(projection, [...sources].reverse()))).toBe(serializeLayout(data));
		expect(data.corpus_sha256).toBe('fixture');
	});

	it('turns the long axis across the screen and fills the grid', () => {
		expect(data.aspect).toBeGreaterThan(1.5);
		const xs = data.stars.map((star) => star[1]);
		const ys = data.stars.map((star) => star[2]);
		expect([Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)]).toEqual([0, GRID, 0, GRID]);
		expect(data.stars.map((star) => star[0])).toEqual(projection.posts.map((post) => post.slug));
	});

	it('makes a constellation of each category that sits together, and names it as the legend does', () => {
		// The middle group holds two categories in turn, so it is two constellations in one place.
		expect(data.categories).toEqual(CATEGORY_ORDER.filter((id) => ['ecology', 'hardware', 'music', 'software'].includes(id)));
		expect(data.labels).toEqual(['Ecology', 'Music', 'Hardware', 'Software']);
		expect(data.groups.map((group) => group.name).sort()).toEqual(['Ecology', 'Hardware', 'Music', 'Software']);
		// Every name on the map is a word in the legend, in the colour of its stars.
		for (const group of data.groups) expect(group.name).toBe(data.labels[group.category]);
		// Every star in a figure has the figure's category: no name is wrong for any of its stars.
		for (const [, , , category, group] of data.stars) expect(data.groups[group].category).toBe(category);
		expect(data.stars.filter((star) => star[4] < 0)).toEqual([]);
	});

	it('gives the name to the largest constellation of a category, and no name to a smaller one or to a stray star', () => {
		// Four more music posts far from the music group, one tutorial inside the ecology group and one hardware post on its own.
		const extra = [
			{ slug: 'm1', x: 0.84, y: 0.16 },
			{ slug: 'm2', x: 0.86, y: 0.17 },
			{ slug: 'm3', x: 0.85, y: 0.19 },
			{ slug: 'm4', x: 0.87, y: 0.15 },
			{ slug: 'stray', x: 0.15, y: 0.2 },
			{ slug: 'alone', x: 0.2, y: 0.85 },
		];
		const source = (slug: string, category: string): LayoutSource => ({ slug, date: '2012-01-01', tags: ['Featured', 'Ideas'], category, body: 'word '.repeat(300) });
		const mixed = [...sources, ...extra.slice(0, 4).map((post) => source(post.slug, 'music')), source('stray', 'tutorial'), source('alone', 'hardware')];
		const laid = layoutConstellation({ corpus_sha256: 'fixture', posts: [...projection.posts, ...extra], edges: projection.edges }, mixed);
		const music = laid.categories.indexOf('music');
		const ofMusic = laid.groups.filter((group) => group.category === music);
		expect(ofMusic.map((group) => group.name)).toEqual(['Music', '']);
		// The smaller one still has its figure.
		const small = laid.groups.indexOf(ofMusic[1]);
		const members = laid.stars.map((star, index) => (star[4] === small ? index : -1)).filter((index) => index >= 0);
		expect(members.map((index) => laid.stars[index][0])).toEqual(['m1', 'm2', 'm3', 'm4']);
		expect(laid.figure.filter(([a, b]) => members.includes(a) && members.includes(b)).length).toBeGreaterThanOrEqual(2);
		// A name is never a tag, and never one a group did not earn.
		expect(laid.groups.map((group) => group.name).filter(Boolean).sort()).toEqual(['Ecology', 'Hardware', 'Music', 'Software']);
		for (const slug of ['stray', 'alone']) {
			const row = laid.stars.findIndex((star) => star[0] === slug);
			expect(laid.stars[row][4]).toBe(-1);
			expect(laid.figure.flat()).not.toContain(row);
			// It is still a star, with its own colour and its neighbours.
			expect(laid.categories[laid.stars[row][3]]).toBe(slug === 'stray' ? 'tutorial' : 'hardware');
			expect(laid.near[row].length).toBeGreaterThanOrEqual(2);
		}
	});

	it('gives each title a side and a scale, and no two titles or a title and a star ever meet', () => {
		expect(data.titles.width).toEqual(sources.map((source) => titleWidth(shortTitle(source.title as string))));
		for (const frame of ['wide', 'tall'] as const) {
			const [width, height] = LABEL_FIELD[frame];
			const codes = data.titles[frame];
			expect(codes.filter(Boolean).length).toBeGreaterThan(0);
			for (const code of codes.filter(Boolean)) expect(code >> 2).toBeGreaterThanOrEqual(TITLE_FLOOR * 10);
			// The box the map draws a title in, at a scale of the reference field and at the zoom that gives it there.
			const box = (index: number, scale: number) => {
				const [, gx, gy, , , size] = data.stars[index];
				const [x, y] = (frame === 'wide' ? [gx, gy] : [gy, gx]).map((value, axis) => (value / GRID) * (axis ? height : width) * scale);
				const offset = STAR_RADIUS[size] * scale ** 0.35 + TITLE_GAP;
				const wide = data.titles.width[index];
				const side = codes[index] & 3;
				return side === 0 ? [x + offset, y - 7, x + offset + wide, y + 7] : side === 1 ? [x - offset - wide, y - 7, x - offset, y + 7] : side === 2 ? [x - wide / 2, y + offset + 1, x + wide / 2, y + offset + 15] : [x - wide / 2, y - offset - 15, x + wide / 2, y - offset - 1];
			};
			const meetings: string[] = [];
			for (const scale of [2, 2.4, 3, 4.1, 6, 9]) {
				const shown = codes.map((code, index) => (code && code >> 2 <= scale * 10 ? box(index, scale) : null));
				const at = data.stars.map(([, gx, gy]) => (frame === 'wide' ? [gx, gy] : [gy, gx]).map((value, axis) => (value / GRID) * (axis ? height : width) * scale));
				shown.forEach((a, i) => {
					if (!a) return;
					at.forEach(([x, y], j) => {
						if (i !== j && x > a[0] && x < a[2] && y > a[1] && y < a[3]) meetings.push(`title ${i} over star ${j} at ${scale}`);
					});
					shown.forEach((b, j) => {
						if (b && j > i && a[0] < b[2] && b[0] < a[2] && a[1] < b[3] && b[1] < a[3]) meetings.push(`titles ${i} and ${j} at ${scale}`);
					});
				});
			}
			expect(meetings, frame).toEqual([]);
		}
		// Letters are counted by their kind, so a narrow title takes less room than a wide one.
		expect(titleWidth('illicit')).toBeLessThan(titleWidth('MAMMOTH'));
	});

	it('draws each group as a sparse figure, not a hairball', () => {
		const groupOf = data.stars.map((star) => star[4]);
		// A spanning tree has one line fewer than its stars. Overlong lines are dropped.
		expect(data.figure.length).toBeLessThanOrEqual(data.stars.length - data.groups.length);
		expect(data.figure.length).toBeGreaterThan(data.stars.length * 0.6);
		for (const [a, b] of data.figure) {
			expect(a).toBeLessThan(b);
			expect(groupOf[a]).toBe(groupOf[b]);
		}
	});

	it('sizes a star by length and lights it by recency', () => {
		const star = (slug: string) => data.stars.find((row) => row[0] === slug)!;
		expect(star('g0-p00')[5]).toBe(0);
		expect(star('g2-p00')[5]).toBe(3);
		// The newest post sets the clock: its group glows, a post fifteen years older does not.
		expect(star('g2-p00')[6]).toBe(2);
		expect(star('g0-p00')[6]).toBe(0);
		expect(wordCount('One two three.\n\n```\ncode is not counted\n```\n[a link](https://example.com/skipped)')).toBe(5);
	});

	it('offers nearby posts for every star, similar ones first', () => {
		expect(data.near[0].slice(0, 2)).toEqual([1, 2]);
		for (const [index, list] of data.near.entries()) {
			expect(list.length).toBeGreaterThanOrEqual(2);
			expect(list).not.toContain(index);
			expect(new Set(list).size).toBe(list.length);
		}
	});

	it('keeps every label clear of every star on both frames', () => {
		for (const frame of ['wide', 'tall'] as const) {
			const [width, height] = LABEL_FIELD[frame];
			for (const group of data.groups.filter((entry) => entry.name)) {
				const [lx, ly] = group[frame];
				const halfW = (group.name.length * 7.6 + 10) / 2;
				for (const [, x, y] of data.stars) {
					const [sx, sy] = frame === 'wide' ? [x, y] : [y, x];
					const inside = Math.abs((sx - lx) / GRID * width) < halfW && Math.abs((sy - ly) / GRID * height) < 8;
					expect(inside, `${group.name} on ${frame}`).toBe(false);
				}
			}
		}
	});

	it('builds a silhouette with every star once per frame', () => {
		const silhouette = silhouetteOf(data);
		expect(silhouette.count).toBe(data.stars.length);
		expect(silhouette.categories.map((category) => category.count)).toEqual([12, 12, 6, 6]);
		for (const frame of [silhouette.wide, silhouette.tall]) {
			expect(frame.reduce((sum, [, , d]) => sum + (d.match(/M/g) ?? []).length, 0)).toBe(data.stars.length);
		}
		const [slug, x, y, category, , size] = data.stars[0];
		expect(slug).toBe('g0-p00');
		expect(silhouette.wide.find((row) => row[0] === category && row[1] === size)?.[2]).toContain(`M${x} ${y}h.01`);
		expect(silhouette.tall.find((row) => row[0] === category && row[1] === size)?.[2]).toContain(`M${y} ${x}h.01`);
	});

	it('refuses a projection with a post it has no source for', () => {
		expect(() => layoutConstellation(projection, sources.slice(1))).toThrow(/g0-p00/);
	});
});
