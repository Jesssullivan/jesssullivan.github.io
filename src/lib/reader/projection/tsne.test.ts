import { describe, expect, it } from 'vitest';
import { conditionalProbabilities, exactTsne, jointProbabilities, seededNormal, seededUniform } from './tsne';

function clusteredDistances(perCluster: number, clusters: number): { distance: Float64Array; n: number; label: number[] } {
	const n = perCluster * clusters;
	const label = Array.from({ length: n }, (_, i) => Math.floor(i / perCluster));
	const uniform = seededUniform(7);
	const distance = new Float64Array(n * n);
	for (let i = 0; i < n; i += 1) {
		for (let j = i + 1; j < n; j += 1) {
			const value = label[i] === label[j] ? 0.1 + 0.1 * uniform() : 0.85 + 0.1 * uniform();
			distance[i * n + j] = distance[j * n + i] = value;
		}
	}
	return { distance, n, label };
}

describe('seeded random streams', () => {
	it('repeat exactly for a seed and differ across seeds', () => {
		const a = seededUniform(42);
		const b = seededUniform(42);
		const c = seededUniform(43);
		const first = Array.from({ length: 5 }, () => a());
		expect(Array.from({ length: 5 }, () => b())).toEqual(first);
		expect(Array.from({ length: 5 }, () => c())).not.toEqual(first);
		for (const value of first) expect(value >= 0 && value < 1).toBe(true);
	});

	it('produce roughly standard normal draws', () => {
		const normal = seededNormal(1);
		const draws = Array.from({ length: 4000 }, () => normal());
		const mean = draws.reduce((sum, v) => sum + v, 0) / draws.length;
		const variance = draws.reduce((sum, v) => sum + (v - mean) ** 2, 0) / draws.length;
		expect(Math.abs(mean)).toBeLessThan(0.06);
		expect(Math.abs(variance - 1)).toBeLessThan(0.08);
	});
});

describe('perplexity calibration', () => {
	it('finds per-row bandwidths whose entropy matches the requested perplexity', () => {
		const { distance, n } = clusteredDistances(8, 3);
		const squared = distance.map((v) => v * v);
		const conditional = conditionalProbabilities(squared, n, 5);
		for (let i = 0; i < n; i += 1) {
			let entropy = 0;
			let total = 0;
			for (let j = 0; j < n; j += 1) {
				const p = conditional[i * n + j];
				total += p;
				if (p > 0) entropy -= p * Math.log(p);
			}
			expect(conditional[i * n + i]).toBe(0);
			expect(total).toBeCloseTo(1, 9);
			expect(Math.exp(entropy)).toBeCloseTo(5, 3);
		}
	});

	it('builds a symmetric joint distribution over the condensed upper triangle', () => {
		const { distance, n } = clusteredDistances(4, 2);
		const joint = jointProbabilities(distance, n, 2);
		expect(joint.length).toBe((n * (n - 1)) / 2);
		const total = joint.reduce((sum, v) => sum + v, 0);
		// Each unordered pair holds (p_ij + p_ji) / sum over both triangles.
		expect(total).toBeCloseTo(0.5, 9);
	});
});

describe('exact t-SNE', () => {
	it('is byte-identical for the same inputs and seed', () => {
		const { distance, n } = clusteredDistances(6, 3);
		const options = { perplexity: 5, seed: 20261006, maxIterations: 400, earlyExaggeration: 12, learningRate: 'auto' as const };
		const first = exactTsne(distance, n, options);
		const second = exactTsne(distance, n, options);
		expect(Array.from(second.embedding)).toEqual(Array.from(first.embedding));
		expect(second.klDivergence).toBe(first.klDivergence);
		expect(first.learningRate).toBe(50);
	});

	it('keeps similar records together and dissimilar records apart', () => {
		const { distance, n, label } = clusteredDistances(8, 3);
		const { embedding, klDivergence, iterations } = exactTsne(distance, n, {
			perplexity: 5,
			seed: 3,
			maxIterations: 1000,
			earlyExaggeration: 12,
			learningRate: 'auto',
		});
		let within = 0;
		let withinCount = 0;
		let between = 0;
		let betweenCount = 0;
		for (let i = 0; i < n; i += 1) {
			for (let j = i + 1; j < n; j += 1) {
				const d = Math.hypot(embedding[2 * i] - embedding[2 * j], embedding[2 * i + 1] - embedding[2 * j + 1]);
				if (label[i] === label[j]) {
					within += d;
					withinCount += 1;
				} else {
					between += d;
					betweenCount += 1;
				}
			}
		}
		expect(between / betweenCount).toBeGreaterThan(3 * (within / withinCount));
		expect(Number.isFinite(klDivergence)).toBe(true);
		expect(iterations).toBeGreaterThan(250);
		expect(iterations).toBeLessThanOrEqual(1000);
	});

	it('rejects malformed input instead of inventing a layout', () => {
		expect(() => exactTsne(new Float64Array(1), 1, { perplexity: 1, seed: 1, maxIterations: 10, earlyExaggeration: 1, learningRate: 10 })).toThrow();
		const bad = new Float64Array(4);
		bad[1] = Number.NaN;
		expect(() => exactTsne(bad, 2, { perplexity: 1, seed: 1, maxIterations: 10, earlyExaggeration: 1, learningRate: 10 })).toThrow();
	});
});
