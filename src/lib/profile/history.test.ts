import { existsSync, readFileSync } from 'node:fs';
import { render } from 'svelte/server';
import { describe, expect, it } from 'vitest';
import ProfileHistory from './ProfileHistory.svelte';
import {
	activityDescription,
	daysInMonth,
	languageCell,
	languageDescription,
	languageHistory,
	languageValue,
	monthLabel,
	upstreamHistory,
	weeklyActivity,
	weeklyMonthTicks,
} from './history';
import { parseProfileV1, type ProfileActivity, type ProfileLanguageMonths, type ProfileMergedUpstream } from './schema';

const activity = (from: string, days: ProfileActivity['days']): ProfileActivity => ({
	from,
	to: days.at(-1)!.date,
	days,
	unit: 'public active days',
});
const day = (date: string, commit: boolean | null, pr: boolean | null = false) => ({
	date,
	commit,
	pr,
	review: false,
	issue: false,
});

describe('observed language history', () => {
	const row: ProfileLanguageMonths = {
		language: 'Python',
		months: [
			{ ym: '2024-01', active_days: null, coverage: 'unavailable' },
			{ ym: '2024-02', active_days: 0, coverage: 'complete' },
			{ ym: '2024-03', active_days: 2, coverage: 'partial' },
		],
	};
	it('preserves observed zero separately from missing and partial observations', () => {
		expect(languageCell(row, '2024-01').active).toBeNull();
		expect(languageValue(languageCell(row, '2024-02'))).toBe('0');
		expect(languageValue(languageCell(row, '2024-03'))).toBe('2+');
		expect(languageDescription(languageCell(row, '2024-01'))).toContain('not an observed zero');
		expect(languageDescription(languageCell(row, '2024-03'))).toContain('lower bound');
		expect(languageCell(row, '2023-12').coverage).toBe('unavailable');
	});
	it('uses the real calendar denominator, including leap years and century exceptions', () => {
		expect(daysInMonth('2024-02')).toBe(29);
		expect(daysInMonth('2023-02')).toBe(28);
		expect(daysInMonth('2000-02')).toBe(29);
		expect(daysInMonth('2100-02')).toBe(28);
		expect(daysInMonth('2024-04')).toBe(30);
		expect(daysInMonth('2024-12')).toBe(31);
		expect(monthLabel('2024-02')).toBe('Feb 2024');
	});
	it('retains the whole supplied history and defaults to the latest observed month', () => {
		const rows = [
			{ ...row, months: [...row.months, { ym: '2024-04', active_days: null, coverage: 'unavailable' as const }] },
		];
		const result = languageHistory(rows);
		expect(result.months).toEqual(['2024-01', '2024-02', '2024-03', '2024-04']);
		expect(result.defaultMonth).toBe('2024-03');
		expect(result.coverage.map((month) => month.coverage)).toEqual([
			'unavailable',
			'complete',
			'partial',
			'unavailable',
		]);
	});
	it('does not report complete monthly coverage if a language is unknown', () => {
		const result = languageHistory([
			row,
			{ language: 'Rust', months: [{ ym: '2024-02', active_days: null, coverage: 'unavailable' }] },
		]);
		expect(result.coverage.find((month) => month.ym === '2024-02')?.coverage).toBe('partial');
		expect(languageHistory([]).defaultMonth).toBe('');
	});
});

describe('UTC weekly activity', () => {
	it('does not turn all unknown days into zero, and keeps observed false as zero', () => {
		const [week] = weeklyActivity(activity('2024-03-04', [day('2024-03-04', null), day('2024-03-05', null)]));
		expect(week.kinds.commit).toEqual({ active: null, observed: 0, unknown: 2, coverage: 'unavailable' });
		expect(week.kinds.pr).toEqual({ active: 0, observed: 2, unknown: 0, coverage: 'partial' });
		expect(activityDescription(week, 'commit')).toContain('observations unavailable');
	});
	it('distinguishes the snapshot boundary from missing days inside the window', () => {
		const result = weeklyActivity(
			activity('2024-03-09', [day('2024-03-09', true), day('2024-03-10', null), day('2024-03-11', false)]),
		);
		expect(result.map(({ start, from, to, days, outsideDays }) => ({ start, from, to, days, outsideDays }))).toEqual([
			{ start: '2024-03-04', from: '2024-03-09', to: '2024-03-10', days: 2, outsideDays: 5 },
			{ start: '2024-03-11', from: '2024-03-11', to: '2024-03-11', days: 1, outsideDays: 6 },
		]);
		expect(result[0].kinds.commit).toEqual({ active: 1, observed: 1, unknown: 1, coverage: 'partial' });
		expect(activityDescription(result[0], 'commit')).toContain('5 days outside the snapshot window');
	});
	it('counts UTC calendar days across daylight-saving and leap-day boundaries', () => {
		const start = Date.parse('2024-03-04T00:00:00Z');
		const days = Array.from({ length: 7 }, (_, i) =>
			day(new Date(start + i * 86_400_000).toISOString().slice(0, 10), true),
		);
		const [week] = weeklyActivity(activity('2024-03-04', days));
		expect(week.kinds.commit).toEqual({ active: 7, observed: 7, unknown: 0, coverage: 'complete' });
		const [leapWeek] = weeklyActivity(
			activity('2024-02-28', [day('2024-02-28', true), day('2024-02-29', false), day('2024-03-01', true)]),
		);
		expect(leapWeek.days).toBe(3);
		expect(leapWeek.kinds.commit.active).toBe(2);
	});
	it('keeps overlapping activity types separate', () => {
		const [week] = weeklyActivity(activity('2024-03-04', [day('2024-03-04', true, true)]));
		expect(week.kinds.commit.active).toBe(1);
		expect(week.kinds.pr.active).toBe(1);
		expect(week.days).toBe(1);
	});
	it('omits crowded boundary-month labels while keeping remaining ticks at their real dates', () => {
		const start = Date.parse('2025-09-29T00:00:00Z');
		const days = Array.from({ length: 42 }, (_, i) =>
			day(new Date(start + i * 86_400_000).toISOString().slice(0, 10), false),
		);
		const weeks = weeklyActivity(activity('2025-09-29', days));
		expect(weeklyMonthTicks(weeks, 26)).toEqual([{ column: 1, label: 'Oct' }]);
		expect(weeklyMonthTicks(weeks, 44)).toEqual([
			{ column: 0, label: 'Sep' },
			{ column: 1, label: 'Oct' },
			{ column: 5, label: 'Nov' },
		]);
	});
});

describe('upstream recency and citations', () => {
	const merged = (
		repo: string,
		number: number,
		date: string,
		relation: ProfileMergedUpstream['relation'] = 'contributor',
	): ProfileMergedUpstream => ({
		repo,
		number,
		merged: date,
		project: repo.split('/')[1],
		relation,
	});
	it('retains only the latest verified merge per repository and its exact source URL', () => {
		const result = upstreamHistory([
			merged('Org/Project', 10, '2024-01-01'),
			merged('org/project', 12, '2024-04-01', 'committer'),
			merged('Other/Library', 2, '2023-12-31'),
		]);
		expect(result.points.map((point) => point.url)).toEqual([
			'https://github.com/Other/Library/pull/2',
			'https://github.com/org/project/pull/12',
		]);
		expect(result.points[1].relation).toBe('committer');
	});
	it('positions by elapsed calendar time rather than ordinal project spacing', () => {
		const result = upstreamHistory([
			merged('a/one', 1, '2024-01-01'),
			merged('b/two', 2, '2024-01-02'),
			merged('c/three', 3, '2024-07-01'),
		]);
		expect(result.points.map((point) => point.position)).toEqual([0, 1 / 366, 182 / 366]);
		expect(result.years).toEqual([{ year: 2024, position: 0 }]);
		expect(upstreamHistory([])).toEqual({ points: [], years: [] });
	});
});

const fixture =
	process.env.PROFILE_CONTRACT_FIXTURE ?? new URL('../../../static/profile/profile.v1.json', import.meta.url);
it.skipIf(!existsSync(fixture))(
	'server-renders three native charts and complete evidence tables from the real validated projection',
	() => {
		const profile = parseProfileV1(JSON.parse(readFileSync(fixture, 'utf8')));
		const { html } = render(ProfileHistory, { props: { profile } });
		for (const id of ['language-history', 'upstream', 'activity']) expect(html).toContain(`id="${id}"`);
		for (const row of upstreamHistory(profile.merged_upstream).points) expect(html).toContain(`href="${row.url}"`);
		for (const month of languageHistory(profile.language_months).months) expect(html).toContain(monthLabel(month));
		expect(html.match(/<svg\b/g)).toHaveLength(3);
		expect(html.match(/<table\b/g)).toHaveLength(3);
		expect(html).toContain('Current repository language shares do not supply this history');
		expect(html).toContain('aria-live="polite"');
		expect(html).not.toMatch(/NaN|Infinity|undefined/);
	},
);
