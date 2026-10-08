/**
 * Build-time similarity projection of public posts (TIN-5680, child of TIN-2413).
 *
 * Node-only producer core (uses node:crypto); the browser imports only the
 * committed JSON and `scene.ts`. A method port of spear_resumes
 * `profile/refresh/embed.py` (main 1b8b27863f90, `tfidf-jaccard-exact-tsne-2`):
 *
 * - one similarity drives both the fit and the edges: 0.6 TF-IDF cosine
 *   (sublinear TF, smoothed IDF, L2) plus 0.4 Jaccard over lower-case tags
 *   and category;
 * - title, description and tag tokens carry weight 3; body text contributes
 *   its top 120 terms with code, markup and URLs removed;
 * - dates, display order, featured state and taxonomy colour never enter the fit;
 * - exact t-SNE on 1 - similarity, fixed seed, warm start from the previous
 *   committed coordinates (low learning rate, 0.1% jitter) followed by a
 *   similarity Procrustes alignment, so adding a post does not reshuffle the map.
 *
 * Axes, distances and apparent density are not measurements.
 */
import { createHash } from 'node:crypto';
import { bodyTerms, codePointCompare, tokens } from './text';
import { exactTsne, seededNormal } from './tsne';

export const SCHEMA = 'posts-projection.v1';
export const METHOD_REVISION = 'tfidf-jaccard-exact-tsne-2/ts-port-1';
export const SEED = 20261006;
export const DESC_WEIGHT = 3;
export const TEXT_WEIGHT = 0.6;
export const TAG_WEIGHT = 0.4;
export const EDGE_K = 3;
export const EDGE_THRESHOLD = 0.15;
export const PERPLEXITY = 15;
export const COLD_ITERATIONS = 1000;
export const WARM_ITERATIONS = 500;
export const WARM_LEARNING_RATE = 10;
export const COLD_EARLY_EXAGGERATION = 12;
export const WARM_EARLY_EXAGGERATION = 1;
export const WARM_JITTER_FRACTION = 0.001;
export const PADDING = 0.04;
const POINT_DIGITS = 5;
const EPSILON = 2.220446049250313e-16;

export const HONESTY_NOTE =
	'Positions come from a t-SNE fit over post text and tags. Nearby posts share wording or tags; axes, distances and density are not measurements.';

/** One public post as the producer reads it; only these fields can reach the fit. */
export interface PostSource {
	slug: string;
	title: string;
	description: string;
	tags: string[];
	category?: string;
	body: string;
}

export interface CorpusRow {
	id: string;
	terms: Record<string, number>;
	tags: string[];
}

export interface ProjectedPost {
	slug: string;
	x: number;
	y: number;
}

/** [index a, index b, input similarity] into `posts`, a < b. */
export type ProjectionEdge = [number, number, number];

export interface PostsProjection {
	schema: typeof SCHEMA;
	method: string;
	configuration_sha256: string;
	corpus_sha256: string;
	note: string;
	embedding: {
		algorithm: 'tsne' | 'degenerate';
		metric: '1 - similarity';
		solver: 'exact';
		seed: number;
		perplexity: number;
		iterations: number;
		initialization: 'seeded-random' | 'previous-projection' | 'coincident-no-relative-evidence';
		learning_rate: number;
		early_exaggeration: number;
		kl_divergence: number | null;
	};
	/** raw = (point - 0.5) / scale + mid: the warm-start frame for the next fit. */
	frame: { mid: [number, number]; scale: number };
	alignment: { applied: boolean; common: number; scale: number; reflection: boolean };
	metrics: {
		quality_neighbors: number;
		neighbor_overlap: number | null;
		common_points: number;
		display_displacement_mean: number | null;
		display_displacement_max: number | null;
	};
	posts: ProjectedPost[];
	edges: ProjectionEdge[];
}

export function round(value: number, digits: number): number {
	const rounded = Number(value.toFixed(digits));
	return Object.is(rounded, -0) ? 0 : rounded;
}

/** JSON with recursively sorted object keys (Python `sort_keys=True`, compact separators). */
export function canonicalJson(value: unknown): string {
	if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
	if (value && typeof value === 'object') {
		const entries = Object.keys(value as Record<string, unknown>)
			.sort(codePointCompare)
			.map((key) => `${JSON.stringify(key)}:${canonicalJson((value as Record<string, unknown>)[key])}`);
		return `{${entries.join(',')}}`;
	}
	if (typeof value === 'number' && !Number.isFinite(value)) throw new Error('non-finite number in canonical JSON');
	return JSON.stringify(value);
}

export function sha256(text: string): string {
	return createHash('sha256').update(text).digest('hex');
}

export function configurationSha256(): string {
	return sha256(
		canonicalJson({
			revision: METHOD_REVISION,
			seed: SEED,
			description_weight: DESC_WEIGHT,
			text_weight: TEXT_WEIGHT,
			tag_weight: TAG_WEIGHT,
			edge_k: EDGE_K,
			edge_threshold: EDGE_THRESHOLD,
			perplexity: PERPLEXITY,
			cold_iterations: COLD_ITERATIONS,
			warm_iterations: WARM_ITERATIONS,
			warm_learning_rate: WARM_LEARNING_RATE,
			cold_learning_rate: 'auto',
			cold_early_exaggeration: COLD_EARLY_EXAGGERATION,
			warm_early_exaggeration: WARM_EARLY_EXAGGERATION,
			warm_jitter_fraction_of_centered_rms_radius: WARM_JITTER_FRACTION,
			normalization_padding: PADDING,
			point_digits: POINT_DIGITS,
		}),
	);
}

/** Only mathematical inputs, normalized and ordered by slug. */
export function canonicalCorpus(posts: readonly PostSource[]): CorpusRow[] {
	const seen = new Set<string>();
	const rows: CorpusRow[] = [];
	for (const post of posts) {
		const id = post.slug;
		if (typeof id !== 'string' || !id || id !== id.trim()) throw new Error('every post needs a trimmed slug');
		if (seen.has(id)) throw new Error(`duplicate post slug: ${id}`);
		seen.add(id);
		const tagList = [...new Set(post.tags.map((tag) => tag.trim().toLowerCase()).filter(Boolean))].sort(
			codePointCompare,
		);
		const tags = new Set(tagList);
		const category = post.category?.trim().toLowerCase();
		if (category) tags.add(category);
		const terms = new Map<string, number>(Object.entries(bodyTerms(post.body)));
		for (const part of [post.title, post.description, ...tagList.map((tag) => tag.replace(/-/g, ' '))]) {
			for (const term of tokens(part ?? '')) terms.set(term, (terms.get(term) ?? 0) + DESC_WEIGHT);
		}
		rows.push({
			id,
			terms: Object.fromEntries([...terms.entries()].sort((a, b) => codePointCompare(a[0], b[0]))),
			tags: [...tags].sort(codePointCompare),
		});
	}
	return rows.sort((a, b) => codePointCompare(a.id, b.id));
}

export function corpusSha256(rows: readonly CorpusRow[]): string {
	return sha256(canonicalJson(rows));
}

/** Row-major similarity S and distance D = 1 - S, diagonal 1 and 0. */
export function similarities(rows: readonly CorpusRow[]): { similarity: Float64Array; distance: Float64Array } {
	const n = rows.length;
	const documentFrequency = new Map<string, number>();
	for (const row of rows) {
		for (const [term, count] of Object.entries(row.terms)) {
			if (count > 0) documentFrequency.set(term, (documentFrequency.get(term) ?? 0) + 1);
		}
	}
	const vectors = rows.map((row) => {
		const vector = new Map<string, number>();
		let norm = 0;
		for (const term of Object.keys(row.terms).sort(codePointCompare)) {
			const count = row.terms[term];
			if (!(count > 0)) continue;
			const idf = Math.log((1 + n) / (1 + (documentFrequency.get(term) ?? 0))) + 1;
			const value = (1 + Math.log(count)) * idf;
			vector.set(term, value);
			norm += value * value;
		}
		norm = Math.sqrt(norm);
		if (norm > 0) for (const [term, value] of vector) vector.set(term, value / norm);
		return vector;
	});
	const tagSets = rows.map((row) => new Set(row.tags));
	const similarity = new Float64Array(n * n);
	const distance = new Float64Array(n * n);
	for (let i = 0; i < n; i += 1) {
		similarity[i * n + i] = 1;
		for (let j = i + 1; j < n; j += 1) {
			const [small, large] = vectors[i].size <= vectors[j].size ? [vectors[i], vectors[j]] : [vectors[j], vectors[i]];
			let cosine = 0;
			// Maps were filled in code-point term order, so this sum order is fixed.
			for (const [term, value] of small) {
				const other = large.get(term);
				if (other !== undefined) cosine += value * other;
			}
			cosine = Math.min(Math.max(cosine, 0), 1);
			let shared = 0;
			for (const tag of tagSets[i]) if (tagSets[j].has(tag)) shared += 1;
			const union = tagSets[i].size + tagSets[j].size - shared;
			const jaccard = union ? shared / union : 0;
			const value = Math.min(Math.max(TEXT_WEIGHT * cosine + TAG_WEIGHT * jaccard, 0), 1);
			similarity[i * n + j] = similarity[j * n + i] = value;
		}
	}
	for (let k = 0; k < n * n; k += 1) distance[k] = Math.min(Math.max(1 - similarity[k], 0), 1);
	for (let i = 0; i < n; i += 1) distance[i * n + i] = 0;
	return { similarity, distance };
}

/** Undirected union of each post's top-k neighbours at or above the threshold; ties by slug. */
export function similarityEdges(ids: readonly string[], similarity: Float64Array): ProjectionEdge[] {
	const n = ids.length;
	const edges = new Map<string, ProjectionEdge>();
	for (let i = 0; i < n; i += 1) {
		const neighbours = [...Array(n).keys()]
			.filter((j) => j !== i)
			.sort((a, b) => similarity[i * n + b] - similarity[i * n + a] || codePointCompare(ids[a], ids[b]))
			.slice(0, EDGE_K);
		for (const j of neighbours) {
			const weight = similarity[i * n + j];
			if (weight < EDGE_THRESHOLD) continue;
			const [a, b] = i < j ? [i, j] : [j, i];
			edges.set(`${a}:${b}`, [a, b, round(weight, 4)]);
		}
	}
	return [...edges.values()].sort((x, y) => x[0] - y[0] || x[1] - y[1]);
}

type Points = Map<string, [number, number]>;

/** Uniform scale and translation only: preserve aspect, centre, pad. */
export function normalize(raw: Points): { points: Points; frame: PostsProjection['frame'] } {
	const ids = [...raw.keys()].sort(codePointCompare);
	if (!ids.length) return { points: new Map(), frame: { mid: [0, 0], scale: 1 } };
	let loX = Infinity;
	let loY = Infinity;
	let hiX = -Infinity;
	let hiY = -Infinity;
	for (const id of ids) {
		const [x, y] = raw.get(id) as [number, number];
		loX = Math.min(loX, x);
		hiX = Math.max(hiX, x);
		loY = Math.min(loY, y);
		hiY = Math.max(hiY, y);
	}
	const span = Math.max(hiX - loX, hiY - loY);
	const mid: [number, number] = [(loX + hiX) / 2, (loY + hiY) / 2];
	const points: Points = new Map();
	if (span <= EPSILON) {
		for (const id of ids) points.set(id, [0.5, 0.5]);
		return { points, frame: { mid: [round(mid[0], 9), round(mid[1], 9)], scale: 1 } };
	}
	const scale = (1 - 2 * PADDING) / span;
	for (const id of ids) {
		const [x, y] = raw.get(id) as [number, number];
		points.set(id, [round((x - mid[0]) * scale + 0.5, POINT_DIGITS), round((y - mid[1]) * scale + 0.5, POINT_DIGITS)]);
	}
	return { points, frame: { mid: [round(mid[0], 9), round(mid[1], 9)], scale: round(scale, 12) } };
}

/** Recover approximate raw coordinates from a committed projection. */
export function rawFromProjection(projection: PostsProjection): Points {
	const raw: Points = new Map();
	const { mid, scale } = projection.frame;
	for (const post of projection.posts) {
		raw.set(post.slug, [(post.x - 0.5) / scale + mid[0], (post.y - 0.5) / scale + mid[1]]);
	}
	return raw;
}

/**
 * Least-squares similarity Procrustes onto the previous frame using common slugs.
 * Reflection is allowed: embedding axis orientation has no meaning.
 */
export function alignToPrevious(raw: Points, previous: Points): { aligned: Points; info: PostsProjection['alignment'] } {
	const common = [...raw.keys()].filter((id) => previous.has(id)).sort(codePointCompare);
	const info = { applied: false, common: common.length, scale: 1, reflection: false };
	if (common.length < 2) return { aligned: new Map(raw), info };
	let xcx = 0;
	let xcy = 0;
	let ycx = 0;
	let ycy = 0;
	for (const id of common) {
		const [ax, ay] = raw.get(id) as [number, number];
		const [bx, by] = previous.get(id) as [number, number];
		xcx += ax;
		xcy += ay;
		ycx += bx;
		ycy += by;
	}
	xcx /= common.length;
	xcy /= common.length;
	ycx /= common.length;
	ycy /= common.length;
	let m00 = 0;
	let m01 = 0;
	let m10 = 0;
	let m11 = 0;
	let xx = 0;
	let yy = 0;
	for (const id of common) {
		const [ax, ay] = raw.get(id) as [number, number];
		const [bx, by] = previous.get(id) as [number, number];
		const x0 = ax - xcx;
		const x1 = ay - xcy;
		const y0 = bx - ycx;
		const y1 = by - ycy;
		m00 += x0 * y0;
		m01 += x0 * y1;
		m10 += x1 * y0;
		m11 += x1 * y1;
		xx += x0 * x0 + x1 * x1;
		yy += y0 * y0 + y1 * y1;
	}
	if (xx <= EPSILON || yy <= EPSILON) return { aligned: new Map(raw), info };
	// Row-vector convention: aligned = (x - xc) R s + yc, maximize tr(R^T M).
	const rotationA = m00 + m11;
	const rotationB = m01 - m10;
	const reflectionA = m00 - m11;
	const reflectionB = m01 + m10;
	const rotationScore = Math.hypot(rotationA, rotationB);
	const reflectionScore = Math.hypot(reflectionA, reflectionB);
	const reflection = reflectionScore > rotationScore;
	const score = reflection ? reflectionScore : rotationScore;
	if (score <= EPSILON) return { aligned: new Map(raw), info };
	const c = (reflection ? reflectionA : rotationA) / score;
	const s = (reflection ? reflectionB : rotationB) / score;
	// Rotation [[c, s], [-s, c]]; reflection [[c, s], [s, -c]].
	const r00 = c;
	const r01 = s;
	const r10 = reflection ? s : -s;
	const r11 = reflection ? -c : c;
	const scale = score / xx;
	const aligned: Points = new Map();
	for (const id of [...raw.keys()].sort(codePointCompare)) {
		const [ax, ay] = raw.get(id) as [number, number];
		const x0 = ax - xcx;
		const x1 = ay - xcy;
		aligned.set(id, [(x0 * r00 + x1 * r10) * scale + ycx, (x0 * r01 + x1 * r11) * scale + ycy]);
	}
	return { aligned, info: { applied: true, common: common.length, scale: round(scale, 9), reflection } };
}

function warmStart(ids: readonly string[], similarity: Float64Array, previous: Points): Float64Array | null {
	const n = ids.length;
	const known = ids.map((id, i) => (previous.has(id) ? i : -1)).filter((i) => i >= 0);
	if (known.length < 3) return null;
	let cx = 0;
	let cy = 0;
	for (const i of known) {
		const [x, y] = previous.get(ids[i]) as [number, number];
		cx += x;
		cy += y;
	}
	cx /= known.length;
	cy /= known.length;
	let spread = 0;
	for (const i of known) {
		const [x, y] = previous.get(ids[i]) as [number, number];
		spread += (x - cx) ** 2 + (y - cy) ** 2;
	}
	spread = Math.sqrt(spread / known.length);
	if (spread <= EPSILON) return null;
	const normal = seededNormal(SEED);
	const initial = new Float64Array(2 * n);
	for (let i = 0; i < n; i += 1) {
		const prior = previous.get(ids[i]);
		if (prior) {
			initial[2 * i] = prior[0];
			initial[2 * i + 1] = prior[1];
			continue;
		}
		const neighbours = [...known]
			.sort((a, b) => similarity[i * n + b] - similarity[i * n + a] || codePointCompare(ids[a], ids[b]))
			.slice(0, EDGE_K);
		let weightSum = 0;
		let ox = 0;
		let oy = 0;
		for (const j of neighbours) {
			const weight = similarity[i * n + j];
			const [x, y] = previous.get(ids[j]) as [number, number];
			weightSum += weight;
			ox += weight * x;
			oy += weight * y;
		}
		const origin = weightSum > 0 ? [ox / weightSum, oy / weightSum] : [cx, cy];
		initial[2 * i] = origin[0] + normal() * spread * WARM_JITTER_FRACTION;
		initial[2 * i + 1] = origin[1] + normal() * spread * WARM_JITTER_FRACTION;
	}
	return initial;
}

function nearest(n: number, ids: readonly string[], metric: (i: number, j: number) => number, k: number): Set<number>[] {
	return [...Array(n).keys()].map(
		(i) =>
			new Set(
				[...Array(n).keys()]
					.filter((j) => j !== i)
					.sort((a, b) => metric(i, a) - metric(i, b) || codePointCompare(ids[a], ids[b]))
					.slice(0, k),
			),
	);
}

export function isCompatible(previous: unknown): previous is PostsProjection {
	if (!previous || typeof previous !== 'object') return false;
	const candidate = previous as Partial<PostsProjection>;
	if (candidate.schema !== SCHEMA || candidate.method !== METHOD_REVISION) return false;
	if (candidate.configuration_sha256 !== configurationSha256()) return false;
	const frame = candidate.frame;
	if (!frame || !Array.isArray(frame.mid) || !Number.isFinite(frame.scale) || !(frame.scale > 0)) return false;
	return (
		Array.isArray(candidate.posts) &&
		candidate.posts.every(
			(post) => typeof post?.slug === 'string' && Number.isFinite(post.x) && Number.isFinite(post.y),
		)
	);
}

export interface EmbedOptions {
	/** Ignore the previous projection and fit from the seeded random start. */
	cold?: boolean;
}

/**
 * Fit (or reuse) the projection. An unchanged corpus with a compatible previous
 * projection returns the previous document unchanged.
 */
export function embedPosts(
	posts: readonly PostSource[],
	previous: unknown = null,
	options: EmbedOptions = {},
): PostsProjection {
	const rows = canonicalCorpus(posts);
	const ids = rows.map((row) => row.id);
	const digest = corpusSha256(rows);
	const compatible = !options.cold && isCompatible(previous) ? previous : null;
	if (compatible && compatible.corpus_sha256 === digest) return structuredClone(compatible);
	const { similarity, distance } = similarities(rows);
	const edges = similarityEdges(ids, similarity);
	const n = ids.length;
	let informative = false;
	if (n > 2) {
		let lo = Infinity;
		let hi = -Infinity;
		for (let i = 0; i < n; i += 1) {
			for (let j = i + 1; j < n; j += 1) {
				lo = Math.min(lo, distance[i * n + j]);
				hi = Math.max(hi, distance[i * n + j]);
			}
		}
		informative = hi - lo > 1e-12;
	}
	const perplexity = n > 1 ? Math.min(PERPLEXITY, Math.max(1, (n - 1) / 3)) : 0;
	const previousRaw = compatible ? rawFromProjection(compatible) : null;
	const warm = previousRaw && informative ? warmStart(ids, similarity, previousRaw) : null;
	let raw: Points = new Map();
	let embedding: PostsProjection['embedding'];
	if (n <= 1 || !informative) {
		for (const id of ids) raw.set(id, [0, 0]);
		embedding = {
			algorithm: 'degenerate',
			metric: '1 - similarity',
			solver: 'exact',
			seed: SEED,
			perplexity,
			iterations: 0,
			initialization: 'coincident-no-relative-evidence',
			learning_rate: 0,
			early_exaggeration: 0,
			kl_divergence: null,
		};
	} else {
		const exaggeration = warm ? WARM_EARLY_EXAGGERATION : COLD_EARLY_EXAGGERATION;
		const fit = exactTsne(distance, n, {
			perplexity,
			seed: SEED,
			maxIterations: warm ? WARM_ITERATIONS : COLD_ITERATIONS,
			earlyExaggeration: exaggeration,
			learningRate: warm ? WARM_LEARNING_RATE : 'auto',
			init: warm ?? undefined,
		});
		ids.forEach((id, i) => raw.set(id, [fit.embedding[2 * i], fit.embedding[2 * i + 1]]));
		embedding = {
			algorithm: 'tsne',
			metric: '1 - similarity',
			solver: 'exact',
			seed: SEED,
			perplexity: round(perplexity, 9),
			iterations: fit.iterations,
			initialization: warm ? 'previous-projection' : 'seeded-random',
			learning_rate: round(fit.learningRate, 9),
			early_exaggeration: exaggeration,
			kl_divergence: round(fit.klDivergence, 9),
		};
	}
	let alignment: PostsProjection['alignment'] = { applied: false, common: 0, scale: 1, reflection: false };
	if (previousRaw && informative) ({ aligned: raw, info: alignment } = alignToPrevious(raw, previousRaw));
	const { points, frame } = normalize(raw);
	const k = n ? Math.min(EDGE_K, Math.floor((n - 1) / 2)) : 0;
	let neighbourOverlap: number | null = null;
	if (informative && k) {
		const shown = ids.map((id) => points.get(id) as [number, number]);
		const source = nearest(n, ids, (i, j) => distance[i * n + j], k);
		const display = nearest(n, ids, (i, j) => Math.hypot(shown[i][0] - shown[j][0], shown[i][1] - shown[j][1]), k);
		let total = 0;
		for (let i = 0; i < n; i += 1) {
			let shared = 0;
			for (const j of source[i]) if (display[i].has(j)) shared += 1;
			total += shared / k;
		}
		neighbourOverlap = round(total / n, 6);
	}
	let displacementMean: number | null = null;
	let displacementMax: number | null = null;
	let commonPoints = 0;
	if (compatible) {
		const prior = new Map(compatible.posts.map((post) => [post.slug, [post.x, post.y] as const]));
		const shifts = ids
			.filter((id) => prior.has(id))
			.map((id) => {
				const [x, y] = points.get(id) as [number, number];
				const [px, py] = prior.get(id) as readonly [number, number];
				return Math.hypot(x - px, y - py);
			});
		commonPoints = shifts.length;
		if (shifts.length) {
			displacementMean = round(shifts.reduce((sum, value) => sum + value, 0) / shifts.length, 6);
			displacementMax = round(Math.max(...shifts), 6);
		}
	}
	return {
		schema: SCHEMA,
		method: METHOD_REVISION,
		configuration_sha256: configurationSha256(),
		corpus_sha256: digest,
		note: HONESTY_NOTE,
		embedding,
		frame,
		alignment,
		metrics: {
			quality_neighbors: k,
			neighbor_overlap: neighbourOverlap,
			common_points: commonPoints,
			display_displacement_mean: displacementMean,
			display_displacement_max: displacementMax,
		},
		posts: ids.map((slug) => {
			const [x, y] = points.get(slug) as [number, number];
			return { slug, x, y };
		}),
		edges,
	};
}

/** Stable serialization: tab-indented JSON with a trailing newline. */
export function serializeProjection(projection: PostsProjection): string {
	return `${JSON.stringify(projection, null, '\t')}\n`;
}
