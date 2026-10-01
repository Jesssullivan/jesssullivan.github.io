// Zod-free on purpose: the map engine chunk imports from here, and only
// load.ts / the server copy validate (schema.ts).
import type { ActivityKind, ProfileMergedUpstream, ProfileRepo, ProfileV1 } from './schema';

export function upstreamUrl(row: Pick<ProfileMergedUpstream, 'repo' | 'number'>): string {
	return `https://github.com/${row.repo}/pull/${row.number}`;
}

/** Largest language shares, names only in the UI (shares are presence, not skill). */
export function topLanguages(repo: Pick<ProfileRepo, 'langs'>, n = 3): { name: string; share: number }[] {
	return Object.entries(repo.langs)
		.map(([name, share]) => ({ name, share }))
		.sort((a, b) => b.share - a.share || a.name.localeCompare(b.name))
		.slice(0, n);
}

/**
 * The slice of profile.v1 the blog renders. language_months is dropped on
 * purpose: the language heatmap is HELD (R111, per Jess 2026-10-01) until the
 * observed history covers an agreed 12-month span, so no consumer here may
 * read it. Only activity-scope coverage details survive (they drive the
 * unknown-day hatching).
 */
export type ProfileView = Omit<ProfileV1, 'language_months' | 'coverage_details'> & {
	coverage_details: NonNullable<ProfileV1['coverage_details']>;
};

export function toProfileView(data: ProfileV1): ProfileView {
	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	const { language_months, coverage_details, ...rest } = data;
	return {
		...rest,
		coverage_details: (coverage_details ?? []).filter((d) => d.scope === 'activity'),
	};
}

// ---------------------------------------------------------------------------
// Project table

export interface ProjectRow {
	id: string;
	label: string;
	link: string | null;
	category: string;
	categoryLabel: string;
	languages: string[];
}

/** Rows grouped in the producer's category order, labels sorted within. */
export function projectRows(view: Pick<ProfileView, 'repos' | 'categories'>): ProjectRow[] {
	const order = new Map(view.categories.map((c, i) => [c.id, i]));
	const labels = new Map(view.categories.map((c) => [c.id, c.label]));
	return [...view.repos]
		.sort((a, b) => (order.get(a.category) ?? 99) - (order.get(b.category) ?? 99) || a.label.localeCompare(b.label))
		.map((r: ProfileRepo) => ({
			id: r.id,
			label: r.label,
			link: r.link,
			category: r.category,
			categoryLabel: labels.get(r.category) ?? r.category,
			languages: topLanguages(r, 3).map((l) => l.name),
		}));
}

// ---------------------------------------------------------------------------
// Upstream ribbon

const SHOWN_RELATIONS = new Set(['committer', 'contributor']);

export interface UpstreamRow {
	project: string;
	repo: string;
	url: string;
	merged: string;
	/** "committer" | "contributor"; anything else renders as no relation word. */
	relation: string;
	/** Fraction of the ribbon's time axis, 0 = oldest, 1 = newest. */
	t: number;
}

/** Latest merge per project, oldest first, positioned on one linear time axis. */
export function upstreamRows(rows: readonly ProfileMergedUpstream[]): UpstreamRow[] {
	const latest = new Map<string, ProfileMergedUpstream>();
	for (const row of rows) {
		const seen = latest.get(row.project);
		if (!seen || row.merged > seen.merged) latest.set(row.project, row);
	}
	const sorted = [...latest.values()].sort(
		(a, b) => a.merged.localeCompare(b.merged) || a.project.localeCompare(b.project),
	);
	if (sorted.length === 0) return [];
	const t0 = Date.parse(`${sorted[0].merged}T00:00:00Z`);
	const t1 = Date.parse(`${sorted[sorted.length - 1].merged}T00:00:00Z`);
	const span = Math.max(1, t1 - t0);
	return sorted.map((r) => ({
		project: r.project,
		repo: r.repo,
		url: upstreamUrl(r),
		merged: r.merged,
		relation: SHOWN_RELATIONS.has(r.relation) ? r.relation : '',
		t: (Date.parse(`${r.merged}T00:00:00Z`) - t0) / span,
	}));
}

/** Year ticks between the first and last merge, as axis fractions. */
export function upstreamYearTicks(rows: readonly UpstreamRow[]): { year: number; t: number }[] {
	if (rows.length === 0) return [];
	const t0 = Date.parse(`${rows[0].merged}T00:00:00Z`);
	const t1 = Date.parse(`${rows[rows.length - 1].merged}T00:00:00Z`);
	const span = Math.max(1, t1 - t0);
	const ticks: { year: number; t: number }[] = [];
	for (let y = new Date(t0).getUTCFullYear() + 1; y <= new Date(t1).getUTCFullYear(); y++) {
		ticks.push({ year: y, t: (Date.UTC(y, 0, 1) - t0) / span });
	}
	return ticks;
}

// ---------------------------------------------------------------------------
// Activity rhythm

export const ACTIVITY_ROWS: { kind: ActivityKind; label: string }[] = [
	{ kind: 'commit', label: 'Commits' },
	{ kind: 'pr', label: 'Pull requests' },
	{ kind: 'review', label: 'Reviews' },
	{ kind: 'issue', label: 'Issues' },
];

export type DayState = 'active' | 'inactive' | 'unknown';

export interface ActivityGap {
	from: string;
	to: string;
	reason: string;
}

export function activityGaps(view: Pick<ProfileView, 'coverage_details'>): ActivityGap[] {
	return view.coverage_details
		.filter((d) => d.scope === 'activity' && d.from && d.to)
		.map((d) => ({ from: d.from!, to: d.to!, reason: d.reason }));
}

/** Contiguous gaps with one reason read as one span (April + May = one note). */
export function mergeGaps(gaps: readonly ActivityGap[]): ActivityGap[] {
	const out: ActivityGap[] = [];
	for (const g of [...gaps].sort((a, b) => a.from.localeCompare(b.from))) {
		const last = out[out.length - 1];
		const dayAfterLast = last
			? new Date(Date.parse(`${last.to}T00:00:00Z`) + 86_400_000).toISOString().slice(0, 10)
			: '';
		if (last && last.reason === g.reason && dayAfterLast === g.from) last.to = g.to;
		else out.push({ ...g });
	}
	return out;
}

/**
 * One observation. A declared activity gap carries no activity type, so a
 * supplied false inside it is unknown, never an observed zero; a supplied
 * true stays an observed active day. Outside gaps, null is unknown.
 * (Same rule as the spear renderer, profile/readme.txt 2026-10-01.)
 */
export function dayState(value: boolean | null, date: string, gaps: readonly ActivityGap[]): DayState {
	if (value === true) return 'active';
	if (value === null) return 'unknown';
	return gaps.some((g) => date >= g.from && date <= g.to) ? 'unknown' : 'inactive';
}

export interface ActivityCell {
	/** First calendar day of the week in range. */
	start: string;
	end: string;
	/** Days of this week inside the series. */
	days: number;
	active: number;
	unknown: number;
}

export interface ActivityWeek {
	start: string;
	end: string;
	cells: Record<ActivityKind, ActivityCell>;
}

/** Seven-day columns from activity.from; the last one may be shorter. */
export function activityWeeks(view: Pick<ProfileView, 'activity' | 'coverage_details'>): ActivityWeek[] {
	const gaps = activityGaps(view);
	const weeks: ActivityWeek[] = [];
	const days = view.activity.days;
	for (let i = 0; i < days.length; i += 7) {
		const slice = days.slice(i, i + 7);
		const start = slice[0].date;
		const end = slice[slice.length - 1].date;
		const cells = {} as Record<ActivityKind, ActivityCell>;
		for (const { kind } of ACTIVITY_ROWS) {
			let active = 0;
			let unknown = 0;
			for (const day of slice) {
				const state = dayState(day[kind], day.date, gaps);
				if (state === 'active') active++;
				else if (state === 'unknown') unknown++;
			}
			cells[kind] = { start, end, days: slice.length, active, unknown };
		}
		weeks.push({ start, end, cells });
	}
	return weeks;
}

/** Fully observed / partly unknown calendar days, for the chart description. */
export function activityCoverage(view: Pick<ProfileView, 'activity' | 'coverage_details'>): {
	observed: number;
	unknown: number;
	total: number;
} {
	const gaps = activityGaps(view);
	let observed = 0;
	for (const day of view.activity.days) {
		if (ACTIVITY_ROWS.every(({ kind }) => dayState(day[kind], day.date, gaps) !== 'unknown')) observed++;
	}
	return { observed, unknown: view.activity.days.length - observed, total: view.activity.days.length };
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "1 Apr 2026" from an ISO date, without locale or timezone drift. */
export function formatDay(date: string): string {
	const [y, m, d] = date.split('-').map(Number);
	return `${d} ${MONTHS[m - 1]} ${y}`;
}

/** "Apr 2026". */
export function formatMonth(date: string): string {
	const [y, m] = date.split('-').map(Number);
	return `${MONTHS[m - 1]} ${y}`;
}

export function monthShort(date: string): string {
	return MONTHS[Number(date.slice(5, 7)) - 1];
}
