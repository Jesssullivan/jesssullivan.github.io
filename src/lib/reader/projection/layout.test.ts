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

	it('names each group from what its posts share, never from a generic tag', () => {
		expect(data.groups.map((group) => group.name).sort()).toEqual(['Birding', 'Making', 'Music']);
		for (const [slug, , , , group] of data.stars) expect(data.groups[group].name).toBe({ g0: 'Birding', g1: 'Making', g2: 'Music' }[slug.slice(0, 2)]);
		// Categories keep the legend order, and each group is tinted by the category most of it shares.
		expect(data.categories).toEqual(CATEGORY_ORDER.filter((id) => ['ecology', 'hardware', 'music', 'software'].includes(id)));
		expect(data.labels).toEqual(['Ecology', 'Music', 'Hardware', 'Software']);
		expect(data.groups.find((group) => group.name === 'Music')?.category).toBe(data.categories.indexOf('music'));
	});

	it('never names a group from a catch-all tag, and keeps a post out of a figure whose name is not true of it', () => {
		// One recipe sits in the middle of the birding group, and the music group carries only the old Ideas tag.
		const posts = [...projection.posts, { slug: 'stray', x: 0.15, y: 0.2 }];
		const mixed = [...sources.map((source) => (source.slug.startsWith('g2') ? { ...source, tags: ['Ideas', 'How-To', 'DIY'] } : source)), { slug: 'stray', date: '2012-01-01', tags: ['recipe'], category: 'tutorial', body: 'word '.repeat(300) }];
		const laid = layoutConstellation({ corpus_sha256: 'fixture', posts, edges: projection.edges }, mixed);
		expect(laid.groups.map((group) => group.name).sort()).toEqual(['Birding', 'Making', 'Music']);
		const row = laid.stars.findIndex((star) => star[0] === 'stray');
		expect(laid.stars[row][4]).toBe(-1);
		expect(laid.figure.flat()).not.toContain(row);
		// It is still a star, with its own colour and its neighbours.
		expect(laid.categories[laid.stars[row][3]]).toBe('tutorial');
		expect(laid.near[row].length).toBeGreaterThanOrEqual(2);
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
			for (const group of data.groups) {
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
