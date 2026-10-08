/**
 * Exact t-SNE for the posts projection (TIN-5680).
 *
 * A dependency-free port of the scikit-learn `TSNE(method="exact",
 * metric="precomputed")` path that spear_resumes `profile/refresh/embed.py`
 * runs: the supplied dissimilarity is squared, per-row Gaussian bandwidths are
 * found by binary search on perplexity, Student-t (one degree of freedom)
 * output kernel, two-phase gradient descent with early exaggeration,
 * momentum and adaptive gains. The random stream is a seeded mulberry32 +
 * Box-Muller, so coordinates are reproducible but NOT bit-compatible with
 * numpy's RandomState. Everything here is plain IEEE-754 double arithmetic in
 * a fixed loop order: the same inputs and seed give byte-identical output on
 * one JavaScript engine.
 */

export const MACHINE_EPSILON = 2.220446049250313e-16;
const PERPLEXITY_TOLERANCE = 1e-5;
const PERPLEXITY_STEPS = 100;
const EXPLORATION_ITERATIONS = 250;
const ITERATION_CHECK = 50;
const NO_PROGRESS_LIMIT = 300;
const MIN_GRADIENT_NORM = 1e-7;
const MIN_GAIN = 0.01;

export interface TsneOptions {
	perplexity: number;
	seed: number;
	maxIterations: number;
	earlyExaggeration: number;
	/** `auto` follows scikit-learn: max(n / early_exaggeration / 4, 50). */
	learningRate: number | 'auto';
	/** Row-major n x 2 starting coordinates; omitted means seeded random (1e-4 N(0,1)). */
	init?: Float64Array;
}

export interface TsneResult {
	/** Row-major n x 2 coordinates. */
	embedding: Float64Array;
	klDivergence: number;
	/** scikit-learn `n_iter_ + 1`, the number of optimizer steps taken. */
	iterations: number;
	learningRate: number;
}

/** mulberry32: a small, well-mixed 32-bit generator with an exact integer state. */
export function seededUniform(seed: number): () => number {
	let state = seed >>> 0;
	return () => {
		state = (state + 0x6d2b79f5) >>> 0;
		let t = state;
		t = Math.imul(t ^ (t >>> 15), t | 1);
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

/** Standard normal draws by Box-Muller over the seeded uniform stream. */
export function seededNormal(seed: number): () => number {
	const uniform = seededUniform(seed);
	let spare: number | null = null;
	return () => {
		if (spare !== null) {
			const value = spare;
			spare = null;
			return value;
		}
		let u = 0;
		while (u <= Number.MIN_VALUE) u = uniform();
		const v = uniform();
		const radius = Math.sqrt(-2 * Math.log(u));
		spare = radius * Math.sin(2 * Math.PI * v);
		return radius * Math.cos(2 * Math.PI * v);
	};
}

/**
 * Conditional probabilities P(j|i) from squared distances, one bandwidth per
 * row (scikit-learn `_binary_search_perplexity`). Returns row-major n x n.
 */
export function conditionalProbabilities(squared: Float64Array, n: number, perplexity: number): Float64Array {
	const desiredEntropy = Math.log(perplexity);
	const conditional = new Float64Array(n * n);
	for (let i = 0; i < n; i += 1) {
		let beta = 1;
		let betaMin = -Infinity;
		let betaMax = Infinity;
		for (let step = 0; step < PERPLEXITY_STEPS; step += 1) {
			let sumP = 0;
			for (let j = 0; j < n; j += 1) {
				const value = j === i ? 0 : Math.exp(-squared[i * n + j] * beta);
				conditional[i * n + j] = value;
				sumP += value;
			}
			if (sumP === 0) sumP = 1e-8;
			let sumDistP = 0;
			for (let j = 0; j < n; j += 1) {
				conditional[i * n + j] /= sumP;
				sumDistP += squared[i * n + j] * conditional[i * n + j];
			}
			const entropy = Math.log(sumP) + beta * sumDistP;
			const difference = entropy - desiredEntropy;
			if (Math.abs(difference) <= PERPLEXITY_TOLERANCE) break;
			if (difference > 0) {
				betaMin = beta;
				beta = betaMax === Infinity ? beta * 2 : (beta + betaMax) / 2;
			} else {
				betaMax = beta;
				beta = betaMin === -Infinity ? beta / 2 : (beta + betaMin) / 2;
			}
		}
	}
	return conditional;
}

/** Symmetric joint P over the condensed upper triangle (scikit-learn `_joint_probabilities`). */
export function jointProbabilities(distance: Float64Array, n: number, perplexity: number): Float64Array {
	const squared = new Float64Array(n * n);
	for (let k = 0; k < n * n; k += 1) squared[k] = distance[k] * distance[k];
	const conditional = conditionalProbabilities(squared, n, perplexity);
	let total = 0;
	for (let i = 0; i < n; i += 1) {
		for (let j = 0; j < n; j += 1) total += conditional[i * n + j] + conditional[j * n + i];
	}
	total = Math.max(total, MACHINE_EPSILON);
	const condensed = new Float64Array((n * (n - 1)) / 2);
	let k = 0;
	for (let i = 0; i < n; i += 1) {
		for (let j = i + 1; j < n; j += 1) {
			condensed[k] = Math.max((conditional[i * n + j] + conditional[j * n + i]) / total, MACHINE_EPSILON);
			k += 1;
		}
	}
	return condensed;
}

/** KL(P||Q) and its gradient for a 2-D Student-t embedding (scikit-learn `_kl_divergence`). */
export function klDivergence(
	joint: Float64Array,
	embedding: Float64Array,
	n: number,
	gradient: Float64Array,
	computeError: boolean,
): number {
	const m = joint.length;
	const kernel = new Float64Array(m);
	let kernelSum = 0;
	let k = 0;
	for (let i = 0; i < n; i += 1) {
		for (let j = i + 1; j < n; j += 1) {
			const dx = embedding[2 * i] - embedding[2 * j];
			const dy = embedding[2 * i + 1] - embedding[2 * j + 1];
			const value = 1 / (1 + (dx * dx + dy * dy));
			kernel[k] = value;
			kernelSum += value;
			k += 1;
		}
	}
	const normalizer = 2 * kernelSum;
	let error = Number.NaN;
	if (computeError) {
		error = 0;
		for (let index = 0; index < m; index += 1) {
			const q = Math.max(kernel[index] / normalizer, MACHINE_EPSILON);
			error += joint[index] * Math.log(Math.max(joint[index], MACHINE_EPSILON) / q);
		}
		error *= 2;
	}
	gradient.fill(0);
	k = 0;
	for (let i = 0; i < n; i += 1) {
		for (let j = i + 1; j < n; j += 1) {
			const q = Math.max(kernel[k] / normalizer, MACHINE_EPSILON);
			const pq = (joint[k] - q) * kernel[k];
			const dx = embedding[2 * i] - embedding[2 * j];
			const dy = embedding[2 * i + 1] - embedding[2 * j + 1];
			gradient[2 * i] += pq * dx;
			gradient[2 * i + 1] += pq * dy;
			gradient[2 * j] -= pq * dx;
			gradient[2 * j + 1] -= pq * dy;
			k += 1;
		}
	}
	// 2 * (degrees_of_freedom + 1) / degrees_of_freedom with one degree of freedom.
	for (let index = 0; index < gradient.length; index += 1) gradient[index] *= 4;
	return error;
}

interface DescentPhase {
	start: number;
	maxIterations: number;
	momentum: number;
	learningRate: number;
	noProgressLimit: number;
}

function gradientDescent(
	joint: Float64Array,
	params: Float64Array,
	n: number,
	phase: DescentPhase,
): { error: number; last: number } {
	const update = new Float64Array(params.length);
	const gains = new Float64Array(params.length).fill(1);
	const gradient = new Float64Array(params.length);
	let error = Number.MAX_VALUE;
	let bestError = Number.MAX_VALUE;
	let bestIteration = phase.start;
	let i = phase.start;
	for (; i < phase.maxIterations; i += 1) {
		const check = (i + 1) % ITERATION_CHECK === 0;
		const computed = klDivergence(joint, params, n, gradient, check || i === phase.maxIterations - 1);
		if (!Number.isNaN(computed)) error = computed;
		let gradientNorm = 0;
		for (let index = 0; index < params.length; index += 1) {
			const g = gradient[index];
			if (update[index] * g < 0) gains[index] += 0.2;
			else gains[index] *= 0.8;
			if (gains[index] < MIN_GAIN) gains[index] = MIN_GAIN;
			const scaled = g * gains[index];
			gradientNorm += scaled * scaled;
			update[index] = phase.momentum * update[index] - phase.learningRate * scaled;
			params[index] += update[index];
		}
		if (check) {
			if (error < bestError) {
				bestError = error;
				bestIteration = i;
			} else if (i - bestIteration > phase.noProgressLimit) {
				break;
			}
			if (Math.sqrt(gradientNorm) <= MIN_GRADIENT_NORM) break;
		}
	}
	return { error, last: Math.min(i, phase.maxIterations - 1) };
}

/**
 * Fit a 2-D exact t-SNE on a row-major n x n dissimilarity matrix.
 * Mirrors scikit-learn's two phases: EXPLORATION_ITERATIONS steps with early
 * exaggeration and momentum 0.5, then the remainder at momentum 0.8.
 */
export function exactTsne(distance: Float64Array, n: number, options: TsneOptions): TsneResult {
	if (n < 2) throw new Error('t-SNE needs at least two points');
	if (distance.length !== n * n) throw new Error('distance must be n x n');
	for (const value of distance) {
		if (!Number.isFinite(value) || value < 0) throw new Error('distances must be finite and nonnegative');
	}
	const learningRate =
		options.learningRate === 'auto' ? Math.max(n / options.earlyExaggeration / 4, 50) : options.learningRate;
	const joint = jointProbabilities(distance, n, options.perplexity);
	let params: Float64Array;
	if (options.init) {
		if (options.init.length !== 2 * n) throw new Error('init must be n x 2');
		params = Float64Array.from(options.init);
	} else {
		const normal = seededNormal(options.seed);
		params = new Float64Array(2 * n);
		for (let index = 0; index < params.length; index += 1) params[index] = 1e-4 * normal();
	}
	for (let index = 0; index < joint.length; index += 1) joint[index] *= options.earlyExaggeration;
	const exploration = gradientDescent(joint, params, n, {
		start: 0,
		maxIterations: Math.min(EXPLORATION_ITERATIONS, options.maxIterations),
		momentum: 0.5,
		learningRate,
		noProgressLimit: EXPLORATION_ITERATIONS,
	});
	for (let index = 0; index < joint.length; index += 1) joint[index] /= options.earlyExaggeration;
	let error = exploration.error;
	let last = exploration.last;
	if (options.maxIterations > EXPLORATION_ITERATIONS) {
		const refinement = gradientDescent(joint, params, n, {
			start: last + 1,
			maxIterations: options.maxIterations,
			momentum: 0.8,
			learningRate,
			noProgressLimit: NO_PROGRESS_LIMIT,
		});
		error = refinement.error;
		last = refinement.last;
	}
	for (const value of params) if (!Number.isFinite(value)) throw new Error('t-SNE produced non-finite coordinates');
	if (!Number.isFinite(error)) throw new Error('t-SNE produced a non-finite divergence');
	return { embedding: params, klDivergence: error, iterations: last + 1, learningRate };
}
