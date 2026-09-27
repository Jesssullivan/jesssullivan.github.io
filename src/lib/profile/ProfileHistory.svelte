<script lang="ts">
	import type { ActivityKind, ProfileV1 } from './schema';
	import {
		activityDescription,
		activityKinds,
		languageCell,
		languageDescription,
		languageHistory,
		languageValue,
		monthLabel,
		upstreamHistory,
		weeklyActivity,
		weeklyMonthTicks,
	} from './history';

	let { profile }: { profile: ProfileV1 } = $props();
	const uid = $props.id();
	const languages = $derived(languageHistory(profile.language_months));
	const upstream = $derived(upstreamHistory(profile.merged_upstream));
	const weeks = $derived(weeklyActivity(profile.activity));
	let monthChoice = $state('');
	let languageChoice = $state('');
	let projectChoice = $state('');
	let weekChoice = $state('');
	let kindChoice = $state<ActivityKind>('commit');
	let chartWidth = $state(960);
	const width = $derived(Math.max(350, chartWidth));
	const month = $derived(languages.months.includes(monthChoice) ? monthChoice : languages.defaultMonth);
	const languageRows = $derived(month ? languages.languages.map((row) => languageCell(row, month)) : []);
	const language = $derived(languageRows.find((row) => row.language === languageChoice) ?? languageRows[0]);
	const project = $derived(upstream.points.find((row) => row.repo === projectChoice) ?? upstream.points.at(-1));
	const week = $derived(weeks.find((row) => row.start === weekChoice) ?? weeks.at(-1));
	const panels = $derived(
		Array.from({ length: Math.ceil(weeks.length / 26) }, (_, i) => weeks.slice(i * 26, i * 26 + 26)),
	);
	const activityWidth = $derived(Math.max(800, width));
	const activityCell = $derived((activityWidth - 140) / 26);
	const upstreamWidth = $derived(Math.max(860, width));
	const upstreamX = (position: number) => 260 + position * (upstreamWidth - 292);
	const languagePlotWidth = $derived(Math.max(110, width - 190));
	const languageHeight = $derived(174 + languageRows.length * 36);
	const tone = (active: number | null) =>
		active === null || active === 0
			? 'var(--profile-panel)'
			: `color-mix(in srgb, var(--profile-accent) ${20 + (active / 7) * 80}%, var(--profile-panel))`;
	function activate(event: KeyboardEvent, action: () => void) {
		if (event.key === 'Enter' || event.key === ' ') {
			event.preventDefault();
			action();
		}
	}
	function moveActivity(event: KeyboardEvent, index: number, kind: ActivityKind) {
		const kindIndex = activityKinds.findIndex((entry) => entry.key === kind);
		let next = index;
		let nextKind = kindIndex;
		if (event.key === 'ArrowLeft') next--;
		else if (event.key === 'ArrowRight') next++;
		else if (event.key === 'ArrowUp') nextKind--;
		else if (event.key === 'ArrowDown') nextKind++;
		else if (event.key === 'Home') next = 0;
		else if (event.key === 'End') next = weeks.length - 1;
		else {
			activate(event, () => {
				weekChoice = weeks[index].start;
				kindChoice = kind;
			});
			return;
		}
		event.preventDefault();
		next = Math.max(0, Math.min(weeks.length - 1, next));
		nextKind = Math.max(0, Math.min(activityKinds.length - 1, nextKind));
		weekChoice = weeks[next].start;
		kindChoice = activityKinds[nextKind].key;
		(event.currentTarget as SVGGElement).ownerSVGElement
			?.querySelector<SVGGElement>(`[data-week="${weekChoice}"][data-kind="${kindChoice}"]`)
			?.focus();
	}
</script>

<div class="profile-history" bind:clientWidth={chartWidth}>
	<section id="language-history" class="profile-panel history-section" aria-labelledby={`${uid}-language-heading`}>
		<div class="section-heading">
			<div>
				<p class="eyebrow">Files over time</p>
				<h2 id={`${uid}-language-heading`}>Language history</h2>
			</div>
			<p class="coverage">{profile.coverage.languages} coverage</p>
		</div>
		<p class="intro">
			Observed days with changed files, by language and month. A <strong>+</strong> means partial coverage: the observed value
			is a lower bound.
		</p>
		{#if month}
			<div class="controls">
				<label for={`${uid}-month`}>Month</label>
				<select id={`${uid}-month`} value={month} onchange={(event) => (monthChoice = event.currentTarget.value)}>
					{#each languages.coverage as item (item.ym)}<option value={item.ym}
							>{monthLabel(item.ym)} · {item.coverage}</option
						>{/each}
				</select>
			</div>
			<!-- svelte-ignore a11y_no_noninteractive_tabindex (Keyboard users must be able to scroll this named chart region.) -->
			<div class="chart-scroll" role="region" aria-label="Language history chart" tabindex="0">
				<svg
					class="language-chart"
					viewBox={`0 0 ${width} ${languageHeight}`}
					{width}
					height={languageHeight}
					role="group"
					aria-labelledby={`${uid}-language-title ${uid}-language-desc`}
				>
					<title id={`${uid}-language-title`}>Observed language activity in {monthLabel(month)}</title>
					<desc id={`${uid}-language-desc`}
						>The upper strip shows the full supplied month range. Hatched months are unavailable. Bars show observed
						active days in the selected month; plus signs mark partial coverage. Select a language for exact values, or
						read the complete history table.</desc
					>
					<defs
						><pattern id={`${uid}-language-hatch`} width="7" height="7" patternUnits="userSpaceOnUse"
							><path d="M-1 1L1 -1M0 7L7 0M6 8L8 6" class="hatch" /></pattern
						></defs
					>
					<text x="0" y="20" class="axis">Full observation window</text>
					{#each languages.coverage as item, index (item.ym)}
						{@const x = index * ((width - 2) / languages.months.length)}
						<g
							><title>{monthLabel(item.ym)}: {item.coverage} coverage</title>
							<rect
								{x}
								y="34"
								width={(width - 2) / languages.months.length}
								height="18"
								fill={item.coverage === 'unavailable' ? `url(#${uid}-language-hatch)` : 'var(--profile-accent)'}
							/>
						</g>
					{/each}
					<rect x="0.5" y="34" width={width - 2} height="18" class="strip-outline" />
					<text x="0" y="75" class="axis">{monthLabel(languages.months[0])}</text>
					<text x={width - 2} y="75" text-anchor="end" class="axis">{monthLabel(languages.months.at(-1)!)}</text>
					<text x="0" y="111" class="month-heading">{monthLabel(month)}</text>
					{#each languageRows as cell, index (cell.language)}
						{@const y = 132 + index * 36}
						<g
							class="interactive language-row"
							role="button"
							tabindex="0"
							aria-label={languageDescription(cell)}
							aria-pressed={language?.language === cell.language}
							onclick={() => (languageChoice = cell.language)}
							onfocus={() => (languageChoice = cell.language)}
							onkeydown={(event) => activate(event, () => (languageChoice = cell.language))}
						>
							<title>{languageDescription(cell)}</title>
							<rect x="0" {y} width={width - 2} height="34" class="hit-target" />
							<text x="0" y={y + 22}>{cell.language}</text>
							<line x1="122" x2={122 + languagePlotWidth} y1={y + 18} y2={y + 18} class="rail" />
							{#if cell.active === null}
								<rect x="122" y={y + 9} width={languagePlotWidth} height="18" fill={`url(#${uid}-language-hatch)`} />
							{:else}
								<rect
									x="122"
									y={y + 9}
									width={(cell.active / cell.calendarDays) * languagePlotWidth}
									height="18"
									class="bar"
								/>
							{/if}
							<text x={width - 4} y={y + 22} text-anchor="end" class="value"
								>{cell.active === null ? '—' : languageValue(cell)}</text
							>
						</g>
					{/each}
					<text x="122" y={languageHeight - 10} class="axis">0</text>
					<text x={122 + languagePlotWidth} y={languageHeight - 10} text-anchor="end" class="axis"
						>{languageRows[0]?.calendarDays} days</text
					>
				</svg>
			</div>
			<p class="value-detail" aria-live="polite" aria-atomic="true">{language ? languageDescription(language) : ''}</p>
		{:else}<p class="empty">No language-history observations in this snapshot.</p>{/if}
		<p class="method">
			{profile.methods.languages.attribution}. Current repository language shares do not supply this history. Hatching
			means unavailable, not zero.
		</p>
		<details class="data-table">
			<summary>Complete language history table</summary>
			<!-- svelte-ignore a11y_no_noninteractive_tabindex (Keyboard users must be able to scroll this named evidence table region.) -->
			<div class="table-scroll" role="region" aria-label="All language months" tabindex="0">
				<table>
					<caption>Public active days. + = partial coverage; — = unavailable. Every supplied month is retained.</caption
					>
					<thead
						><tr
							><th scope="col">Month</th>{#each languages.languages as row (row.language)}<th scope="col"
									>{row.language}</th
								>{/each}</tr
						></thead
					>
					<tbody
						>{#each languages.months as ym (ym)}<tr
								><th scope="row">{monthLabel(ym)}</th>{#each languages.languages as row (row.language)}{@const cell =
										languageCell(row, ym)}<td
										><span aria-hidden="true">{cell.active === null ? '—' : languageValue(cell)}</span>
										<span class="sr-only">{languageDescription(cell)}</span></td
									>{/each}</tr
							>{/each}</tbody
					>
				</table>
			</div>
		</details>
	</section>

	<section id="upstream" class="profile-panel history-section" aria-labelledby={`${uid}-upstream-heading`}>
		<div class="section-heading">
			<div>
				<p class="eyebrow">Across external projects</p>
				<h2 id={`${uid}-upstream-heading`}>Merged upstream work</h2>
			</div>
			<p class="coverage">{profile.coverage.upstream} coverage</p>
		</div>
		<p class="intro">
			One mark per external project, placed at its latest verified merge. Dates show recency; mark size does not measure
			contribution depth.
		</p>
		{#if project}
			<div class="controls">
				<label for={`${uid}-project`}>Project</label><select
					id={`${uid}-project`}
					value={project.repo}
					onchange={(event) => (projectChoice = event.currentTarget.value)}
					>{#each upstream.points as row (row.repo)}<option value={row.repo}>{row.project}</option>{/each}</select
				>
			</div>
			<p class="legend">
				<span>● Contributor</span><span>◆ Committer</span
				>{#if upstream.points.some((row) => row.relation === 'engagement')}<span>□ Engagement</span>{/if}
			</p>
			{#if width < upstreamWidth}<p class="chart-hint">Scroll horizontally to see the full date axis.</p>{/if}
			<!-- svelte-ignore a11y_no_noninteractive_tabindex (Keyboard users must be able to scroll this named chart region.) -->
			<div
				class="chart-scroll"
				role="region"
				aria-label="Upstream merge dates; scroll horizontally on small screens"
				tabindex="0"
			>
				<svg
					viewBox={`0 0 ${upstreamWidth} ${upstream.points.length * 42 + 66}`}
					width={upstreamWidth}
					height={upstream.points.length * 42 + 66}
					role="group"
					aria-labelledby={`${uid}-upstream-title ${uid}-upstream-desc`}
				>
					<title id={`${uid}-upstream-title`}>Latest verified merge per external project</title><desc
						id={`${uid}-upstream-desc`}
						>All marks use the same horizontal calendar axis. Circles mean contributor; diamonds mean committer. Select
						a mark to read its exact merge date and source pull request below.</desc
					>
					{#each upstream.years as tick (tick.year)}<line
							x1={upstreamX(tick.position)}
							x2={upstreamX(tick.position)}
							y1="34"
							y2={upstream.points.length * 42 + 32}
							class="grid-line"
						/><text x={upstreamX(tick.position)} y="20" class="axis">{tick.year}</text>{/each}
					{#each upstream.points as row, index (row.repo)}
						{@const y = index * 42 + 54}
						<g
							class="interactive upstream-row"
							role="button"
							tabindex="0"
							aria-pressed={project.repo === row.repo}
							aria-label={`${row.project}: ${row.merged}, ${row.relation}. Select to read the linked merge.`}
							onclick={() => (projectChoice = row.repo)}
							onfocus={() => (projectChoice = row.repo)}
							onkeydown={(event) => activate(event, () => (projectChoice = row.repo))}
						>
							<title>{row.project}: {row.merged}; {row.relation}</title><rect
								x="0"
								y={y - 20}
								width={upstreamWidth - 2}
								height="40"
								class="hit-target"
							/>
							<text x="0" y={y + 5} class="project-label">{row.project}</text><line
								x1="260"
								x2={upstreamWidth - 30}
								y1={y}
								y2={y}
								class="rail"
							/>
							{#if row.relation === 'committer'}<path
									d={`M${upstreamX(row.position)} ${y - 7}l7 7l-7 7l-7 -7Z`}
									class="merge-mark"
								/>
							{:else if row.relation === 'engagement'}<rect
									x={upstreamX(row.position) - 6}
									y={y - 6}
									width="12"
									height="12"
									class="engagement-mark"
								/>
							{:else}<circle cx={upstreamX(row.position)} cy={y} r="6" class="merge-mark" />{/if}
						</g>
					{/each}
				</svg>
			</div>
			<div class="value-detail" aria-live="polite" aria-atomic="true">
				<strong>{project.project}</strong> · {project.relation} · merged
				<time datetime={project.merged}>{project.merged}</time><br /><a href={project.url}
					>Read verified pull request #{project.number}</a
				>
			</div>
		{:else}<p class="empty">No verified upstream merges in this snapshot.</p>{/if}
		<details class="data-table">
			<summary>All projects and merge sources</summary
			><!-- svelte-ignore a11y_no_noninteractive_tabindex (Keyboard users must be able to scroll this named evidence table region.) -->
			<div class="table-scroll" role="region" aria-label="Upstream project evidence" tabindex="0">
				<table>
					<caption>Latest verified merge per source repository.</caption><thead
						><tr
							><th scope="col">Project</th><th scope="col">Relationship</th><th scope="col">Merged</th><th scope="col"
								>Evidence</th
							></tr
						></thead
					><tbody
						>{#each upstream.points as row (row.repo)}<tr
								><th scope="row">{row.project}</th><td>{row.relation}</td><td
									><time datetime={row.merged}>{row.merged}</time></td
								><td><a href={row.url}>{row.repo}#{row.number}</a></td></tr
							>{/each}</tbody
					>
				</table>
			</div>
		</details>
	</section>

	<section id="activity" class="profile-panel history-section" aria-labelledby={`${uid}-activity-heading`}>
		<div class="section-heading">
			<div>
				<p class="eyebrow">Public work, week by week</p>
				<h2 id={`${uid}-activity-heading`}>Activity rhythm</h2>
			</div>
			<p class="coverage">{profile.coverage.activity} coverage</p>
		</div>
		<p class="intro">
			UTC active days, separated by activity type. Types overlap; the same day can appear in several rows. Private
			activity is excluded.
		</p>
		{#if week}
			<div class="controls">
				<div class="control-field">
					<label for={`${uid}-week`}>Week beginning</label><select
						id={`${uid}-week`}
						value={week.start}
						onchange={(event) => (weekChoice = event.currentTarget.value)}
						>{#each weeks as item (item.start)}<option value={item.start}>{item.start}</option>{/each}</select
					>
				</div>
				<div class="control-field">
					<label for={`${uid}-kind`}>Type</label><select
						id={`${uid}-kind`}
						value={kindChoice}
						onchange={(event) => (kindChoice = event.currentTarget.value as ActivityKind)}
						>{#each activityKinds as kind (kind.key)}<option value={kind.key}>{kind.label}</option>{/each}</select
					>
				</div>
			</div>
			{#if width < activityWidth}<p class="chart-hint">Scroll horizontally to see every week.</p>{/if}
			<!-- svelte-ignore a11y_no_noninteractive_tabindex (Keyboard users must be able to scroll this named chart region.) -->
			<div
				class="chart-scroll"
				role="region"
				aria-label="Weekly activity chart; scroll horizontally on small screens"
				tabindex="0"
			>
				<svg
					viewBox={`0 0 ${activityWidth} ${panels.length * 232}`}
					width={activityWidth}
					height={panels.length * 232}
					role="group"
					aria-labelledby={`${uid}-activity-title ${uid}-activity-desc`}
				>
					<title id={`${uid}-activity-title`}>Public active days by UTC week and kind</title><desc
						id={`${uid}-activity-desc`}
						>Each cell shows zero to seven observed active days. Hatching means unavailable; a slash means missing
						observations or a week crossing the snapshot boundary. Use arrow keys on the selected cell to move between
						weeks and activity types, or use the week and type selectors.</desc
					>
					<defs
						><pattern id={`${uid}-activity-hatch`} width="7" height="7" patternUnits="userSpaceOnUse"
							><path d="M-1 1L1 -1M0 7L7 0M6 8L8 6" class="hatch" /></pattern
						></defs
					>
					{#each panels as panel, panelIndex (panel[0].start)}
						{@const top = panelIndex * 232 + 48}
						<text x="0" y={top - 29} class="axis">{panel[0].from} — {panel.at(-1)!.to} UTC</text>
						{#each weeklyMonthTicks(panel, activityCell) as tick (tick.column)}
							<text x={140 + tick.column * activityCell} y={top - 7} class="axis">{tick.label}</text>
						{/each}
						{#each activityKinds as kind, rowIndex (kind.key)}
							<text x="0" y={top + rowIndex * 38 + 23}>{kind.label}</text>
							{#each panel as item, col (item.start)}
								{@const value = item.kinds[kind.key]}
								{@const x = 140 + col * activityCell}
								{@const y = top + rowIndex * 38}
								<g
									class="interactive activity-cell"
									class:selected={week.start === item.start && kindChoice === kind.key}
									role="button"
									tabindex={week.start === item.start && kindChoice === kind.key ? 0 : -1}
									data-week={item.start}
									data-kind={kind.key}
									aria-label={activityDescription(item, kind.key)}
									aria-pressed={week.start === item.start && kindChoice === kind.key}
									onclick={() => {
										weekChoice = item.start;
										kindChoice = kind.key;
									}}
									onfocus={() => {
										weekChoice = item.start;
										kindChoice = kind.key;
									}}
									onkeydown={(event) => moveActivity(event, panelIndex * 26 + col, kind.key)}
								>
									<title>{activityDescription(item, kind.key)}</title><rect
										{x}
										{y}
										width={activityCell - 3}
										height="30"
										fill={tone(value.active)}
										class="activity-tile"
									/>
									{#if value.active === null}<rect
											{x}
											{y}
											width={activityCell - 3}
											height="30"
											fill={`url(#${uid}-activity-hatch)`}
										/>{:else if value.coverage === 'partial'}<path
											d={`M${x + activityCell - 12} ${y + 1}l8 8`}
											class="partial-mark"
										/>{/if}
								</g>
							{/each}
						{/each}
					{/each}
				</svg>
			</div>
			<div class="legend activity-legend">
				<span>Active days</span>{#each [0, 1, 2, 3, 4, 5, 6, 7] as value (value)}<span class="legend-value"
						><i style:background={tone(value)}></i>{value}</span
					>{/each}<span class="legend-value"><i class="unknown-swatch"></i>Unavailable</span><span
					>/ Partial week or missing days</span
				>
			</div>
			<p class="value-detail" aria-live="polite" aria-atomic="true">{activityDescription(week, kindChoice)}</p>
		{/if}
		<p class="method">
			{profile.methods.activity.attribution}. A day is active or inactive; these are not event counts.
		</p>
		<details class="data-table">
			<summary>Complete weekly activity table</summary
			><!-- svelte-ignore a11y_no_noninteractive_tabindex (Keyboard users must be able to scroll this named evidence table region.) -->
			<div class="table-scroll" role="region" aria-label="All UTC weeks and activity types" tabindex="0">
				<table>
					<caption
						>Each kind reports active / observed days, followed by unknown days. Calendar bounds exclude days outside
						the snapshot window.</caption
					><thead
						><tr
							><th scope="col">Week beginning</th><th scope="col">Snapshot bounds</th
							>{#each activityKinds as kind (kind.key)}<th scope="col">{kind.label}</th>{/each}</tr
						></thead
					><tbody
						>{#each weeks as item (item.start)}<tr
								><th scope="row">{item.start}</th><td>{item.from} to {item.to}<br />{item.days} calendar days</td
								>{#each activityKinds as kind (kind.key)}{@const value = item.kinds[kind.key]}<td
										>{value.active === null ? 'Unavailable' : `${value.active} / ${value.observed}`}<br
										/>{value.unknown} unknown{#if item.outsideDays}<br />{item.outsideDays} outside window{/if}</td
									>{/each}</tr
							>{/each}</tbody
					>
				</table>
			</div>
		</details>
	</section>
</div>

<style>
	.profile-history {
		min-width: 0;
		color: var(--profile-ink);
		font-family: var(--profile-font-body);
	}
	.sr-only {
		position: absolute;
		width: 1px;
		height: 1px;
		padding: 0;
		margin: -1px;
		overflow: hidden;
		clip-path: inset(50%);
		white-space: nowrap;
		border: 0;
	}
	.history-section {
		min-width: 0;
		margin-top: 3.5rem;
		padding-top: 1.4rem;
		border-top: 1px solid var(--profile-rule);
		scroll-margin-top: 5rem;
	}
	.section-heading {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: 1rem;
		flex-wrap: wrap;
	}
	.eyebrow {
		margin: 0 0 0.4rem;
		color: var(--profile-muted);
		font-family: var(--profile-font-mono);
		font-size: 0.875rem;
	}
	h2 {
		margin: 0;
		color: var(--profile-heading);
		font-family: var(--profile-font-mono);
		font-size: clamp(1.5rem, 3vw, 2rem);
		font-weight: 550;
		line-height: 1.25;
	}
	.coverage {
		margin: 0;
		font-family: var(--profile-font-mono);
		font-size: 0.875rem;
		color: var(--profile-muted);
	}
	.intro {
		max-width: 76ch;
		margin: 1rem 0 1.25rem;
		font-size: 1rem;
		line-height: 1.65;
	}
	.controls {
		display: flex;
		align-items: center;
		gap: 0.6rem 1rem;
		flex-wrap: wrap;
		margin-bottom: 1.25rem;
		font-size: 0.9375rem;
	}
	.controls label {
		font-weight: 600;
	}
	.control-field {
		display: flex;
		align-items: center;
		gap: 0.6rem;
	}
	.chart-hint {
		font-size: 0.875rem;
		color: var(--profile-muted);
		margin: 0 0 0.8rem;
	}
	select {
		min-height: 44px;
		max-width: 100%;
		background: var(--profile-bg);
		color: var(--profile-ink);
		border: 1px solid var(--profile-outline);
		border-radius: 0;
		padding: 0.5rem 2rem 0.5rem 0.75rem;
		font: inherit;
	}
	.chart-scroll,
	.table-scroll {
		position: relative;
		max-width: 100%;
		overflow-x: auto;
		overscroll-behavior-x: contain;
		scrollbar-color: var(--profile-outline) var(--profile-panel);
	}
	svg {
		display: block;
		max-width: none;
		overflow: visible;
		font-family: var(--profile-font-body);
		font-size: 15px;
		fill: var(--profile-ink);
	}
	.axis,
	.value {
		font: 14px var(--profile-font-mono);
		fill: var(--profile-muted);
	}
	.month-heading {
		font: 16px var(--profile-font-mono);
		fill: var(--profile-heading);
	}
	.project-label {
		font-size: 14px;
	}
	.rail,
	.grid-line {
		stroke: var(--profile-rule);
		stroke-width: 1;
	}
	.hatch {
		stroke: var(--profile-outline);
		fill: none;
		stroke-width: 1;
	}
	.strip-outline {
		fill: none;
		stroke: var(--profile-outline);
	}
	.bar {
		fill: var(--profile-accent);
	}
	.hit-target {
		fill: transparent;
	}
	.interactive {
		cursor: pointer;
		outline: none;
	}
	.interactive:hover .hit-target,
	.interactive[aria-pressed='true'] .hit-target {
		fill: var(--profile-panel);
	}
	.interactive:focus-visible .hit-target {
		stroke: var(--profile-outline);
		stroke-width: 2;
	}
	.merge-mark {
		fill: var(--profile-accent);
		stroke: var(--profile-ink);
		stroke-width: 1;
	}
	.engagement-mark {
		fill: var(--profile-bg);
		stroke: var(--profile-accent);
		stroke-width: 2;
	}
	.activity-tile {
		stroke: var(--profile-outline);
		stroke-width: 0.7;
	}
	.activity-cell.selected .activity-tile,
	.activity-cell:focus-visible .activity-tile {
		stroke: var(--profile-ink);
		stroke-width: 2.5;
	}
	.partial-mark {
		fill: none;
		stroke: var(--profile-ink);
		stroke-width: 2;
	}
	.legend {
		display: flex;
		gap: 0.65rem 1.3rem;
		flex-wrap: wrap;
		font-size: 0.875rem;
		color: var(--profile-muted);
	}
	.activity-legend {
		gap: 0.65rem 1rem;
		margin-top: -0.8rem;
	}
	.legend-value {
		display: inline-flex;
		align-items: center;
		gap: 0.4rem;
	}
	.legend-value i {
		display: inline-block;
		width: 18px;
		height: 18px;
		border: 1px solid var(--profile-outline);
	}
	.unknown-swatch {
		background: repeating-linear-gradient(135deg, transparent 0 4px, var(--profile-outline) 4px 5px);
	}
	.value-detail {
		margin: 1.25rem 0 1rem;
		padding: 0.8rem 0 0.8rem 1rem;
		border-left: 2px solid var(--profile-accent);
		min-height: 3.7rem;
		font-size: 0.9375rem;
		line-height: 1.65;
	}
	.method,
	.empty {
		font-size: 0.875rem;
		color: var(--profile-muted);
		line-height: 1.65;
		max-width: 90ch;
	}
	.data-table {
		margin-top: 1.3rem;
		border-top: 1px solid var(--profile-rule);
		border-bottom: 1px solid var(--profile-rule);
	}
	summary {
		padding: 0.85rem 0;
		font-family: var(--profile-font-mono);
		font-size: 0.9375rem;
		cursor: pointer;
	}
	table {
		border-collapse: collapse;
		width: 100%;
		font-size: 0.875rem;
		line-height: 1.5;
	}
	caption {
		text-align: left;
		color: var(--profile-muted);
		padding: 0.5rem 0 1rem;
	}
	th,
	td {
		border-bottom: 1px solid var(--profile-rule);
		padding: 0.75rem 0.9rem;
		text-align: left;
		vertical-align: top;
		min-width: 7rem;
	}
	th:first-child,
	td:first-child {
		padding-left: 0;
	}
	thead th {
		color: var(--profile-heading);
	}
	tbody th {
		font-weight: 500;
	}
	a {
		color: var(--profile-accent);
		text-decoration: underline;
		text-underline-offset: 0.2em;
	}
	a:focus-visible,
	select:focus-visible,
	summary:focus-visible,
	.chart-scroll:focus-visible,
	.table-scroll:focus-visible {
		outline: 2px solid var(--profile-accent);
		outline-offset: 4px;
	}
	@media (max-width: 480px) {
		.coverage {
			flex-basis: 100%;
		}
		.controls {
			gap: 0.6rem;
		}
		.history-section {
			margin-top: 2.5rem;
		}
	}
</style>
