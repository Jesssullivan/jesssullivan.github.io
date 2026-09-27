import {
	upstreamUrl,
	type ActivityKind,
	type ProfileActivity,
	type ProfileLanguageMonths,
	type ProfileMergedUpstream,
} from './schema';

export const activityKinds: { key: ActivityKind; label: string }[] = [
	{ key: 'commit', label: 'Commits' },
	{ key: 'pr', label: 'Pull requests' },
	{ key: 'review', label: 'Reviews' },
	{ key: 'issue', label: 'Issues' },
];
export type HistoryCoverage = 'complete' | 'partial' | 'unavailable';
const DAY = 86_400_000;
const utc = (date: string) => Date.parse(`${date}T00:00:00Z`);
const iso = (time: number) => new Date(time).toISOString().slice(0, 10);
const monthFormatter = new Intl.DateTimeFormat('en-US', { month: 'short', year: 'numeric', timeZone: 'UTC' });

export function monthLabel(ym: string): string {
	return monthFormatter.format(new Date(utc(`${ym}-01`)));
}

export function daysInMonth(ym: string): number {
	const first = new Date(utc(`${ym}-01`));
	first.setUTCMonth(first.getUTCMonth() + 1, 0);
	return first.getUTCDate();
}

export interface LanguageCell {
	language: string;
	ym: string;
	active: number | null;
	calendarDays: number;
	coverage: HistoryCoverage;
}

export function languageCell(row: ProfileLanguageMonths, ym: string): LanguageCell {
	const entry = row.months.find((month) => month.ym === ym);
	return {
		language: row.language,
		ym,
		active: entry?.active_days ?? null,
		calendarDays: daysInMonth(ym),
		coverage: entry?.coverage ?? 'unavailable',
	};
}

export function languageValue(cell: LanguageCell): string {
	return cell.active === null ? 'Unavailable' : `${cell.active}${cell.coverage === 'partial' ? '+' : ''}`;
}

export function languageDescription(cell: LanguageCell): string {
	const heading = `${cell.language}, ${monthLabel(cell.ym)}`;
	if (cell.active === null) return `${heading}: observations unavailable. This is not an observed zero.`;
	return `${heading}: ${cell.active} observed active ${cell.active === 1 ? 'day' : 'days'}; ${cell.coverage} coverage${cell.coverage === 'partial' ? ', a lower bound' : ''}. ${cell.calendarDays} calendar days in the month.`;
}

export function languageHistory(rows: ProfileLanguageMonths[]) {
	const languages = [...rows].sort((a, b) => a.language.localeCompare(b.language, 'en'));
	const months = [...new Set(rows.flatMap((row) => row.months.map((month) => month.ym)))].sort();
	const coverage = months.map((ym) => {
		const cells = languages.map((row) => languageCell(row, ym));
		const state: HistoryCoverage = cells.every((cell) => cell.coverage === 'complete')
			? 'complete'
			: cells.some((cell) => cell.active !== null)
				? 'partial'
				: 'unavailable';
		return { ym, coverage: state };
	});
	const observed = coverage.filter((month) => month.coverage !== 'unavailable');
	return { languages, months, coverage, defaultMonth: observed.at(-1)?.ym ?? months.at(-1) ?? '' };
}

export interface UpstreamPoint extends ProfileMergedUpstream {
	url: string;
	position: number;
}

/** A project is the source repository. Dates encode recency, never contribution depth. */
export function upstreamHistory(rows: ProfileMergedUpstream[]) {
	const latest = new Map<string, ProfileMergedUpstream>();
	for (const row of rows) {
		const key = row.repo.toLowerCase();
		const previous = latest.get(key);
		if (!previous || row.merged > previous.merged || (row.merged === previous.merged && row.number > previous.number))
			latest.set(key, row);
	}
	const projects = [...latest.values()].sort(
		(a, b) => a.merged.localeCompare(b.merged) || a.repo.localeCompare(b.repo),
	);
	if (!projects.length) return { points: [] as UpstreamPoint[], years: [] as { year: number; position: number }[] };
	const firstYear = Number(projects[0].merged.slice(0, 4));
	const lastYear = Number(projects.at(-1)!.merged.slice(0, 4));
	const start = utc(`${firstYear}-01-01`);
	const end = utc(`${lastYear + 1}-01-01`);
	const position = (date: string) => (utc(date) - start) / (end - start);
	return {
		points: projects.map((row) => ({ ...row, url: upstreamUrl(row), position: position(row.merged) })),
		years: Array.from({ length: lastYear - firstYear + 1 }, (_, i) => ({
			year: firstYear + i,
			position: position(`${firstYear + i}-01-01`),
		})),
	};
}

export interface ActivityObservation {
	active: number | null;
	observed: number;
	unknown: number;
	coverage: HistoryCoverage;
}

export interface ActivityWeek {
	start: string;
	from: string;
	to: string;
	days: number;
	outsideDays: number;
	kinds: Record<ActivityKind, ActivityObservation>;
}

/** Omit crowded month labels without moving a tick away from its actual week. */
export function weeklyMonthTicks(weeks: ActivityWeek[], columnWidth: number) {
	const candidates = weeks.flatMap((week, column) =>
		column === 0 || week.start.slice(0, 7) !== weeks[column - 1].start.slice(0, 7)
			? [{ column, label: monthLabel(week.start.slice(0, 7)).slice(0, 3) }]
			: [],
	);
	if (candidates.length > 1 && (candidates[1].column - candidates[0].column) * columnWidth < 42) candidates.shift();
	let previous = -Infinity;
	return candidates.filter((tick) => {
		const x = tick.column * columnWidth;
		if (x < previous + 42 || x + 30 > weeks.length * columnWidth) return false;
		previous = x;
		return true;
	});
}

/** Count boolean days, not events. Boundary days outside the window are not unknowns. */
export function weeklyActivity(activity: ProfileActivity): ActivityWeek[] {
	const days = new Map(activity.days.map((day) => [day.date, day]));
	const buckets = new Map<string, ActivityWeek>();
	for (let time = utc(activity.from); time <= utc(activity.to); time += DAY) {
		const date = iso(time);
		const monday = iso(time - ((new Date(time).getUTCDay() + 6) % 7) * DAY);
		let week = buckets.get(monday);
		if (!week) {
			week = {
				start: monday,
				from: date,
				to: date,
				days: 0,
				outsideDays: 7,
				kinds: Object.fromEntries(
					activityKinds.map(({ key }) => [
						key,
						{
							active: null,
							observed: 0,
							unknown: 0,
							coverage: 'unavailable',
						},
					]),
				) as ActivityWeek['kinds'],
			};
			buckets.set(monday, week);
		}
		week.days++;
		week.outsideDays--;
		week.to = date;
		for (const { key } of activityKinds) {
			const value = days.get(date)?.[key];
			const item = week.kinds[key];
			if (value === null || value === undefined) item.unknown++;
			else {
				item.observed++;
				item.active = (item.active ?? 0) + Number(value);
			}
		}
	}
	for (const week of buckets.values())
		for (const { key } of activityKinds) {
			const item = week.kinds[key];
			item.coverage = item.observed === 0 ? 'unavailable' : item.unknown || week.outsideDays ? 'partial' : 'complete';
		}
	return [...buckets.values()];
}

export function activityDescription(week: ActivityWeek, kind: ActivityKind): string {
	const item = week.kinds[kind];
	const label = activityKinds.find(({ key }) => key === kind)!.label;
	const value =
		item.active === null
			? 'observations unavailable'
			: `${item.active} public active days among ${item.observed} observed days`;
	return `${label}, UTC week beginning ${week.start}: ${value}; ${item.unknown} unknown days within ${week.from} to ${week.to}${week.outsideDays ? `; ${week.outsideDays} days outside the snapshot window` : ''}.`;
}
