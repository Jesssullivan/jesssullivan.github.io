<script lang="ts">
	import { tick } from 'svelte';
	import type { Post } from '#lib/posts.js';
	import type { PublicPulseSnapshotAny } from '#lib/pulse/snapshot.js';
	import type { ReaderCollection } from '#lib/reader/collection.js';
	import PulseFeed from '#lib/components/pulse/PulseFeed.svelte';
	// Build-time import (TIN-5680): the projection ships in this bundle, never fetched at runtime.
	import postsProjection from '#lib/data/posts-projection.v1.json';
	import {
		buildScene,
		firstInReadingOrder,
		neighborInDirection,
		neighboursOf,
		type Direction,
	} from '#lib/reader/projection/scene.js';

	type View = 'constellation' | 'map' | 'similar' | 'tree';

	let {
		posts,
		snapshot,
		archive = [],
		focusSlug = null,
		initialView = 'constellation',
	}: {
		posts: Post[];
		snapshot: PublicPulseSnapshotAny;
		archive?: ReaderCollection['archive'];
		focusSlug?: string | null;
		initialView?: View;
	} = $props();
	// svelte-ignore state_referenced_locally
	let view = $state<View>(initialView);

	const nodes = $derived([
		...posts.slice(0, 4).map((post) => ({
			id: `post-${post.slug}`,
			kind: 'Post',
			date: post.date,
			title: post.title,
				href: `/blog/${post.slug}`,
		})),
		...snapshot.items.slice(0, 2).map((item) => ({
			id: `pulse-${item.id}`,
			kind: item.kind === 'bird_sighting' ? 'Bird sighting' : 'Pulse note',
			date: item.occurredAt,
			title: item.summary || (item.kind === 'bird_sighting' ? item.birdSighting?.commonName : item.content) || 'Pulse',
				href: '/pulse',
		})),
	]);

	// Similarity map: only posts the reader can already route to are drawn.
	const scene = $derived(buildScene(postsProjection, archive.flatMap((group) => group.posts)));
	let focusIdx = $state(-1);
	let hoverIdx = $state(-1);
	let mapElement = $state<SVGSVGElement | null>(null);
	const activeIdx = $derived(hoverIdx >= 0 ? hoverIdx : focusIdx);
	const activeNode = $derived(scene && activeIdx >= 0 ? scene.nodes[activeIdx] : null);
	const activeNeighbours = $derived(scene && activeIdx >= 0 ? new Set(scene.adjacency[activeIdx]) : new Set<number>());
	const tabIndexOwner = $derived(scene ? (focusIdx >= 0 ? focusIdx : firstInReadingOrder(scene)) : -1);
	const similarList = $derived(
		scene ? [...scene.nodes].sort((a, b) => b.date.localeCompare(a.date) || a.slug.localeCompare(b.slug)) : [],
	);

	const ARROWS: Record<string, Direction> = { ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down' };

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
			// Chromium does not activate a focused SVG <a> on Enter; hand the router a click.
			event.preventDefault();
			event.currentTarget?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
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
		<div class="controls">
			<button type="button" aria-pressed={view === 'constellation'} onclick={() => view = 'constellation'}>Constellation</button>
			{#if scene && scene.nodes.length > 0}
				<button type="button" aria-pressed={view === 'map'} onclick={() => view = 'map'}>Similarity map</button>
				<button type="button" aria-pressed={view === 'similar'} onclick={() => view = 'similar'}>Similar posts</button>
			{/if}
			<button type="button" aria-pressed={view === 'tree'} onclick={() => view = 'tree'}>Year tree</button>
			<input id="constellation-pause" class="motion-toggle" type="checkbox" />
			<label for="constellation-pause">Pause motion</label>
			<a href="#latest">Browse as a list ↓</a>
		</div>
	</div>

	{#if (view === 'map' || view === 'similar') && scene && scene.nodes.length > 0}
		<div class="projection" data-testid="posts-projection">
			<p class="projection-note">
				{scene.note} Placed {scene.nodes.length} public posts.
				{#if scene.unplaced.length > 0}{scene.unplaced.length} newer {scene.unplaced.length === 1 ? 'post is' : 'posts are'} not on the map yet; the list below has {scene.unplaced.length === 1 ? 'it' : 'them'}.{/if}
			</p>
			{#if view === 'map'}
				<p class="projection-help" id="projection-help">Tab into the map, then use the arrow keys to move between nearby posts. Enter opens a post; Escape clears the selection.</p>
				<svg
					bind:this={mapElement}
					class="projection-map"
					viewBox="0 0 1000 1000"
					role="group"
					aria-label="Similarity map of public posts"
					aria-describedby="projection-help"
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
								onpointerenter={() => (hoverIdx = node.index)}
								onpointerleave={() => (hoverIdx = -1)}
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
						<p><a href={activeNode.href}><strong>{activeNode.title}</strong></a> · <time datetime={activeNode.date}>{activeNode.date.slice(0, 10)}</time></p>
						{#if neighboursOf(scene, activeNode.index).length > 0}
							<p>Near: {#each neighboursOf(scene, activeNode.index) as near, i (near.slug)}{i > 0 ? ', ' : ''}<a href={near.href}>{near.title}</a>{/each}</p>
						{/if}
					{:else}
						<p>Select a point to see the post and its nearest neighbours.</p>
					{/if}
				</div>
			{:else}
				<ol class="similar-list" aria-label="Public posts with their most similar posts">
					{#each similarList as node (node.slug)}
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
	{:else if view === 'tree'}
		<ul class="year-tree" aria-label="Public writing by year">
			{#each archive as group (group.year)}
				<li><details><summary>{group.year} · {group.posts.length} posts</summary>
					<ul>{#each group.posts as post (post.slug)}<li><a href={`/blog/${post.slug}`}>{post.title}</a></li>{/each}</ul>
				</details></li>
			{/each}
		</ul>
	{:else if nodes.length > 0}
		<ol class="constellation-field" aria-label="Recent public writing and notes">
			{#each nodes as node (node.id)}
				<li class="constellation-node">
					<a href={node.href} aria-label={`${node.kind}: ${node.title}`}>
						<span class="node-marker" aria-hidden="true"></span>
						<span class="node-copy">
							<span class="node-meta">{node.kind} · <time datetime={node.date}>{node.date.slice(0, 10)}</time></span>
							<strong>{node.title}</strong>
						</span>
					</a>
				</li>
			{/each}
		</ol>
	{:else}
		<p class="empty">No public writing or notes yet. The list below will appear when there is something to read.</p>
	{/if}
	<details class="reviewed-pulse"><summary>Reviewed public Pulse details</summary><div id="experimental-pulse"><PulseFeed {snapshot} /></div></details>
</section>

<style>
	.constellation { margin-bottom: 4rem; }
	.constellation-heading { display: flex; flex-wrap: wrap; align-items: end; justify-content: space-between; gap: 1rem; margin-bottom: 1.25rem; }
	.eyebrow, .node-meta { font-family: 'Inter', sans-serif; font-size: .7rem; font-weight: 600; letter-spacing: .11em; text-transform: uppercase; }
	.eyebrow { color: var(--color-primary-500); margin-bottom: .45rem; }
	.intro { margin-top: .35rem; opacity: .75; }
	.controls { display: flex; flex-wrap: wrap; align-items: center; gap: .6rem 1rem; font-family: 'Inter', sans-serif; font-size: .78rem; }
	.controls a { text-decoration: underline; text-underline-offset: .2em; }
	.controls button { border: 1px solid currentColor; padding: .35rem .6rem; border-radius: .3rem; }
	.controls button[aria-pressed='true'] { color: var(--color-primary-500); }
	.controls button:focus-visible, .year-tree a:focus-visible, .year-tree summary:focus-visible { outline: 3px solid var(--color-primary-500); outline-offset: 3px; }
	.year-tree { padding: 1rem; border: 1px solid currentColor; }
	.year-tree summary { cursor: pointer; padding: .5rem; }
	.year-tree ul { margin-left: 1.25rem; border-left: 1px solid currentColor; padding-left: 1rem; }
	.year-tree a { display: inline-block; padding: .4rem; text-decoration: underline; }
	.motion-toggle { width: 1rem; height: 1rem; accent-color: var(--color-primary-500); }
	.motion-toggle:focus-visible, .controls a:focus-visible, .constellation-node a:focus-visible { outline: 3px solid var(--color-primary-500); outline-offset: 3px; }
	.motion-toggle + label { cursor: pointer; margin-left: -.7rem; }
	.constellation-field { position: relative; display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: .8rem; padding: 1.25rem; border: 1px solid currentColor; background: color-mix(in srgb, currentColor 3%, transparent); isolation: isolate; }
	.constellation-field::before { content: ''; position: absolute; inset: 1.8rem; border: 1px dashed currentColor; opacity: .2; transform: skewY(-8deg); pointer-events: none; z-index: -1; }
	.constellation-node { min-width: 0; animation: float 6s ease-in-out infinite alternate; }
	.constellation-node:nth-child(even) { animation-delay: -3s; }
	.constellation-node a { display: flex; align-items: flex-start; gap: .8rem; min-height: 6.5rem; padding: 1rem; border: 1px solid currentColor; background: var(--color-surface-50); text-decoration: none; transition: border-color .15s ease, transform .15s ease; }
	:global([data-mode='dark']) .constellation-node a { background: var(--color-surface-950); }
	.constellation-node a:hover { transform: translateY(-2px); border-color: var(--color-primary-500); }
	.node-marker { flex: none; width: .65rem; height: .65rem; margin-top: .25rem; border: 2px solid var(--color-primary-500); border-radius: 50%; box-shadow: 0 0 0 .24rem color-mix(in srgb, var(--color-primary-500) 18%, transparent); }
	.node-copy { display: grid; gap: .4rem; min-width: 0; }
	.reviewed-pulse { margin-top: 1rem; }
	.projection { display: grid; gap: .75rem; }
	.projection-note, .projection-help { font-family: 'Inter', sans-serif; font-size: .8rem; opacity: .8; max-width: 60ch; }
	.projection-map { display: block; width: 100%; max-width: 42rem; aspect-ratio: 1 / 1; margin-inline: auto; border: 1px solid currentColor; background: color-mix(in srgb, currentColor 3%, transparent); }
	.projection-edges line { stroke: currentColor; stroke-opacity: .18; stroke-width: 2; }
	.projection-edges line.active { stroke: var(--color-primary-500); stroke-opacity: .9; stroke-width: 3; }
	.projection-nodes .hit { fill: transparent; }
	.projection-nodes .dot { fill: var(--color-surface-50); stroke: var(--color-primary-500); stroke-width: 3; }
	:global([data-mode='dark']) .projection-nodes .dot { fill: var(--color-surface-950); }
	.projection-nodes a.neighbour .dot { fill: color-mix(in srgb, var(--color-primary-500) 35%, transparent); }
	.projection-nodes a.active .dot, .projection-nodes a:hover .dot { fill: var(--color-primary-500); r: 11; }
	.projection-nodes a:focus { outline: none; }
	.projection-nodes a:focus-visible .hit { stroke: var(--color-primary-500); stroke-width: 4; }
	.projection-detail { min-height: 3.5rem; padding: .75rem 1rem; border: 1px solid currentColor; font-family: 'Inter', sans-serif; font-size: .85rem; }
	.projection-detail a, .similar-list a { text-decoration: underline; text-underline-offset: .2em; }
	.projection-detail a:focus-visible, .similar-list a:focus-visible { outline: 3px solid var(--color-primary-500); outline-offset: 3px; }
	.similar-list { display: grid; gap: .6rem; padding: 1rem 1rem 1rem 2.25rem; border: 1px solid currentColor; list-style: decimal; }
	.similar-list time { font-size: .75rem; opacity: .7; }
	.similar-list .near { display: block; font-size: .8rem; opacity: .85; }
	.reviewed-pulse summary { cursor: pointer; padding: .5rem; }
	.node-meta { opacity: .7; }
	.node-copy strong { font-family: 'Inter', sans-serif; font-size: .95rem; line-height: 1.3; }
	.empty { padding: 1.5rem; border: 1px solid currentColor; }
	.constellation:has(.motion-toggle:checked) .constellation-node,
	.constellation:has(.constellation-field:hover) .constellation-node,
	.constellation:has(.constellation-field:focus-within) .constellation-node { animation-play-state: paused; }
	@keyframes float { from { translate: 0 0; } to { translate: 0 -.25rem; } }
	@media (min-width: 850px) {
		.constellation-field { grid-template-columns: repeat(6, minmax(0, 1fr)); gap: 1rem; min-height: 20rem; }
		.constellation-node { grid-column: span 2; }
		.constellation-node:nth-child(4n + 2) { grid-column: 4 / span 2; }
		.constellation-node:nth-child(4n + 3) { grid-column: 2 / span 2; }
	}
	@media (max-width: 600px) {
		.constellation-field { display: block; padding: .75rem; }
		.constellation-field::before { display: none; }
		.constellation-node + .constellation-node { margin-top: .7rem; }
		.constellation-node { animation: none; }
		.constellation-node a { min-height: 4.5rem; }
		.motion-toggle, .motion-toggle + label { display: none; }
		/* At ~360px the 1000-unit viewBox shrinks points to ~5px and hit areas to ~13px; keep a 24px target (WCAG 2.5.8). */
		.projection-nodes .hit { r: 36; }
		.projection-nodes .dot { r: 10; stroke-width: 4; }
		.projection-nodes a.active .dot, .projection-nodes a:hover .dot { r: 15; }
		.projection-edges line { stroke-width: 3; }
		.projection-edges line.active { stroke-width: 5; }
		.projection-nodes a:focus-visible .hit { stroke-width: 6; }
	}
	@media (prefers-reduced-motion: reduce) {
		.constellation-node { animation: none; }
		.constellation-node a { transition: none; }
	}
</style>
