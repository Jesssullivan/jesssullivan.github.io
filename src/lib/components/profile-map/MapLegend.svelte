<script lang="ts">
	import { shapeFor, shapePath } from './shapes';

	interface LegendCategory {
		id: string;
		label: string;
	}

	let {
		categories,
		hidden,
		ontoggle,
		onhover,
		onshowall,
		compact = false,
	}: {
		categories: LegendCategory[];
		hidden: ReadonlySet<string>;
		ontoggle: (id: string) => void;
		onhover: (id: string | null) => void;
		onshowall: () => void;
		compact?: boolean;
	} = $props();
</script>

<div class="pm-legend" class:pm-legend-compact={compact} role="group" aria-label="Categories: toggle to show or hide">
	<ul>
		{#each categories as c, i (c.id)}
			<li>
				<button
					type="button"
					class="pm-legend-item"
					aria-pressed={!hidden.has(c.id)}
					data-category={c.id}
					onclick={() => ontoggle(c.id)}
					onpointerenter={() => onhover(c.id)}
					onpointerleave={() => onhover(null)}
					onfocus={() => onhover(c.id)}
					onblur={() => onhover(null)}
				>
					<svg width="14" height="14" viewBox="-8 -8 16 16" aria-hidden="true">
						<path d={shapePath(shapeFor(i), 5.2)} style="fill: var(--pm-cat-{i % 8})" class="pm-legend-mark" />
					</svg>
					<span>{c.label}</span>
				</button>
			</li>
		{/each}
	</ul>
	{#if hidden.size > 0}
		<button type="button" class="pm-legend-reset" onclick={onshowall}>Show all categories</button>
	{/if}
</div>

<style>
	.pm-legend ul {
		display: flex;
		flex-wrap: wrap;
		gap: 0.25rem 0.5rem;
		list-style: none;
		margin: 0;
		padding: 0;
	}
	.pm-legend-compact ul {
		flex-wrap: nowrap;
		overflow-x: auto;
		scrollbar-width: thin;
		padding-bottom: 0.25rem;
	}
	.pm-legend-item {
		display: inline-flex;
		align-items: center;
		gap: 0.35rem;
		padding: 0.2rem 0.45rem;
		font-size: 0.75rem;
		line-height: 1.2;
		white-space: nowrap;
		border: 1px solid var(--pm-line);
		background: var(--pm-panel);
		color: var(--pm-ink);
		cursor: pointer;
		transition: opacity 120ms ease;
	}
	.pm-legend-item[aria-pressed='false'] {
		opacity: 0.45;
		text-decoration: line-through;
	}
	.pm-legend-item:focus-visible,
	.pm-legend-reset:focus-visible {
		outline: 2px solid var(--pm-focus);
		outline-offset: 2px;
	}
	.pm-legend-mark {
		stroke: var(--pm-ink);
		stroke-width: 0.8;
	}
	.pm-legend-reset {
		margin-top: 0.35rem;
		font-size: 0.75rem;
		text-decoration: underline;
		color: var(--pm-ink);
		background: none;
		border: 0;
		padding: 0;
		cursor: pointer;
	}
	@media (prefers-reduced-motion: reduce) {
		.pm-legend-item {
			transition: none;
		}
	}
</style>
