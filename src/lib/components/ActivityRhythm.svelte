<script lang="ts">
	// Public activity rhythm (R80 chart brief, R111 ruling): per activity
	// type, the observed active days in each week. Unknown days (null, or a
	// supplied false inside a declared coverage gap) are hatched and never
	// drawn as zero. Analytic per-week day counts only; no totals (R79).
	import {
		ACTIVITY_ROWS,
		activityCoverage,
		activityGaps,
		activityWeeks,
		formatDay,
		mergeGaps,
		monthShort,
		type ProfileView,
	} from '$lib/profile/view';

	let { view }: { view: Pick<ProfileView, 'activity' | 'coverage_details'> } = $props();

	const uid = $props.id();
	const hatchId = `${uid}-hatch`;

	let weeks = $derived(activityWeeks(view));
	let coverage = $derived(activityCoverage(view));
	let gapNotes = $derived(mergeGaps(activityGaps(view)));

	const LABEL_W = 104;
	const CELL = 12;
	const GAP = 2;
	const ROW = CELL + 5;
	const TOP = 20;
	let width = $derived(LABEL_W + weeks.length * (CELL + GAP));
	let stripY = $derived(TOP + ACTIVITY_ROWS.length * ROW + 3);
	let height = $derived(stripY + 10);
	// One label per month start, skipping any that would sit within three
	// columns of the previous label (a series starting on 29 Sep would
	// otherwise print "SepOct").
	let monthTicks = $derived.by(() => {
		const out: { i: number }[] = [];
		weeks.forEach((w, i) => {
			if (i > 0 && weeks[i - 1].start.slice(0, 7) === w.start.slice(0, 7)) return;
			const prev = out[out.length - 1];
			if (prev && i - prev.i < 3) out[out.length - 1] = { i };
			else out.push({ i });
		});
		return out;
	});
	let gapWeeks = $derived(weeks.map((w) => activityGaps(view).some((g) => w.start <= g.to && w.end >= g.from)));

	function fill(active: number): string {
		const pct = Math.round((active / 7) * 100);
		return `color-mix(in oklab, var(--ar-hot) ${pct}%, var(--ar-cold))`;
	}

	function cellTitle(label: string, start: string, days: number, active: number, unknown: number): string {
		const observed = days - unknown;
		if (observed === 0) return `${label}, week of ${formatDay(start)}: unknown (no observation)`;
		const unk = unknown > 0 ? `; ${unknown} of ${days} days unknown` : '';
		return `${label}, week of ${formatDay(start)}: ${active} of ${observed} observed days active${unk}`;
	}
</script>

<div class="ar" data-testid="activity-rhythm">
	<figure class="ar-figure">
		<div class="ar-scroll">
			<svg
				viewBox="0 0 {width} {height}"
				width="100%"
				role="img"
				aria-labelledby="{uid}-title {uid}-desc"
				class="ar-svg"
				style="min-width: {Math.min(width, 640)}px"
			>
				<title id="{uid}-title">Activity rhythm</title>
				<desc id="{uid}-desc"
					>Public active days per week, separated by activity type, {formatDay(view.activity.from)} to {formatDay(
						view.activity.to,
					)}. {coverage.observed} of {coverage.total} calendar days are fully observed; unknown days are hatched, never shown
					as zero. Types overlap. Private activity is excluded.</desc
				>
				<defs>
					<pattern id={hatchId} width="4" height="4" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
						<rect width="4" height="4" class="ar-hatch-bg" />
						<line x1="0" y1="0" x2="0" y2="4" class="ar-hatch-line" />
					</pattern>
				</defs>
				{#each monthTicks as t (t.i)}
					<text x={LABEL_W + t.i * (CELL + GAP)} y="11" class="ar-month">{monthShort(weeks[t.i].start)}</text>
				{/each}
				{#each ACTIVITY_ROWS as row, r (row.kind)}
					<text x="0" y={TOP + r * ROW + CELL - 2} class="ar-row-label">{row.label}</text>
					{#each weeks as w, i (w.start)}
						{@const c = w.cells[row.kind]}
						{@const x = LABEL_W + i * (CELL + GAP)}
						{@const y = TOP + r * ROW}
						{@const allUnknown = c.unknown === c.days}
						<g
							class="ar-cell"
							data-kind={row.kind}
							data-week={w.start}
							data-unknown={c.unknown}
							data-active={allUnknown ? '' : c.active}
						>
							<title>{cellTitle(row.label, w.start, c.days, c.active, c.unknown)}</title>
							{#if allUnknown}
								<rect {x} {y} width={CELL} height={CELL} fill="url(#{hatchId})" class="ar-box" />
							{:else}
								<rect {x} {y} width={CELL} height={CELL} style="fill: {fill(c.active)}" class="ar-box" />
								{#if c.unknown > 0}
									<path
										d="M{x + CELL - 5} {y + 0.5} L{x + CELL - 0.5} {y + 0.5} L{x + CELL - 0.5} {y + 5} Z"
										class="ar-partial"
									/>
								{/if}
							{/if}
						</g>
					{/each}
				{/each}
				{#each gapWeeks as inGap, i (i)}
					{#if inGap}
						<rect
							x={LABEL_W + i * (CELL + GAP)}
							y={stripY}
							width={CELL}
							height="5"
							fill="url(#{hatchId})"
							class="ar-box"
						/>
					{/if}
				{/each}
			</svg>
		</div>
		<div class="ar-key" aria-hidden="true">
			<span>Active days in the week</span>
			{#each [0, 1, 2, 3, 4, 5, 6, 7] as n (n)}
				<span class="ar-key-cell" style="background: {fill(n)}" title="{n} of 7"></span>
			{/each}
			<span class="ar-key-scale">0 → 7</span>
			<svg width="12" height="12" class="ar-key-hatch"
				><rect width="12" height="12" fill="url(#{hatchId})" class="ar-box" /></svg
			>
			<span>Unknown</span>
			<svg width="12" height="12"
				><rect width="12" height="12" style="fill: {fill(3)}" class="ar-box" /><path
					d="M7 0.5 L11.5 0.5 L11.5 5 Z"
					class="ar-partial"
				/></svg
			>
			<span>Some days unknown</span>
		</div>
		<figcaption class="ar-caption">
			{formatDay(view.activity.from)} to {formatDay(view.activity.to)}, weeks from the first day.
			{#each gapNotes as g (g.from)}
				Hatched: declared coverage gap, shown as unknown rather than zero: {formatDay(g.from)} to {formatDay(g.to)} ({g.reason}).
			{/each}
			Types overlap; a day may appear in several rows. Private activity is excluded.
		</figcaption>
	</figure>
	<details class="ar-details">
		<summary>Weekly table</summary>
		<div class="ar-table-wrap">
			<table class="table text-xs" data-testid="activity-table">
				<thead>
					<tr>
						<th scope="col">Week of</th>
						{#each ACTIVITY_ROWS as row (row.kind)}<th scope="col">{row.label}</th>{/each}
					</tr>
				</thead>
				<tbody>
					{#each weeks as w (w.start)}
						<tr>
							<th scope="row">{formatDay(w.start)}</th>
							{#each ACTIVITY_ROWS as row (row.kind)}
								{@const c = w.cells[row.kind]}
								<td
									>{c.unknown === c.days
										? 'unknown'
										: `${c.active} active${c.unknown ? `, ${c.unknown} unknown` : ''}`}</td
								>
							{/each}
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	</details>
</div>

<style>
	.ar-figure {
		margin: 0;
	}
	.ar {
		--ar-hot: var(--color-primary-600);
		--ar-cold: var(--color-surface-100);
		--ar-line: var(--color-surface-400);
		--ar-ink: var(--color-surface-950);
		--ar-muted: var(--color-surface-600);
		margin: 0;
	}
	:global([data-mode='dark']) .ar {
		--ar-hot: var(--color-primary-400);
		--ar-cold: var(--color-surface-900);
		--ar-line: var(--color-surface-600);
		--ar-ink: var(--color-surface-50);
		--ar-muted: var(--color-surface-300);
	}
	.ar-scroll {
		overflow-x: auto;
	}
	.ar-svg {
		display: block;
		height: auto;
	}
	.ar-month {
		font-family: var(--font-mono, ui-monospace, monospace);
		font-size: 9px;
		fill: var(--ar-muted);
	}
	.ar-row-label {
		font-size: 10px;
		fill: var(--ar-ink);
	}
	.ar-box {
		stroke: var(--ar-line);
		stroke-width: 0.6;
	}
	.ar-cell:hover .ar-box {
		stroke: var(--ar-ink);
		stroke-width: 1.2;
	}
	.ar-partial {
		fill: var(--ar-ink);
		opacity: 0.75;
	}
	.ar-hatch-bg {
		fill: var(--ar-cold);
	}
	.ar-hatch-line {
		stroke: var(--ar-muted);
		stroke-width: 1.4;
	}
	.ar-key {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.3rem;
		font-size: 0.75rem;
		color: var(--ar-muted);
		margin-top: 0.5rem;
	}
	.ar-key-cell {
		display: inline-block;
		width: 12px;
		height: 12px;
		border: 0.6px solid var(--ar-line);
	}
	.ar-key-scale {
		margin-right: 0.75rem;
		font-family: var(--font-mono, ui-monospace, monospace);
	}
	.ar-caption {
		font-size: 0.78rem;
		line-height: 1.45;
		color: var(--ar-muted);
		margin-top: 0.5rem;
	}
	.ar-details {
		margin-top: 0.5rem;
		font-size: 0.8rem;
	}
	.ar-details summary {
		cursor: pointer;
		color: var(--ar-muted);
	}
	.ar-table-wrap {
		max-height: 22rem;
		overflow: auto;
		margin-top: 0.5rem;
	}
</style>
