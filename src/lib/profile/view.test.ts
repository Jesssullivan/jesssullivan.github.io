import { existsSync, readdirSync, readFileSync } from 'node:fs';
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
const v2Dir = new URL('../../../static/profile/v2/', import.meta.url);
const provenance = JSON.parse(readFileSync(new URL('provenance.json', v2Dir), 'utf8')) as {
	source_commit: string;
	files: Record<string, string>;
};
const data = parseProfileV1(raw);
const view = toProfileView(data);

describe('held charts (R111)', () => {
	it('drops language history from the rendered view', () => {
		expect('language_months' in view).toBe(false);
		expect(view.coverage_details.every((d) => d.scope === 'activity')).toBe(true);
	});

	it('never copies a held chart, held/ or the manifest into the blog', () => {
		// The copy is profile.v1.json plus the released svg/ charts, nothing
		// else: no held/ tree (R111) and no manifest.json (it lists held paths).
		const svgs = readdirSync(new URL('svg/', v2Dir)).sort();
		expect(readdirSync(v2Dir).sort()).toEqual(['profile.v1.json', 'provenance.json', 'svg']);
		expect(existsSync(new URL('held', v2Dir))).toBe(false);
		expect(existsSync(new URL('manifest.json', v2Dir))).toBe(false);
		expect(svgs.filter((f) => /heatmap|language/i.test(f))).toEqual([]);
		// provenance.json lists exactly what is on disk.
		expect(Object.keys(provenance.files).sort()).toEqual(['profile.v1.json', ...svgs.map((f) => `svg/${f}`)].sort());
		expect(provenance.source_commit).toMatch(/^[0-9a-f]{40}$/);
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
		expect(rows.flatMap((r) => r.ids).sort()).toEqual(view.repos.map((r) => r.id).sort());
		const order = view.categories.map((c) => c.id);
		const seen = rows.map((r) => order.indexOf(r.category));
		expect([...seen].sort((a, b) => a - b)).toEqual(seen);
	});

	it('gives each Zig library its own label and row (R138)', () => {
		const rows = projectRows(view);
		expect(new Set(rows.map((r) => `${r.category}/${r.label}`)).size).toBe(rows.length);
		const zig = view.repos.filter((r) => /\bin Zig\b/.test(r.label));
		expect(zig.length).toBe(4);
		for (const repo of zig) expect(rows.filter((r) => r.label === repo.label)).toHaveLength(1);
	});

	it('collapses repositories that share a label into one row with every link (safety net)', () => {
		const rows = projectRows({
			categories: [{ id: 'sys', label: 'Systems' }] as never,
			repos: [
				{ id: 'b', label: 'Shared label', link: 'https://example.org/b', category: 'sys', langs: { Zig: 0.9, C: 0.1 } },
				{
					id: 'a',
					label: 'Shared label',
					link: 'https://example.org/a',
					category: 'sys',
					langs: { Zig: 0.5, Shell: 0.5 },
				},
				{ id: 'c', label: 'Shared label', link: null, category: 'sys', langs: { Zig: 1 } },
				{ id: 'd', label: 'Other', link: 'https://example.org/d', category: 'sys', langs: {} },
			] as never,
		});
		expect(rows.map((r) => r.label)).toEqual(['Other', 'Shared label']);
		const shared = rows[1];
		expect(shared.ids).toEqual(['a', 'b', 'c']);
		expect(shared.links).toEqual([
			{ id: 'a', href: 'https://example.org/a' },
			{ id: 'b', href: 'https://example.org/b' },
		]);
		expect(shared.languages[0]).toBe('Zig');
	});

	it('keeps a single repository as a single-link row', () => {
		const rows = projectRows({
			categories: [{ id: 'a', label: 'A' }] as never,
			repos: [
				{ id: 'x', label: 'One', link: 'https://example.org/x', category: 'a', langs: { Go: 1 } },
				{ id: 'y', label: 'Two', link: null, category: 'a', langs: {} },
			] as never,
		});
		expect(rows.map((r) => [r.label, r.links.length])).toEqual([
			['One', 1],
			['Two', 0],
		]);
	});
});
