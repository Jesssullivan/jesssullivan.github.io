<script lang="ts">
	// Labels are the producer's label (describe-don't-name is applied
	// upstream). The tooltip never shows a count: no stars, totals or
	// "N projects" (R72, R79).
	import { shapeFor, shapePath } from './shapes';

	interface TooltipNode {
		label: string;
		categoryLabel: string;
		catIndex: number;
		languages: string[];
		link: string | null;
		archived: boolean;
	}

	let {
		id,
		node,
		x,
		y,
		bounds,
		similar = [],
		hint = '',
	}: {
		id: string;
		node: TooltipNode | null;
		x: number;
		y: number;
		bounds: { width: number; height: number };
		similar?: string[];
		hint?: string;
	} = $props();

	// 280 px, narrowed to the stage minus an 8 px margin each side on phones.
	let width = $derived(Math.max(0, Math.min(280, bounds.width - 16)));
	let flipX = $derived(x + width + 24 > bounds.width);
	let flipY = $derived(y > bounds.height * 0.62);
	let left = $derived(Math.max(8, Math.min(bounds.width - width - 8, flipX ? x - width - 16 : x + 16)));
</script>

{#if node}
	<div
		{id}
		role="tooltip"
		class="pm-tooltip"
		data-testid="map-tooltip"
		style="left: {left}px; {flipY
			? `bottom: ${Math.max(8, bounds.height - y + 14)}px`
			: `top: ${y + 14}px`}; width: {width}px"
	>
		<p class="pm-tooltip-label">{node.label}</p>
		<p class="pm-tooltip-cat">
			<svg width="12" height="12" viewBox="-8 -8 16 16" aria-hidden="true">
				<path d={shapePath(shapeFor(node.catIndex), 5.2)} style="fill: var(--pm-cat-{node.catIndex % 8})" />
			</svg>
			{node.categoryLabel}{node.archived ? ' · archived' : ''}
		</p>
		{#if node.languages.length > 0}
			<p class="pm-tooltip-meta">{node.languages.join(' · ')}</p>
		{/if}
		{#if similar.length > 0}
			<p class="pm-tooltip-meta">Similar: {similar.join('; ')}</p>
		{/if}
		<p class="pm-tooltip-hint">
			{hint || (node.link ? 'Click or Enter opens the repository' : 'No public repository link')}
		</p>
	</div>
{/if}

<style>
	.pm-tooltip {
		position: absolute;
		z-index: 5;
		pointer-events: none;
		padding: 0.55rem 0.7rem;
		background: var(--pm-panel-solid);
		color: var(--pm-ink);
		border: 1px solid var(--pm-line);
		box-shadow: 0 6px 24px rgb(0 0 0 / 0.18);
		font-size: 0.8rem;
		line-height: 1.35;
	}
	.pm-tooltip p {
		margin: 0;
	}
	.pm-tooltip-label {
		font-weight: 600;
		margin-bottom: 0.25rem !important;
	}
	.pm-tooltip-cat {
		display: flex;
		align-items: center;
		gap: 0.35rem;
	}
	.pm-tooltip-cat path {
		stroke: var(--pm-ink);
		stroke-width: 0.8;
	}
	.pm-tooltip-meta {
		color: var(--pm-muted);
		margin-top: 0.2rem !important;
		display: -webkit-box;
		-webkit-line-clamp: 3;
		line-clamp: 3;
		-webkit-box-orient: vertical;
		overflow: hidden;
	}
	.pm-tooltip-hint {
		margin-top: 0.35rem !important;
		font-size: 0.72rem;
		color: var(--pm-muted);
	}
</style>
