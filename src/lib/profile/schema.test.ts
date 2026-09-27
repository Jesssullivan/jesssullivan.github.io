import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseProfileV1, PROFILE_METRIC, PROFILE_DISTANCE, type ProfileV1 } from './schema';

function sample(): ProfileV1 {
	return {
		schema: 'profile.v1',
		generated_at: '2024-03-01T12:00:00Z',
		fetched_at: '2024-03-01T11:00:00Z',
		data_changed_at: '2024-03-01T11:00:00Z',
		source_commit: 'a'.repeat(40),
		corpus_sha256: 'b'.repeat(64),
		repos: [
			{
				id: 'r-1111111111111111',
				label: 'Public research',
				category: 'systems',
				category_inferred: false,
				link: 'https://github.com/Jesssullivan/example',
				archived: false,
				x: 0.5,
				y: 0.5,
				langs: { Python: 1 },
				updated: '2024-02-29',
			},
		],
		edges: [],
		categories: [{ id: 'systems', label: 'Systems' }],
		merged_upstream: [],
		language_months: [{ language: 'Python', months: [{ ym: '2024-02', active_days: 1, coverage: 'partial' }] }],
		activity: {
			from: '2024-02-28',
			to: '2024-02-29',
			days: [
				{ date: '2024-02-28', commit: false, pr: false, review: false, issue: false },
				{ date: '2024-02-29', commit: true, pr: null, review: null, issue: null },
			],
			unit: 'public active days',
		},
		coverage: { activity: 'partial', languages: 'partial', repos: 'complete', upstream: 'complete' },
		methods: {
			embedding: {
				algorithm: 'degenerate',
				metric: PROFILE_DISTANCE,
				dimensions: 2,
				seed: 20260926,
				perplexity: 0,
				iterations: 0,
			},
			edges: { algorithm: 'knn', metric: PROFILE_METRIC, k: 3 },
			activity: { unit: 'public active days', attribution: 'Public repository activity only.' },
			languages: { unit: 'public active days', attribution: 'Repository language presence on public active days.' },
		},
		roles: [
			{ org: 'Research', title: 'Engineer', summary: 'Build systems.', bullets: [], start: 2021, end: 'present' },
		],
		links: [{ label: 'Email', url: 'mailto:jess@sulliwood.org' }],
	};
}

describe('public profile contract', () => {
	it('allows start years without confusing them with star counters', () => {
		expect(parseProfileV1(sample()).roles?.[0].start).toBe(2021);
	});
	it('rejects unapproved fields at every depth', () => {
		for (const key of ['phone', 'stars', 'private_id', 'total']) {
			const doc = sample();
			const row =
				key === 'phone'
					? doc
					: key === 'stars'
						? doc.repos[0]
						: key === 'private_id'
							? doc.roles![0]
							: doc.methods.embedding;
			Object.assign(row, { [key]: 123 });
			expect(() => parseProfileV1(doc)).toThrow();
		}
	});
	it('distinguishes missing from inactive observed days', () => {
		const doc = sample();
		doc.coverage.activity = 'complete';
		expect(() => parseProfileV1(doc)).toThrow();
		for (const day of doc.activity.days) Object.assign(day, { commit: false, pr: false, review: false, issue: false });
		expect(() => parseProfileV1(doc)).not.toThrow();
		doc.coverage.activity = 'unavailable';
		expect(() => parseProfileV1(doc)).toThrow();
		for (const day of doc.activity.days) Object.assign(day, { commit: null, pr: null, review: null, issue: null });
		expect(() => parseProfileV1(doc)).not.toThrow();
	});
	it('requires real dates and ordered contiguous days', () => {
		for (const value of ['2023-02-29', '2024-02-30', '2024-13-01', '0000-01-01']) {
			const doc = sample();
			doc.repos[0].updated = value;
			expect(() => parseProfileV1(doc)).toThrow();
		}
		const doc = sample();
		doc.activity.days.reverse();
		expect(() => parseProfileV1(doc)).toThrow();
		doc.activity.days.pop();
		expect(() => parseProfileV1(doc)).toThrow();
	});
	it('rejects nonfinite and out-of-range numeric data', () => {
		for (const value of [NaN, Infinity, -Infinity, true, 1.1]) {
			const doc = sample();
			Object.assign(doc.repos[0], { x: value });
			expect(() => parseProfileV1(doc)).toThrow();
		}
	});
	it('requires normalized shares and safe matching repository links', () => {
		const doc = sample();
		doc.repos[0].langs = { Python: 0.8 };
		expect(() => parseProfileV1(doc)).toThrow();
		for (const link of [
			'javascript:alert(1)',
			'http://github.com/Jesssullivan/example',
			'https://secret@github.com/Jesssullivan/example',
			'https://notgithub.com/another/repo',
		]) {
			const doc = sample();
			doc.repos[0].link = link;
			expect(() => parseProfileV1(doc)).toThrow();
		}
		doc.repos[0].langs = {};
		doc.repos[0].link = null;
		expect(() => parseProfileV1(doc)).not.toThrow();
	});
	it('checks edge references, duplicate undirected edges and categories', () => {
		const doc = sample();
		doc.edges = [{ a: 'r-1111111111111111', b: 'not/known', w: 0.5 }];
		expect(() => parseProfileV1(doc)).toThrow();
		doc.edges[0].b = doc.edges[0].a;
		expect(() => parseProfileV1(doc)).toThrow();
		doc.repos.push({ ...doc.repos[0], id: 'r-2222222222222222', link: null });
		doc.edges = [
			{ a: 'r-1111111111111111', b: 'r-2222222222222222', w: 0.5 },
			{ b: 'r-1111111111111111', a: 'r-2222222222222222', w: 0.5 },
		];
		expect(() => parseProfileV1(doc)).toThrow();
		doc.edges.pop();
		expect(() => parseProfileV1(doc)).not.toThrow();
		doc.repos[0].category = 'unknown';
		expect(() => parseProfileV1(doc)).toThrow();
	});
	it('enforces monthly missingness and real calendar bounds', () => {
		const doc = sample(),
			month = doc.language_months[0].months[0];
		month.active_days = 30;
		expect(() => parseProfileV1(doc)).toThrow();
		month.active_days = null;
		expect(() => parseProfileV1(doc)).toThrow();
		month.coverage = 'unavailable';
		expect(() => parseProfileV1(doc)).not.toThrow();
		doc.coverage.languages = 'complete';
		expect(() => parseProfileV1(doc)).toThrow();
	});
	it('checks t-SNE perplexity and temporal provenance', () => {
		const doc = sample();
		doc.methods.embedding.algorithm = 'tsne';
		expect(() => parseProfileV1(doc)).toThrow();
		doc.methods.embedding.algorithm = 'degenerate';
		doc.generated_at = '2024-03-01T10:00:00Z';
		expect(() => parseProfileV1(doc)).toThrow();
		doc.generated_at = '2024-03-01T24:00:00Z';
		expect(() => parseProfileV1(doc)).toThrow();
	});
});

const integrationFixture =
	process.env.PROFILE_CONTRACT_FIXTURE ?? new URL('../../../static/profile/profile.v1.json', import.meta.url);
it.skipIf(!existsSync(integrationFixture))('accepts the exact producer projection fixture', () => {
	expect(() => parseProfileV1(JSON.parse(readFileSync(integrationFixture, 'utf8')))).not.toThrow();
});
