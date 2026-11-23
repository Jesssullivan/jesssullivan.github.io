/**
 * Build-time layout for the reader constellation (TIN-8628).
 *
 * The t-SNE fit in posts-projection.v1.json only says where each post sits.
 * Everything else the map draws is decided here, once, by the generator:
 * the turn that puts the long axis across the screen, the groups and their
 * names, the figure lines, the size and glow of each star, the neighbours, the
 * name anchors and where and from what zoom each post title shows. The browser
 * applies transforms to this and nothing more.
 *
 * Nothing here reads the clock or a random source, so the same projection and
 * the same posts always give the same bytes.
 */
import { codePointCompare, stripPostMarkup } from './text';
import { LABEL_FIELD, MAX_ZOOM, STAR_GROWTH, STAR_RADIUS, TITLE_GAP, shortTitle } from './view';

export const CONSTELLATION_SCHEMA = 'constellation.v1';
export const SILHOUETTE_SCHEMA = 'constellation-silhouette.v1';

/** Coordinates are integers on this grid, each axis filled edge to edge. */
export const GRID = 1000;
/** About this many posts per group before names are settled. */
const POSTS_PER_GROUP = 12;
const MAX_GROUPS = 14;
/** A figure line longer than this many median lines of its group is not drawn. */
const LONG_LINE = 2.6;
/** Two groups that earn the same name merge when this close, in median nearest-star gaps. */
const MERGE_GAP = 6;
/** A group keeps its name and figure with at least this many stars that carry the name. */
const MIN_FIGURE = 3;
/** Titles show from this scale of the reference field up, so the map at rest carries names only. */
export const TITLE_FLOOR = 2.4;
/** A title that is not clear by this scale is never drawn. */
const TITLE_CEILING = 9;
/** Size steps by word count: a note, a post, a long post, an essay. */
export const SIZE_WORDS = [250, 700, 1800] as const;
/** Glow steps by age against the newest post: within one year, within five. */
const GLOW_YEARS = [1, 5] as const;

/**
 * Legend and hue order. Neighbouring entries get neighbouring hues, so related
 * categories read as a family.
 */
export const CATEGORY_ORDER = ['ecology', 'photography', 'personal', 'music', 'hardware', 'tutorial', 'software', 'devops'];

const CATEGORY_LABEL: Record<string, string> = {
	ecology: 'Ecology',
	photography: 'Photography',
	personal: 'Personal',
	music: 'Music',
	hardware: 'Hardware',
	tutorial: 'Tutorials',
	software: 'Software',
	devops: 'DevOps',
	other: 'Other',
};

/**
 * Tags that say nothing about a subject never name a group: these five are the
 * catch-all tags of the old WordPress site. A string value renames a tag.
 */
const TAG_LABEL: Record<string, string | null> = {
	featured: null,
	reviews: null,
	ideas: null,
	'how-to': null,
	diy: null,
	maker: 'Making',
	'3d-printing': 'Making',
	cnc: 'Making',
};

export interface LayoutSource {
	slug: string;
	/** Only its length is used, to reserve room for the title on the map. */
	title?: string;
	date: string;
	tags: string[];
	category?: string;
	body: string;
}

export interface ProjectionInput {
	corpus_sha256: string;
	posts: ReadonlyArray<{ slug: string; x: number; y: number }>;
	edges: ReadonlyArray<readonly [number, number, number]>;
}

/** [slug, x, y, category, group, size, glow]. Group is -1 for a star outside every group. */
export type StarRow = [string, number, number, number, number, number, number];

export interface GroupRow {
	name: string;
	/** Label centre on the wide frame and on the tall (transposed) frame. */
	wide: [number, number];
	tall: [number, number];
	/** Soft glow behind the group on the wide frame: centre and radii. */
	glow: [number, number, number, number];
	/** Category most of its stars share, for the glow tint. */
	category: number;
}

export interface ConstellationData {
	schema: typeof CONSTELLATION_SCHEMA;
	/** corpus_sha256 of the projection this was laid out from. */
	corpus_sha256: string;
	/** Width over height of the wide frame before each axis was filled. */
	aspect: number;
	categories: string[];
	labels: string[];
	groups: GroupRow[];
	stars: StarRow[];
	/** Figure lines, as pairs of star indices. */
	figure: Array<[number, number]>;
	/** Per star, its nearest posts: similarity neighbours first, strongest first. */
	near: number[][];
	/**
	 * Per star, the room its title takes in pixels, and for each frame where the
	 * title goes and from what scale: `scale * 10 * 4 + side`, with side 0 right,
	 * 1 left, 2 below and 3 above. 0 means the title is never drawn.
	 */
	titles: { width: number[]; wide: number[]; tall: number[] };
}

export interface Silhouette {
	schema: typeof SILHOUETTE_SCHEMA;
	corpus_sha256: string;
	aspect: number;
	count: number;
	categories: Array<{ id: string; label: string; count: number }>;
	/** One path per category and size, as [category, size, d], for each frame. */
	wide: Array<[number, number, string]>;
	tall: Array<[number, number, string]>;
}

interface Point {
	u: number;
	v: number;
}

export function wordCount(body: string): number {
	return stripPostMarkup(body).split(/\s+/).filter((word) => /[\p{L}\p{N}]/u.test(word)).length;
}

function step(value: number, thresholds: readonly number[]): number {
	let index = 0;
	while (index < thresholds.length && value >= thresholds[index]) index += 1;
	return index;
}

/** Turn the cloud so its long axis is horizontal. A pure rotation, never a mirror. */
function turn(points: ReadonlyArray<{ x: number; y: number }>): Point[] {
	const n = points.length || 1;
	const mx = points.reduce((sum, p) => sum + p.x, 0) / n;
	const my = points.reduce((sum, p) => sum + p.y, 0) / n;
	let sxx = 0;
	let syy = 0;
	let sxy = 0;
	for (const p of points) {
		sxx += (p.x - mx) ** 2;
		syy += (p.y - my) ** 2;
		sxy += (p.x - mx) * (p.y - my);
	}
	const theta = 0.5 * Math.atan2(2 * sxy, sxx - syy);
	const cos = Math.cos(-theta);
	const sin = Math.sin(-theta);
	return points.map((p) => ({ u: (p.x - mx) * cos - (p.y - my) * sin, v: (p.x - mx) * sin + (p.y - my) * cos }));
}

const distance = (a: Point, b: Point) => Math.hypot(a.u - b.u, a.v - b.v);

/** Ward agglomerative clustering down to `k` groups. Ties go to the lower indices. */
function ward(points: readonly Point[], k: number): number[][] {
	let clusters = points.map((p, i) => ({ members: [i], u: p.u, v: p.v }));
	while (clusters.length > k) {
		let bestI = 0;
		let bestJ = 1;
		let best = Infinity;
		for (let i = 0; i < clusters.length; i += 1) {
			for (let j = i + 1; j < clusters.length; j += 1) {
				const a = clusters[i];
				const b = clusters[j];
				const cost = ((a.members.length * b.members.length) / (a.members.length + b.members.length)) * ((a.u - b.u) ** 2 + (a.v - b.v) ** 2);
				if (cost < best) {
					best = cost;
					bestI = i;
					bestJ = j;
				}
			}
		}
		const a = clusters[bestI];
		const b = clusters[bestJ];
		const size = a.members.length + b.members.length;
		clusters[bestI] = {
			members: [...a.members, ...b.members].sort((p, q) => p - q),
			u: (a.u * a.members.length + b.u * b.members.length) / size,
			v: (a.v * a.members.length + b.v * b.members.length) / size,
		};
		clusters = clusters.filter((_, index) => index !== bestJ);
	}
	return clusters.map((cluster) => cluster.members);
}

function median(values: number[]): number {
	if (!values.length) return 0;
	const sorted = [...values].sort((a, b) => a - b);
	return sorted[Math.floor(sorted.length / 2)];
}

/** Subject labels one post can lend a group: its category and its tags. */
function subjects(source: LayoutSource): string[] {
	const out = new Set<string>();
	const category = source.category?.trim().toLowerCase();
	if (category) out.add(CATEGORY_LABEL[category] ?? sentenceCase(category));
	for (const tag of source.tags) {
		const key = tag.trim().toLowerCase();
		if (!key) continue;
		const label = key in TAG_LABEL ? TAG_LABEL[key] : sentenceCase(tag.trim());
		if (label) out.add(label);
	}
	return [...out];
}

function sentenceCase(text: string): string {
	const spaced = text.replace(/-/g, ' ');
	return spaced.charAt(0).toUpperCase() + spaced.slice(1).toLowerCase();
}

/**
 * Name groups from what their posts share. A label scores by how much of the
 * group carries it (squared, so a label on every post wins) times how much of
 * that label lives in the group, and it must be on at least half of the group.
 * Two groups that earn the same name merge when they touch. Otherwise the
 * weaker one takes its next label. A named group then keeps only the stars
 * that carry its name, so a figure never claims a post its name is not true of.
 */
function nameGroups(groups: number[][], points: readonly Point[], sources: readonly LayoutSource[], gap: number): Array<{ name: string; members: number[] }> {
	const labelsOf = sources.map(subjects);
	const totals = new Map<string, number>();
	for (const labels of labelsOf) for (const label of labels) totals.set(label, (totals.get(label) ?? 0) + 1);
	const ranked = groups.map((members) => {
		const counts = new Map<string, number>();
		for (const m of members) for (const label of labelsOf[m]) counts.set(label, (counts.get(label) ?? 0) + 1);
		const choices = [...counts.entries()]
			.filter(([, count]) => count * 2 >= members.length)
			.map(([label, count]) => ({ label, score: (count / members.length) ** 2 * (count / (totals.get(label) as number)) }))
			.sort((a, b) => b.score - a.score || codePointCompare(a.label, b.label));
		return { members, choices };
	});
	const order = ranked.map((_, index) => index).sort((a, b) => (ranked[b].choices[0]?.score ?? 0) - (ranked[a].choices[0]?.score ?? 0) || a - b);
	const named: Array<{ name: string; members: number[] }> = [];
	for (const index of order) {
		const { members, choices } = ranked[index];
		// A group that runs out of labels stays unnamed: its stars are drawn without a figure.
		for (const { label } of choices) {
			const owner = named.find((group) => group.name === label);
			if (!owner) {
				named.push({ name: label, members: [...members] });
				break;
			}
			let closest = Infinity;
			for (const a of members) for (const b of owner.members) closest = Math.min(closest, distance(points[a], points[b]));
			if (closest <= gap) {
				owner.members = [...owner.members, ...members].sort((p, q) => p - q);
				break;
			}
		}
	}
	return named.map((group) => ({ name: group.name, members: group.members.filter((m) => labelsOf[m].includes(group.name)) })).filter((group) => group.members.length >= MIN_FIGURE);
}

/** Minimum spanning tree inside one group, without its overlong lines. */
function figureOf(members: number[], points: readonly Point[]): Array<[number, number]> {
	if (members.length < 2) return [];
	const inTree = new Set([members[0]]);
	const lines: Array<{ a: number; b: number; length: number }> = [];
	while (inTree.size < members.length) {
		let best = { a: -1, b: -1, length: Infinity };
		for (const a of inTree) {
			for (const b of members) {
				if (inTree.has(b)) continue;
				const length = distance(points[a], points[b]);
				if (length < best.length || (length === best.length && (a < best.a || (a === best.a && b < best.b)))) best = { a, b, length };
			}
		}
		inTree.add(best.b);
		lines.push(best);
	}
	const limit = median(lines.map((line) => line.length)) * LONG_LINE;
	return lines
		.filter((line) => line.length <= limit)
		.map((line): [number, number] => (line.a < line.b ? [line.a, line.b] : [line.b, line.a]))
		.sort((p, q) => p[0] - q[0] || p[1] - q[1]);
}

/** The largest set of a group's stars joined by figure lines. A tie goes to the set with the lowest index. */
function mainFigure(members: number[], figure: ReadonlyArray<[number, number]>): number[] {
	const inGroup = new Set(members);
	const joined = new Map<number, number[]>(members.map((m) => [m, []]));
	for (const [a, b] of figure) {
		if (!inGroup.has(a) || !inGroup.has(b)) continue;
		joined.get(a)?.push(b);
		joined.get(b)?.push(a);
	}
	const seen = new Set<number>();
	let best: number[] = [];
	for (const start of members) {
		if (seen.has(start)) continue;
		const part = [start];
		seen.add(start);
		for (let i = 0; i < part.length; i += 1) {
			for (const next of joined.get(part[i]) ?? []) {
				if (seen.has(next)) continue;
				seen.add(next);
				part.push(next);
			}
		}
		if (part.length > best.length) best = part;
	}
	return best;
}

interface Frame {
	/** Pixels across and down of a typical screen for this frame. */
	width: number;
	height: number;
	at: (index: number) => [number, number];
}

/**
 * Where a group's name goes: the clear spot nearest its centre. A spot is clear
 * when the label box covers no star, no figure line and no earlier label, and
 * the star nearest to it belongs to the group.
 */
function placeLabels(groups: Array<{ name: string; members: number[] }>, figure: ReadonlyArray<[number, number]>, frame: Frame, starCount: number): Array<[number, number]> {
	const px = (index: number): [number, number] => {
		const [x, y] = frame.at(index);
		return [(x / GRID) * frame.width, (y / GRID) * frame.height];
	};
	const stars = Array.from({ length: starCount }, (_, index) => px(index));
	// Figure lines as points every few pixels: a label box that holds none of them crosses no line.
	const linePoints: Array<[number, number]> = [];
	for (const [a, b] of figure) {
		const steps = Math.max(1, Math.ceil(Math.hypot(stars[b][0] - stars[a][0], stars[b][1] - stars[a][1]) / 4));
		for (let i = 1; i < steps; i += 1) linePoints.push([stars[a][0] + ((stars[b][0] - stars[a][0]) * i) / steps, stars[a][1] + ((stars[b][1] - stars[a][1]) * i) / steps]);
	}
	const owner = new Map<number, number>();
	groups.forEach((group, g) => group.members.forEach((m) => owner.set(m, g)));
	const boxes: Array<[number, number, number, number]> = [];
	const anchors: Array<[number, number]> = new Array(groups.length);
	const order = groups.map((_, g) => g).sort((a, b) => groups[b].members.length - groups[a].members.length || a - b);
	for (const g of order) {
		// The name belongs to the main figure of the group, not to a stray pair off to one side.
		const members = mainFigure(groups[g].members, figure);
		const cx = members.reduce((sum, m) => sum + stars[m][0], 0) / members.length;
		const cy = members.reduce((sum, m) => sum + stars[m][1], 0) / members.length;
		const halfW = (groups[g].name.length * 7.6 + 10) / 2;
		const halfH = 8;
		const clear = (x: number, y: number, pad: number, own = true): boolean => {
			if (x - halfW < 0 || x + halfW > frame.width || y - halfH < -14 || y + halfH > frame.height + 14) return false;
			let nearest = -1;
			let nearestDistance = Infinity;
			for (let s = 0; s < stars.length; s += 1) {
				const dx = Math.abs(stars[s][0] - x);
				const dy = Math.abs(stars[s][1] - y);
				if (dx < halfW + pad && dy < halfH + pad) return false;
				// A star outside every figure belongs to no name, so it does not decide whose spot this is.
				const d = Math.hypot(Math.max(0, dx - halfW), Math.max(0, dy - halfH));
				if (owner.has(s) && d < nearestDistance) {
					nearestDistance = d;
					nearest = s;
				}
			}
			if (own && owner.get(nearest) !== g) return false;
			if (linePoints.some(([lx, ly]) => Math.abs(lx - x) < halfW + 3 && Math.abs(ly - y) < halfH + 3)) return false;
			return boxes.every(([bx, by, bw, bh]) => Math.abs(bx - x) >= bw + halfW + 6 || Math.abs(by - y) >= bh + halfH + 4);
		};
		// A name reads best just above its figure, then just below it. Only a crowded group falls back to the nearest clear spot.
		const top = Math.min(...members.map((m) => stars[m][1]));
		const bottom = Math.max(...members.map((m) => stars[m][1]));
		const shifts = [0, -24, 24, -48, 48];
		let spot: [number, number] | null = null;
		for (const y of [top - 20, bottom + 20]) {
			const shift = shifts.find((dx) => clear(cx + dx, y, 7));
			if (shift !== undefined) {
				spot = [cx + shift, y];
				break;
			}
		}
		// A small group hemmed in by larger ones has no spot of its own: its name then takes the nearest spot that covers nothing.
		search: for (const [pad, own] of spot ? [] : ([[9, true], [5, true], [5, false]] as const)) {
			for (let radius = 0; radius <= 220; radius += 6) {
				const turns = radius === 0 ? 1 : 24;
				for (let t = 0; t < turns; t += 1) {
					// Start straight up, then alternate sides, so a tie prefers the spot above the group.
					const side = t % 2 === 0 ? 1 : -1;
					const angle = -Math.PI / 2 + side * Math.ceil(t / 2) * ((2 * Math.PI) / 24);
					const x = cx + Math.cos(angle) * radius;
					const y = cy + Math.sin(angle) * radius;
					if (clear(x, y, pad, own)) {
						spot = [x, y];
						break search;
					}
				}
			}
		}
		const [x, y] = spot ?? [Math.min(Math.max(cx, halfW), frame.width - halfW), cy];
		boxes.push([x, y, halfW, halfH]);
		anchors[g] = [Math.round((x / frame.width) * GRID), Math.round((y / frame.height) * GRID)];
	}
	return anchors;
}

/**
 * The room a title takes at 12px Inter 600, from the width of each kind of
 * letter, rounded up. The map squeezes a title into this width, so an
 * estimate that runs short only narrows the letters.
 */
export function titleWidth(text: string): number {
	let em = 0;
	for (const letter of text) em += /[iljI.,:;'|! ]/.test(letter) ? 0.32 : /[ftr()[\]"/-]/.test(letter) ? 0.42 : /[mwMW@]/.test(letter) ? 0.98 : /[A-Z0-9#&]/.test(letter) ? 0.72 : /[a-z]/.test(letter) ? 0.62 : 0.85;
	return Math.ceil(em * 12);
}

type Box = [number, number, number, number];

/**
 * The scale from which a point stays out of a box for good. The point sits at
 * (dx, dy) from the star at scale 1 and moves straight away from it as the map
 * grows. The box is fixed to the star. Each axis is judged alone, so the answer
 * holds when the two axes of a real panel grow by different amounts.
 */
function clearFrom(dx: number, dy: number, [x0, y0, x1, y1]: Box): number {
	const axis = (d: number, low: number, high: number) => (d > 0 ? (high > 0 ? high / d : 0) : d < 0 ? (low < 0 ? low / d : 0) : low < 0 && high > 0 ? Infinity : 0);
	return Math.min(axis(dx, x0, x1), axis(dy, y0, y1));
}

/**
 * Where each title goes and the scale it shows from: the side of its star that
 * comes clear of every other star, every name and every title placed before it
 * at the smallest scale. Longer and newer posts choose first. Nothing is
 * searched in the browser: a title is drawn once the map reaches its scale.
 */
function placeTitles(widths: readonly number[], stars: readonly StarRow[], names: ReadonlyArray<{ at: [number, number]; half: number }>, frame: Frame): number[] {
	const at = stars.map((_, index): [number, number] => {
		const [x, y] = frame.at(index);
		return [(x / GRID) * frame.width, (y / GRID) * frame.height];
	});
	// A star at its largest, so a title is clear of it at every zoom.
	const reach = stars.map((star) => STAR_RADIUS[star[5]] * MAX_ZOOM ** STAR_GROWTH);
	const boxOf = (index: number, side: number): Box => {
		const far = reach[index] + TITLE_GAP + widths[index];
		const tall = reach[index] + TITLE_GAP + 16;
		const half = widths[index] / 2;
		return ([[4, -8, far, 8], [-far, -8, -4, 8], [-half, 4, half, tall], [-half, -tall, half, -4]] as Box[])[side];
	};
	const grow = ([x0, y0, x1, y1]: Box, x: number, y: number): Box => [x0 - x, y0 - y, x1 + x, y1 + y];
	const order = stars.map((_, index) => index).sort((a, b) => stars[b][5] - stars[a][5] || stars[b][6] - stars[a][6] || a - b);
	const placed: Array<{ index: number; box: Box; scale: number }> = [];
	const codes = new Array<number>(stars.length).fill(0);
	for (const index of order) {
		let best = { side: 0, scale: Infinity };
		for (let side = 0; side < 4; side += 1) {
			const box = boxOf(index, side);
			let scale = TITLE_FLOOR;
			for (let other = 0; other < stars.length && scale < best.scale; other += 1) {
				if (other !== index) scale = Math.max(scale, clearFrom(at[other][0] - at[index][0], at[other][1] - at[index][1], grow(box, reach[other] + 2, reach[other] + 2)));
			}
			for (const name of names) scale = Math.max(scale, clearFrom(name.at[0] - at[index][0], name.at[1] - at[index][1], grow(box, name.half + 4, 12)));
			for (const before of placed) {
				// The two titles overlap while the other star is inside this box, grown by the other title's box.
				const [x0, y0, x1, y1] = before.box;
				const clear = clearFrom(at[before.index][0] - at[index][0], at[before.index][1] - at[index][1], [box[0] - x1 - 6, box[1] - y1 - 5, box[2] - x0 + 6, box[3] - y0 + 5]);
				// Clear by the time the earlier title shows: no limit. Otherwise this one waits.
				if (clear > before.scale) scale = Math.max(scale, clear);
			}
			scale = Math.ceil(scale * 10) / 10;
			if (scale < best.scale) best = { side, scale };
		}
		if (best.scale > TITLE_CEILING) continue;
		placed.push({ index, box: boxOf(index, best.side), scale: best.scale });
		codes[index] = Math.round(best.scale * 10) * 4 + best.side;
	}
	return codes;
}

export function layoutConstellation(projection: ProjectionInput, sources: readonly LayoutSource[]): ConstellationData {
	const bySlug = new Map(sources.map((source) => [source.slug, source]));
	const posts = projection.posts.map((post) => {
		const source = bySlug.get(post.slug);
		if (!source) throw new Error(`projection has a post the sources do not: ${post.slug}`);
		return source;
	});
	const n = posts.length;
	const points = turn(projection.posts);
	const minU = Math.min(...points.map((p) => p.u));
	const maxU = Math.max(...points.map((p) => p.u));
	const minV = Math.min(...points.map((p) => p.v));
	const maxV = Math.max(...points.map((p) => p.v));
	const spanU = maxU - minU || 1;
	const spanV = maxV - minV || 1;
	const grid = points.map((p): [number, number] => [Math.round(((p.u - minU) / spanU) * GRID), Math.round(((p.v - minV) / spanV) * GRID)]);

	const present = new Set(posts.map((post) => post.category?.trim().toLowerCase() || 'other'));
	const categories = [...CATEGORY_ORDER.filter((id) => present.has(id)), ...[...present].filter((id) => !CATEGORY_ORDER.includes(id)).sort(codePointCompare)];
	const categoryOf = posts.map((post) => categories.indexOf(post.category?.trim().toLowerCase() || 'other'));

	const nearestGap = median(points.map((p, i) => Math.min(...points.map((q, j) => (i === j ? Infinity : distance(p, q))))));
	const k = Math.max(1, Math.min(MAX_GROUPS, n, Math.round(n / POSTS_PER_GROUP)));
	const named = n ? nameGroups(ward(points, k), points, posts, nearestGap * MERGE_GAP) : [];
	// Largest group first, so group numbers are stable against small edits.
	named.sort((a, b) => b.members.length - a.members.length || codePointCompare(a.name, b.name));
	const groupOf = new Array<number>(n).fill(-1);
	named.forEach((group, g) => group.members.forEach((m) => (groupOf[m] = g)));

	const newest = posts.reduce((latest, post) => (post.date > latest ? post.date : latest), '');
	const newestTime = Date.parse(newest.slice(0, 10)) || 0;
	const stars = posts.map((post, i): StarRow => {
		const years = (newestTime - (Date.parse(post.date.slice(0, 10)) || 0)) / (365.25 * 24 * 3600 * 1000);
		return [post.slug, grid[i][0], grid[i][1], categoryOf[i], groupOf[i], step(wordCount(post.body), SIZE_WORDS), GLOW_YEARS.length - step(years, GLOW_YEARS)];
	});

	const figure = named.flatMap((group) => figureOf(group.members, points)).sort((p, q) => p[0] - q[0] || p[1] - q[1]);

	const similar: Array<Array<[number, number]>> = points.map(() => []);
	for (const [a, b, weight] of projection.edges) {
		similar[a].push([b, weight]);
		similar[b].push([a, weight]);
	}
	const near = similar.map((list, i) => {
		const out = list.sort((p, q) => q[1] - p[1] || p[0] - q[0]).map(([index]) => index);
		// A post with fewer than two similar posts still offers the stars beside it.
		if (out.length < 2) {
			const beside = points
				.map((p, j) => ({ j, d: j === i || out.includes(j) ? Infinity : distance(points[i], p) }))
				.sort((p, q) => p.d - q.d || p.j - q.j);
			for (const { j, d } of beside) {
				if (out.length >= 2 || d === Infinity) break;
				out.push(j);
			}
		}
		return out;
	});

	const aspect = Math.round((spanU / spanV) * 1000) / 1000;
	const wide = placeLabels(named, figure, { width: LABEL_FIELD.wide[0], height: LABEL_FIELD.wide[1], at: (i) => grid[i] }, n);
	const tall = placeLabels(named, figure, { width: LABEL_FIELD.tall[0], height: LABEL_FIELD.tall[1], at: (i) => [grid[i][1], grid[i][0]] }, n);
	const groups = named.map((group, g): GroupRow => {
		const cx = group.members.reduce((sum, m) => sum + grid[m][0], 0) / group.members.length;
		const cy = group.members.reduce((sum, m) => sum + grid[m][1], 0) / group.members.length;
		const spread = (axis: 0 | 1, centre: number) => Math.sqrt(group.members.reduce((sum, m) => sum + (grid[m][axis] - centre) ** 2, 0) / group.members.length);
		const counts = new Map<number, number>();
		for (const m of group.members) counts.set(categoryOf[m], (counts.get(categoryOf[m]) ?? 0) + 1);
		const category = [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0] - b[0])[0][0];
		return {
			name: group.name,
			wide: wide[g],
			tall: tall[g],
			glow: [Math.round(cx), Math.round(cy), Math.round(spread(0, cx) * 2 + 30), Math.round(spread(1, cy) * 2 + 30)],
			category,
		};
	});

	const titleWidths = posts.map((post) => titleWidth(shortTitle(post.title ?? post.slug)));
	// A name on the map as a box: its anchor in reference pixels and half its width as drawn on a desktop.
	const nameBoxes = (anchors: Array<[number, number]>, [width, height]: readonly [number, number]) => named.map((group, g) => ({ at: [(anchors[g][0] / GRID) * width, (anchors[g][1] / GRID) * height] as [number, number], half: (group.name.length * 9 + 14) / 2 }));

	return {
		schema: CONSTELLATION_SCHEMA,
		corpus_sha256: projection.corpus_sha256,
		aspect,
		categories,
		labels: categories.map((id) => CATEGORY_LABEL[id] ?? sentenceCase(id)),
		groups,
		stars,
		figure,
		near,
		titles: {
			width: titleWidths,
			wide: placeTitles(titleWidths, stars, nameBoxes(wide, LABEL_FIELD.wide), { width: LABEL_FIELD.wide[0], height: LABEL_FIELD.wide[1], at: (i) => grid[i] }),
			tall: placeTitles(titleWidths, stars, nameBoxes(tall, LABEL_FIELD.tall), { width: LABEL_FIELD.tall[0], height: LABEL_FIELD.tall[1], at: (i) => [grid[i][1], grid[i][0]] }),
		},
	};
}

/**
 * The first paint: the same stars as paths, with no script. Each star is a
 * near zero-length line with a round cap, so a stroke that does not scale with
 * the box draws it as a dot of a fixed pixel size, exactly where the canvas will.
 */
export function silhouetteOf(data: ConstellationData): Silhouette {
	const paths = (tall: boolean): Array<[number, number, string]> => {
		const buckets = new Map<string, string[]>();
		for (const [, x, y, category, , size] of data.stars) {
			const key = `${category}:${size}`;
			const list = buckets.get(key) ?? [];
			list.push(tall ? `M${y} ${x}h.01` : `M${x} ${y}h.01`);
			buckets.set(key, list);
		}
		return [...buckets.entries()]
			.map(([key, list]): [number, number, string] => {
				const [category, size] = key.split(':').map(Number);
				return [category, size, list.join('')];
			})
			.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
	};
	return {
		schema: SILHOUETTE_SCHEMA,
		corpus_sha256: data.corpus_sha256,
		aspect: data.aspect,
		count: data.stars.length,
		categories: data.categories.map((id, index) => ({ id, label: data.labels[index], count: data.stars.filter((star) => star[3] === index).length })),
		wide: paths(false),
		tall: paths(true),
	};
}

/** One line of JSON with a trailing newline: the file is data for a machine, and its diff is the map moving. */
export function serializeLayout(value: ConstellationData | Silhouette): string {
	return `${JSON.stringify(value)}\n`;
}
