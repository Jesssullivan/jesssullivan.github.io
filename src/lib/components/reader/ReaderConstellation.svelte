<script lang="ts">
	import { tick } from 'svelte';
	import { goto } from '$app/navigation';
	import type { PublicPulseSnapshotAny } from '$lib/pulse/snapshot';
	import type { ReaderCollection } from '$lib/reader/collection';
	import PulseFeed from '$lib/components/pulse/PulseFeed.svelte';
	// Build-time import (TIN-5680): the projection ships in this bundle, never fetched at runtime.
	import postsProjection from '$lib/data/posts-projection.v1.json';
	import {
		buildScene,
		firstInReadingOrder,
		nearestNode,
		neighborInDirection,
		neighboursOf,
		type Direction,
	} from '$lib/reader/projection/scene';

	// The section opens on the map. The list carries the same posts and neighbours for readers who cannot use the map (RM27).
	type View = 'map' | 'list';

	let {
		snapshot,
		archive = [],
		focusSlug = null,
		initialView = 'map',
	}: {
		snapshot: PublicPulseSnapshotAny;
		archive?: ReaderCollection['archive'];
		focusSlug?: string | null;
		initialView?: View;
	} = $props();
	// svelte-ignore state_referenced_locally
	let view = $state<View>(initialView);

	// Similarity map: only posts the reader can already route to are drawn.
	const scene = $derived(buildScene(postsProjection, archive.flatMap((group) => group.posts)));
	let focusIdx = $state(-1);
	let hoverIdx = $state(-1);
	let mapElement = $state<SVGSVGElement | null>(null);
	const activeIdx = $derived(hoverIdx >= 0 ? hoverIdx : focusIdx);
	const activeNode = $derived(scene && activeIdx >= 0 ? scene.nodes[activeIdx] : null);
	const activeNeighbours = $derived(scene && activeIdx >= 0 ? new Set(scene.adjacency[activeIdx]) : new Set<number>());
	const tabIndexOwner = $derived(scene ? (focusIdx >= 0 ? focusIdx : firstInReadingOrder(scene)) : -1);
	const listOrder = $derived(
		scene ? [...scene.nodes].sort((a, b) => b.date.localeCompare(a.date) || a.slug.localeCompare(b.slug)) : [],
	);

	const ARROWS: Record<string, Direction> = { ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down' };
	// Screen distance within which a pointer reaches a node. Touch gets more than a 24px target (WCAG 2.5.8).
	const MOUSE_REACH_PX = 14;
	const TOUCH_REACH_PX = 28;
	let lastPointerType = 'mouse';

	function openNode(index: number, newTab = false) {
		const node = scene?.nodes[index];
		if (!node) return;
		if (newTab) window.open(node.href, '_blank', 'noopener');
		else void goto(node.href);
	}

	/** The node nearest the pointer, or -1 when none is within reach. */
	function nodeAtPointer(event: MouseEvent, reachPx: number): number {
		const ctm = mapElement?.getScreenCTM();
		if (!scene || !ctm || !ctm.a) return -1;
		const point = new DOMPoint(event.clientX, event.clientY).matrixTransform(ctm.inverse());
		return nearestNode(scene, point.x / 1000, point.y / 1000, reachPx / (ctm.a * 1000));
	}

	function onMapPointerMove(event: PointerEvent) {
		if (event.pointerType !== 'mouse') return;
		hoverIdx = nodeAtPointer(event, MOUSE_REACH_PX);
	}

	// Mouse: a click opens the nearest node. Touch and pen: the first tap selects
	// the nearest node, and a second tap on the same node opens it.
	function onMapClick(event: MouseEvent) {
		const mouse = lastPointerType === 'mouse';
		const index = nodeAtPointer(event, mouse ? MOUSE_REACH_PX : TOUCH_REACH_PX);
		if (index < 0) {
			if (!mouse) focusIdx = -1;
			return;
		}
		if (mouse) openNode(index, event.metaKey || event.ctrlKey);
		else if (focusIdx === index) openNode(index);
		else focusIdx = index;
	}

	async function focusNode(index: number) {
		focusIdx = index;
		await tick();
		mapElement?.querySelector<SVGAElement>(`[data-node-index="${index}"]`)?.focus();
	}

	function onNodeKey(event: KeyboardEvent, index: number) {
		if (!scene) return;
		const direction = ARROWS[event.key];
		if (direction) {
			event.preventDefault();
			const next = neighborInDirection(scene, index, direction);
			if (next >= 0) void focusNode(next);
		} else if (event.key === 'Enter') {
			// Chromium does not activate a focused SVG <a> on Enter.
			event.preventDefault();
			openNode(index);
		} else if (event.key === 'Home' || event.key === 'End') {
			event.preventDefault();
			const order = [...scene.nodes].sort((a, b) => a.y * 2 + a.x - (b.y * 2 + b.x));
			const target = event.key === 'Home' ? order[0] : order[order.length - 1];
			if (target) void focusNode(target.index);
		} else if (event.key === 'Escape') {
			event.preventDefault();
			focusIdx = -1;
			hoverIdx = -1;
		}
	}

	// ?focus=<slug> opens the map on that post once, as on the #288 project map.
	let appliedFocus: string | null = null;
	$effect(() => {
		if (!scene || !focusSlug || appliedFocus === focusSlug) return;
		const index = scene.bySlug.get(focusSlug);
		if (index === undefined) return;
		appliedFocus = focusSlug;
		view = 'map';
		void focusNode(index);
	});
</script>

<section class="constellation" aria-labelledby="constellation-heading">
	<div class="constellation-heading">
		<div>
			<p class="eyebrow">A map of what’s public</p>
			<h2 id="constellation-heading" class="font-heading text-2xl font-bold">The constellation</h2>
			<p class="intro">Follow a thread into the full post, or keep scrolling through the reader.</p>
		</div>
		{#if scene && scene.nodes.length > 0}
			<div class="controls">
				<button type="button" aria-pressed={view === 'map'} onclick={() => view = 'map'}>Map</button>
				<button type="button" aria-pressed={view === 'list'} onclick={() => view = 'list'}>List</button>
				<a href="#latest">Skip to Latest ↓</a>
			</div>
		{/if}
	</div>

	{#if scene && scene.nodes.length > 0}
		<div class="projection" data-testid="posts-projection">
			<p class="projection-note">
				{scene.note} Placed {scene.nodes.length} public posts.
				{#if scene.unplaced.length > 0}{scene.unplaced.length} newer {scene.unplaced.length === 1 ? 'post is' : 'posts are'} not on the map yet; the list below has {scene.unplaced.length === 1 ? 'it' : 'them'}.{/if}
			</p>
			{#if view === 'map'}
				<p class="projection-help" id="projection-help">Point at a dot to see its title and click to open the post. On a touch screen, tap a dot to select it, then tap it again or use Open post. With a keyboard, tab into the map and use the arrow keys to move between nearby posts. Home and End jump to the first and last post. Enter opens a post. Escape clears the selection.</p>
				<!-- Pointers select by nearest centre (TIN-8628). Keyboard users get the roving tab stop on the nodes. -->
				<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_noninteractive_element_interactions -->
				<svg
					bind:this={mapElement}
					class="projection-map"
					class:pointing={hoverIdx >= 0}
					viewBox="0 0 1000 1000"
					role="group"
					aria-label="Similarity map of public posts"
					aria-describedby="projection-help"
					onpointerdown={(event) => (lastPointerType = event.pointerType || 'mouse')}
					onpointermove={onMapPointerMove}
					onpointerleave={() => (hoverIdx = -1)}
					onclick={onMapClick}
				>
					<g class="projection-edges" aria-hidden="true">
						{#each scene.edges as [a, b] (`${a}:${b}`)}
							<line
								class:active={a === activeIdx || b === activeIdx}
								x1={scene.nodes[a].x * 1000}
								y1={scene.nodes[a].y * 1000}
								x2={scene.nodes[b].x * 1000}
								y2={scene.nodes[b].y * 1000}
							/>
						{/each}
					</g>
					<g class="projection-nodes">
						{#each scene.nodes as node (node.slug)}
							<a
								href={node.href}
								data-node-index={node.index}
								data-slug={node.slug}
								tabindex={node.index === tabIndexOwner ? 0 : -1}
								aria-label={`${node.title} (${node.date.slice(0, 10)})`}
								class:active={node.index === activeIdx}
								class:neighbour={activeNeighbours.has(node.index)}
								onfocus={() => (focusIdx = node.index)}
								onkeydown={(event) => onNodeKey(event, node.index)}
							>
								<circle cx={node.x * 1000} cy={node.y * 1000} r="18" class="hit" />
								<circle cx={node.x * 1000} cy={node.y * 1000} r="7" class="dot" />
							</a>
						{/each}
					</g>
				</svg>
				<div class="projection-detail" aria-live="polite" data-testid="posts-projection-detail">
					{#if activeNode}
						<p><strong>{activeNode.title}</strong> · <time datetime={activeNode.date}>{activeNode.date.slice(0, 10)}</time></p>
						<p><a class="open-post" href={activeNode.href} aria-label={`Open post: ${activeNode.title}`} data-testid="posts-projection-open">Open post →</a></p>
						{#if neighboursOf(scene, activeNode.index).length > 0}
							<p>Near: {#each neighboursOf(scene, activeNode.index) as near, i (near.slug)}{i > 0 ? ', ' : ''}<a href={near.href}>{near.title}</a>{/each}</p>
						{/if}
					{:else}
						<p>Select a point to see the post and its nearest neighbours.</p>
					{/if}
				</div>
			{:else}
				<ol class="similar-list" aria-label="Public posts with their most similar posts">
					{#each listOrder as node (node.slug)}
						<li>
							<a href={node.href}>{node.title}</a> <time datetime={node.date}>{node.date.slice(0, 10)}</time>
							{#if neighboursOf(scene, node.index).length > 0}
								<span class="near">Near: {#each neighboursOf(scene, node.index) as near, i (near.slug)}{i > 0 ? ', ' : ''}<a href={near.href}>{near.title}</a>{/each}</span>
							{/if}
						</li>
					{/each}
				</ol>
			{/if}
		</div>
	{:else}
		<p class="empty">No public post is on the map yet. The Latest and Archive lists below have every public post.</p>
	{/if}
	<details class="reviewed-pulse"><summary>Reviewed public Pulse details</summary><div id="experimental-pulse"><PulseFeed {snapshot} /></div></details>
</section>

<style>
	.constellation { margin-bottom: 4rem; }
	.constellation-heading { display: flex; flex-wrap: wrap; align-items: end; justify-content: space-between; gap: 1rem; margin-bottom: 1.25rem; }
	.eyebrow { font-family: 'Inter', sans-serif; font-size: .7rem; font-weight: 600; letter-spacing: .11em; text-transform: uppercase; color: var(--color-primary-500); margin-bottom: .45rem; }
	.intro { margin-top: .35rem; opacity: .75; max-width: 60ch; }
	.controls { display: flex; flex-wrap: wrap; align-items: center; gap: .6rem 1rem; font-family: 'Inter', sans-serif; font-size: .78rem; }
	.controls a { text-decoration: underline; text-underline-offset: .2em; }
	.controls button { border: 1px solid currentColor; padding: .35rem .6rem; border-radius: .3rem; }
	.controls button[aria-pressed='true'] { color: var(--color-primary-500); }
	.controls button:focus-visible, .controls a:focus-visible { outline: 3px solid var(--color-primary-500); outline-offset: 3px; }
	.reviewed-pulse { margin-top: 1rem; }
	.reviewed-pulse summary { cursor: pointer; padding: .5rem; }
	.projection { display: grid; gap: .75rem; }
	.projection-note, .projection-help { font-family: 'Inter', sans-serif; font-size: .8rem; opacity: .8; max-width: 60ch; }
	.projection-map { display: block; touch-action: manipulation; -webkit-tap-highlight-color: transparent; width: 100%; max-width: 42rem; aspect-ratio: 1 / 1; margin-inline: auto; border: 1px solid currentColor; background: color-mix(in srgb, currentColor 3%, transparent); }
	.projection-edges line { stroke: currentColor; stroke-opacity: .18; stroke-width: 2; }
	.projection-edges line.active { stroke: var(--color-primary-500); stroke-opacity: .9; stroke-width: 3; }
	/* The hit circle only draws the focus ring. The map picks the nearest node for pointers. */
	.projection-nodes .hit { fill: transparent; }
	.projection-nodes a { pointer-events: none; }
	.projection-map.pointing { cursor: pointer; }
	.projection-nodes .dot { fill: var(--color-surface-50); stroke: var(--color-primary-500); stroke-width: 3; }
	:global([data-mode='dark']) .projection-nodes .dot { fill: var(--color-surface-950); }
	.projection-nodes a.neighbour .dot { fill: color-mix(in srgb, var(--color-primary-500) 35%, transparent); }
	.projection-nodes a.active .dot { fill: var(--color-primary-500); r: 11; }
	.projection-nodes a:focus { outline: none; }
	.projection-nodes a:focus-visible .hit { stroke: var(--color-primary-500); stroke-width: 4; }
	.projection-detail { min-height: 3.5rem; padding: .75rem 1rem; border: 1px solid currentColor; font-family: 'Inter', sans-serif; font-size: .85rem; overflow-wrap: anywhere; }
	.projection-detail .open-post { display: inline-block; margin-top: .4rem; padding: .45rem .8rem; border: 1px solid var(--color-primary-500); border-radius: .3rem; font-weight: 600; text-decoration: none; }
	.projection-detail a, .similar-list a { text-decoration: underline; text-underline-offset: .2em; }
	.projection-detail a:focus-visible, .similar-list a:focus-visible { outline: 3px solid var(--color-primary-500); outline-offset: 3px; }
	.similar-list { display: grid; gap: .6rem; padding: 1rem 1rem 1rem 2.25rem; border: 1px solid currentColor; list-style: decimal; overflow-wrap: anywhere; }
	.similar-list time { font-size: .75rem; opacity: .7; }
	.similar-list .near { display: block; font-size: .8rem; opacity: .85; }
	.empty { padding: 1.5rem; border: 1px solid currentColor; }
	@media (max-width: 600px) {
		/* At ~360px the 1000-unit viewBox shrinks points to ~5px. Touch reach comes from nearest-node selection, not from larger hit circles. */
		.projection-nodes .hit { r: 26; }
		.projection-nodes .dot { r: 10; stroke-width: 4; }
		.projection-nodes a.active .dot { r: 15; }
		.projection-edges line { stroke-width: 3; }
		.projection-edges line.active { stroke-width: 5; }
		.projection-nodes a:focus-visible .hit { stroke-width: 6; }
	}
</style>
