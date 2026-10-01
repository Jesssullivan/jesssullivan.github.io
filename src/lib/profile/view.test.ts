import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseProfileV1 } from './schema';
import {
	activityCoverage,
	activityWeeks,
	dayState,
	mergeGaps,
	projectRows,
	toProfileView,
	upstreamRows,
	upstreamYearTicks,
} from './view';

const raw = JSON.parse(readFileSync(new URL('../../../static/profile/v2/profile.v1.json', import.meta.url), 'utf8'));
const manifest = JSON.parse(readFileSync(new URL('../../../static/profile/v2/manifest.json', import.meta.url), 'utf8'));
const data = parseProfileV1(raw);
const view = toProfileView(data);

describe('held charts (R111)', () => {
	it('drops language history from the rendered view', () => {
		expect('language_months' in view).toBe(false);
		expect(view.coverage_details.every((d) => d.scope === 'activity')).toBe(true);
	});

	it('never copies a held chart into the blog', () => {
		const held = Object.entries(manifest.charts as Record<string, { held: boolean; files: string[] }>).filter(
			([, c]) => c.held,
		);
		expect(held.map(([name]) => name)).toContain('language-heatmap');
		for (const [, chart] of held) {
			for (const file of chart.files) {
				const name = file.split('/').pop()!;
				expect(() => readFileSync(new URL(`../../../static/profile/v2/svg/${name}`, import.meta.url))).toThrow();
			}
		}
	});
});

describe('activity semantics', () => {
	const gaps = [{ from: '2026-04-01', to: '2026-05-31', reason: 'cap' }];
	it('treats null as unknown, and a supplied false inside a declared gap as unknown', () => {
		expect(dayState(null, '2026-01-01', gaps)).toBe('unknown');
		expect(dayState(false, '2026-04-10', gaps)).toBe('unknown');
		expect(dayState(true, '2026-04-10', gaps)).toBe('active');
		expect(dayState(false, '2026-06-01', gaps)).toBe('inactive');
	});

	it('merges contiguous gaps with one reason and keeps the rest apart', () => {
		expect(mergeGaps([])).toEqual([]);
		expect(
			mergeGaps([
				{ from: '2026-05-01', to: '2026-05-31', reason: 'cap' },
				{ from: '2026-04-01', to: '2026-04-30', reason: 'cap' },
				{ from: '2026-07-01', to: '2026-07-02', reason: 'cap' },
				{ from: '2026-07-03', to: '2026-07-04', reason: 'other' },
			]),
		).toEqual([
			{ from: '2026-04-01', to: '2026-05-31', reason: 'cap' },
			{ from: '2026-07-01', to: '2026-07-02', reason: 'cap' },
			{ from: '2026-07-03', to: '2026-07-04', reason: 'other' },
		]);
	});

	it('counts unknown days separately and never as zero activity', () => {
		const weeks = activityWeeks(view);
		expect(weeks[0].start).toBe(view.activity.from);
		const totalDays = weeks.reduce((s, w) => s + w.cells.commit.days, 0);
		expect(totalDays).toBe(view.activity.days.length);
		const aprilWeek = weeks.find((w) => w.start <= '2026-04-15' && w.end >= '2026-04-15')!;
		for (const cell of Object.values(aprilWeek.cells)) {
			expect(cell.unknown + cell.active).toBe(cell.days);
		}
		const cov = activityCoverage(view);
		expect(cov.total).toBe(view.activity.days.length);
		expect(cov.unknown).toBeGreaterThan(0);
	});
});

describe('upstream ribbon', () => {
	it('keeps the latest merge per project on one linear axis', () => {
		const rows = upstreamRows(view.merged_upstream);
		expect(new Set(rows.map((r) => r.project)).size).toBe(rows.length);
		expect(rows[0].t).toBe(0);
		expect(rows[rows.length - 1].t).toBe(1);
		for (let i = 1; i < rows.length; i++) expect(rows[i].merged >= rows[i - 1].merged).toBe(true);
		for (const r of rows) {
			expect(r.url).toMatch(/^https:\/\/github\.com\/[^/]+\/[^/]+\/pull\/\d+$/);
			expect(['committer', 'contributor', '']).toContain(r.relation);
		}
		const ticks = upstreamYearTicks(rows);
		expect(ticks.every((t) => t.t > 0 && t.t < 1)).toBe(true);
	});

	it('never shows the engagement relation word', () => {
		const rows = upstreamRows([
			{ project: 'A', repo: 'a/a', number: 1, merged: '2024-01-01', relation: 'engagement' },
			{ project: 'B', repo: 'b/b', number: 2, merged: '2025-01-01', relation: 'committer' },
		]);
		expect(rows.map((r) => r.relation)).toEqual(['', 'committer']);
	});
});

describe('project table', () => {
	it('lists every repository once, grouped in category order', () => {
		const rows = projectRows(view);
		expect(rows).toHaveLength(view.repos.length);
		const order = view.categories.map((c) => c.id);
		const seen = rows.map((r) => order.indexOf(r.category));
		expect([...seen].sort((a, b) => a - b)).toEqual(seen);
	});
});
