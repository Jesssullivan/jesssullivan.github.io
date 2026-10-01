<script lang="ts">
	// Merged upstream work as an HTML ribbon (R80 chart brief): one linear
	// time axis, one mark per external project at its latest verified merge,
	// committer diamond / contributor dot, alternating leader labels where they
	// fit, the newest mark pulsing briefly. Every project is in the list below
	// with its real PR link; the ribbon is the visual summary of that list.
	import { onMount } from 'svelte';
	import { formatDay, upstreamRows, upstreamYearTicks, type UpstreamRow } from '$lib/profile/view';
	import type { ProfileMergedUpstream } from '$lib/profile/schema';

	let { rows: source }: { rows: readonly ProfileMergedUpstream[] } = $props();

	let rows = $derived(upstreamRows(source));
	let ticks = $derived(upstreamYearTicks(rows));
	let newest = $derived(rows.length ? rows[rows.length - 1].project : '');
	let active = $state<string | null>(null);

	// Label placement at the ribbon's minimum width (it scrolls, never squeezes):
	// newest first, four lanes (above, below, above-far, below-far), labels
	// right-anchored near the end; a label that fits nowhere is left to the list.
	const DESIGN_WIDTH = 680;
	const CHAR = 6.7;
	type Placed = UpstreamRow & { lane: number; anchor: 'start' | 'end' };
	let placed = $derived.by(() => {
		const lanes: [number, number][][] = [[], [], [], []];
		const out: Placed[] = [];
		for (const row of [...rows].reverse()) {
			const x = row.t * DESIGN_WIDTH;
			const w = row.project.length * CHAR + 10;
			const anchor: 'start' | 'end' = x + w > DESIGN_WIDTH ? 'end' : 'start';
			const span: [number, number] = anchor === 'start' ? [x - 2, x + w] : [x - w, x + 2];
			const lane = lanes.findIndex((taken) => taken.every(([a, b]) => span[1] + 6 < a || span[0] > b + 6));
			if (lane < 0) continue;
			lanes[lane].push(span);
			out.push({ ...row, lane, anchor });
		}
		return out;
	});
	let labelled = $derived(new Set(placed.map((p) => p.project)));

	// On a narrow screen the ribbon scrolls; open it at the newest (right) end.
	let scrollEl: HTMLDivElement | undefined = $state();
	onMount(() => {
		if (scrollEl) scrollEl.scrollLeft = scrollEl.scrollWidth;
	});
</script>

<div class="ur" data-testid="upstream-ribbon">
	<div class="ur-scroll" bind:this={scrollEl}>
		<div class="ur-ribbon" aria-hidden="true">
			<div class="ur-axis"></div>
			{#each ticks as tick (tick.year)}
				<span class="ur-tick" style="left: {tick.t * 100}%"><span>{tick.year}</span></span>
			{/each}
			{#each placed as p (p.project)}
				<span class="ur-leader ur-lane-{p.lane}" class:ur-active={active === p.project} style="left: {p.t * 100}%"
				></span>
				<a
					href={p.url}
					target="_blank"
					rel="noopener"
					tabindex="-1"
					class="ur-label ur-lane-{p.lane} ur-anchor-{p.anchor}"
					class:ur-active={active === p.project}
					style="left: {p.t * 100}%"
					onpointerenter={() => (active = p.project)}
					onpointerleave={() => (active = null)}>{p.project}</a
				>
			{/each}
			{#each rows as r (r.project)}
				<a
					href={r.url}
					target="_blank"
					rel="noopener"
					tabindex="-1"
					class="ur-mark ur-{r.relation || 'plain'}"
					class:ur-newest={r.project === newest}
					class:ur-active={active === r.project}
					class:ur-unlabelled={!labelled.has(r.project)}
					style="left: {r.t * 100}%"
					title="{r.project}, merged {formatDay(r.merged)}"
					onpointerenter={() => (active = r.project)}
					onpointerleave={() => (active = null)}
				></a>
			{/each}
		</div>
	</div>
	<p class="ur-key" aria-hidden="true">
		<span class="ur-key-item"><span class="ur-swatch ur-contributor"></span>Contributor</span>
		<span class="ur-key-item"><span class="ur-swatch ur-committer"></span>Committer</span>
		<span class="ur-key-note">Latest verified merge per project; every project is listed below.</span>
	</p>
	<ul class="ur-list" data-testid="upstream-list">
		{#each [...rows].reverse() as r (r.project)}
			<li class:ur-active={active === r.project}>
				<a
					href={r.url}
					class="text-primary-500 hover:underline"
					target="_blank"
					rel="noopener"
					onpointerenter={() => (active = r.project)}
					onpointerleave={() => (active = null)}
					onfocus={() => (active = r.project)}
					onblur={() => (active = null)}>{r.project}</a
				>
				{#if r.relation}<span class="ur-relation"> ({r.relation})</span>{/if}
				<span class="ur-date">&middot; merged <time datetime={r.merged}>{formatDay(r.merged)}</time></span>
			</li>
		{/each}
	</ul>
</div>

<style>
	.ur {
		--ur-ink: var(--color-surface-950);
		--ur-muted: var(--color-surface-600);
		--ur-line: var(--color-surface-400);
		--ur-mark: var(--color-primary-600);
		--ur-mark-alt: var(--color-secondary-600);
		--ur-hot: var(--color-primary-500);
	}
	:global([data-mode='dark']) .ur {
		--ur-ink: var(--color-surface-50);
		--ur-muted: var(--color-surface-300);
		--ur-line: var(--color-surface-600);
		--ur-mark: var(--color-primary-400);
		--ur-mark-alt: var(--color-secondary-400);
		--ur-hot: var(--color-primary-300);
	}
	.ur-scroll {
		overflow-x: auto;
		padding: 0 0.25rem;
	}
	.ur-ribbon {
		position: relative;
		min-width: 680px;
		height: 168px;
		margin: 0 4.5rem 0 0.5rem;
	}
	.ur-axis {
		position: absolute;
		left: 0;
		right: 0;
		top: 84px;
		border-top: 1px solid var(--ur-line);
	}
	.ur-tick {
		position: absolute;
		top: 84px;
		height: 6px;
		border-left: 1px solid var(--ur-line);
	}
	.ur-tick span {
		position: absolute;
		top: 8px;
		left: -1rem;
		width: 2rem;
		text-align: center;
		font-family: var(--font-mono, ui-monospace, monospace);
		font-size: 0.7rem;
		color: var(--ur-muted);
	}
	.ur-mark {
		position: absolute;
		top: 84px;
		width: 11px;
		height: 11px;
		margin: -5.5px 0 0 -5.5px;
		background: var(--ur-mark);
		border: 1.5px solid var(--color-surface-50);
		border-radius: 999px;
		box-shadow: 0 0 0 1px var(--ur-mark);
		z-index: 2;
	}
	.ur-committer {
		border-radius: 0;
		transform: rotate(45deg);
		background: var(--ur-mark-alt);
		box-shadow: 0 0 0 1px var(--ur-mark-alt);
	}
	.ur-mark.ur-active {
		box-shadow: 0 0 0 3px var(--ur-hot);
	}
	.ur-newest::after {
		content: '';
		position: absolute;
		inset: -5px;
		border-radius: 999px;
		border: 2px solid var(--ur-hot);
		opacity: 0;
		animation: ur-pulse 1.4s ease-out 0.4s 3;
	}
	.ur-committer.ur-newest::after {
		border-radius: 0;
	}
	@keyframes ur-pulse {
		0% {
			opacity: 0.9;
			transform: scale(0.6);
		}
		100% {
			opacity: 0;
			transform: scale(2.2);
		}
	}
	.ur-leader {
		position: absolute;
		width: 0;
		border-left: 1px solid var(--ur-line);
	}
	.ur-leader.ur-lane-0 {
		top: 54px;
		height: 30px;
	}
	.ur-leader.ur-lane-1 {
		top: 84px;
		height: 32px;
	}
	.ur-leader.ur-lane-2 {
		top: 22px;
		height: 62px;
	}
	.ur-leader.ur-lane-3 {
		top: 84px;
		height: 64px;
	}
	.ur-leader.ur-active {
		border-left-color: var(--ur-hot);
	}
	.ur-label {
		position: absolute;
		white-space: nowrap;
		font-size: 0.78rem;
		line-height: 1;
		color: var(--ur-ink);
		text-decoration: none;
		padding: 0 0.2rem;
	}
	.ur-anchor-end {
		transform: translateX(-100%);
	}
	.ur-label.ur-lane-0 {
		top: 40px;
	}
	.ur-label.ur-lane-1 {
		top: 118px;
	}
	.ur-label.ur-lane-2 {
		top: 8px;
	}
	.ur-label.ur-lane-3 {
		top: 150px;
	}
	.ur-label.ur-active {
		color: var(--ur-hot);
		text-decoration: underline;
	}
	.ur-key {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.4rem 1rem;
		font-size: 0.78rem;
		color: var(--ur-muted);
		margin: 0.5rem 0 0.75rem;
	}
	.ur-key-item {
		display: inline-flex;
		align-items: center;
		gap: 0.35rem;
	}
	.ur-swatch {
		display: inline-block;
		width: 9px;
		height: 9px;
		background: var(--ur-mark);
		border-radius: 999px;
	}
	.ur-swatch.ur-committer {
		border-radius: 0;
		transform: rotate(45deg);
		background: var(--ur-mark-alt);
		box-shadow: none;
	}
	.ur-list {
		list-style: none;
		margin: 0;
		padding: 0;
		display: grid;
		gap: 0.25rem;
		color: var(--color-surface-600);
	}
	:global([data-mode='dark']) .ur-list {
		color: var(--color-surface-400);
	}
	.ur-list li.ur-active {
		background: color-mix(in oklab, var(--ur-hot) 12%, transparent);
	}
	.ur-relation,
	.ur-date {
		color: var(--ur-muted);
	}
	.ur-date {
		font-size: 0.78rem;
	}
	@media (prefers-reduced-motion: reduce) {
		.ur-newest::after {
			animation: none;
		}
	}
</style>
