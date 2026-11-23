<script lang="ts">
	// The constellation section (TIN-8628). This shell is all the page loads up front:
	// the heading, the legend, a panel that already has its final size, and the stars
	// as a static silhouette. The interactive sky and its data arrive on their own.
	// Type is Inter at 600 and 700 and the body face: the files the home page already loads.
	import { onMount } from 'svelte';
	import type { Component } from 'svelte';
	import type { PublicPulseSnapshotAny } from '$lib/pulse/snapshot';
	import type { ReaderCollection } from '$lib/reader/collection';
	import PulseFeed from '$lib/components/pulse/PulseFeed.svelte';
	import silhouette from '$lib/data/constellation-silhouette.v1.json';
	// A content hash is in the emitted file name, so the data can be cached for good.
	import dataUrl from '$lib/data/constellation.v1.json?url';
	import { readSession, writeSession } from '$lib/reader/projection/session';
	import { STAR_RADIUS } from '$lib/reader/projection/view';

	// The section opens on the map. The list carries the same posts and neighbours for readers who cannot use the map (RM27).
	type View = 'map' | 'list';
	const VIEWS: View[] = ['map', 'list'];
	// Below this width the map is drawn transposed, as a tall panel. The style block repeats both values.
	const TALL_QUERY = '(max-width: 720px)';
	const TALL_SCALE = 0.85;

	let {
		snapshot,
		archive = [],
		focusSlug = null,
		initialView = 'map',
		arrives = false,
	}: {
		snapshot: PublicPulseSnapshotAny;
		archive?: ReaderCollection['archive'];
		focusSlug?: string | null;
		initialView?: View;
		/** True when the section is put into a page that has already painted, as the flag does today. */
		arrives?: boolean;
	} = $props();
	// svelte-ignore state_referenced_locally
	let view = $state<View>(initialView);
	let filter = $state(-1);
	let helpOpen = $state(false);
	let section = $state<HTMLElement | null>(null);
	let panel = $state<HTMLDivElement | null>(null);
	let field = $state<HTMLDivElement | null>(null);
	let help = $state<HTMLDivElement | null>(null);
	let tabs = $state<HTMLDivElement | null>(null);

	const posts = $derived(archive.flatMap((group) => group.posts));
	const frames = [
		{ name: 'wide', paths: silhouette.wide as Array<[number, number, string]> },
		{ name: 'tall', paths: silhouette.tall as Array<[number, number, string]> },
	];

	// The interactive layer: code and data, fetched once the panel is near the viewport or the browser is idle.
	let Sky = $state<Component<Record<string, unknown>> | null>(null);
	let data = $state<unknown>(null);
	let live = $state(false);
	let failed = $state(false);
	let requested = false;

	async function load() {
		if (requested) return;
		requested = true;
		try {
			const [module, response] = await Promise.all([import('./ConstellationSky.svelte'), fetch(dataUrl)]);
			if (!response.ok) throw new Error(`constellation data: ${response.status}`);
			data = await response.json();
			Sky = module.default as unknown as Component<Record<string, unknown>>;
		} catch {
			failed = true;
		}
	}

	/**
	 * The flag is read after the page has painted, so the section cannot be in the first paint.
	 * It opens the space it needs without a jump: what follows it starts where it was and slides
	 * down as the section fades in. Reduced motion gets the section at once. A page that is
	 * scrolled past this point is held still by the browser and needs nothing.
	 */
	function unfold() {
		const below = section?.nextElementSibling;
		if (!section || !(below instanceof HTMLElement) || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
		const pushed = below.getBoundingClientRect().top - section.getBoundingClientRect().top;
		if (pushed <= 0 || below.getBoundingClientRect().top - pushed < 0) return;
		const timing = { duration: 320, easing: 'cubic-bezier(.2, .7, .2, 1)' };
		below.animate([{ transform: `translateY(${-pushed}px)` }, { transform: 'translateY(0)' }], timing);
		section.animate([{ opacity: 0 }, { opacity: 1 }], timing);
	}

	onMount(() => {
		if (arrives) unfold();
		const session = readSession();
		if (session.list && !focusSlug) view = 'list';
		if (session.category) filter = silhouette.categories.findIndex((category) => category.id === session.category);
		const near = new IntersectionObserver((entries) => entries.some((entry) => entry.isIntersecting) && void load(), { rootMargin: '600px 0px' });
		if (panel) near.observe(panel);
		const idle = window.requestIdleCallback ? window.requestIdleCallback(() => void load(), { timeout: 4000 }) : window.setTimeout(() => void load(), 2500);
		return () => {
			near.disconnect();
			if (window.cancelIdleCallback) window.cancelIdleCallback(idle);
			else window.clearTimeout(idle);
		};
	});

	function show(next: View) {
		view = next;
		writeSession({ list: next === 'list' });
	}

	function onTabKey(event: KeyboardEvent) {
		const step = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0;
		if (!step) return;
		event.preventDefault();
		show(VIEWS[(VIEWS.indexOf(view) + step + VIEWS.length) % VIEWS.length]);
		tabs?.querySelector<HTMLElement>(`#constellation-tab-${view}`)?.focus();
	}

	function toggleFilter(index: number) {
		filter = filter === index ? -1 : index;
		writeSession({ category: filter < 0 ? null : silhouette.categories[filter].id });
	}

	// ?focus=<slug> always opens on the map.
	$effect(() => {
		if (focusSlug) view = 'map';
	});
</script>

<svelte:window
	onclick={(event) => {
		if (helpOpen && help && event.target instanceof Node && !help.contains(event.target)) helpOpen = false;
	}}
	onkeydown={(event) => {
		if (helpOpen && event.key === 'Escape') helpOpen = false;
	}}
/>

<section class="constellation" aria-labelledby="constellation-heading" bind:this={section}>
	<header>
		<div>
			<h2 id="constellation-heading" class="font-heading text-2xl font-bold">The constellation</h2>
			<p class="lede" id="constellation-lede">Each star is a post. Posts that share words or tags sit together.</p>
		</div>
		<!-- First in the tab order, so the list is one tab stop away. -->
		<div class="tabs" role="tablist" aria-label="View" bind:this={tabs}>
			{#each VIEWS as name (name)}
				<button
					type="button"
					role="tab"
					id={`constellation-tab-${name}`}
					aria-selected={view === name}
					aria-controls="constellation-panel"
					tabindex={view === name ? 0 : -1}
					onclick={() => show(name)}
					onkeydown={onTabKey}>{name === 'map' ? 'Map' : 'List'}</button
				>
			{/each}
		</div>
	</header>

	<ul class="legend" aria-label="Show one category">
		{#each silhouette.categories as category, index (category.id)}
			<li>
				<button type="button" aria-pressed={filter === index} onclick={() => toggleFilter(index)}>
					<span class="dot" style={`--dot:var(--star-${index % 8})`} aria-hidden="true"></span>{category.label}
					<span class="count">{category.count}</span>
				</button>
			</li>
		{/each}
	</ul>

	<div class="panel" class:live class:listing={view === 'list' && Sky !== null} id="constellation-panel" role="tabpanel" aria-labelledby={`constellation-tab-${view}`} bind:this={panel} data-testid="constellation-panel">
		<div class="help" bind:this={help}>
			<button type="button" aria-expanded={helpOpen} aria-controls="constellation-help" onclick={() => (helpOpen = !helpOpen)}>How it works</button>
			<div class="pop" id="constellation-help" hidden={!helpOpen}>
				<p>Colour is the category. Bigger stars are longer posts. The newest ones glow.</p>
				<p>Click or tap a star to pick it, then again to open it. Click a name to go there.</p>
				<p>Zoom with the buttons, a pinch, or Ctrl and scroll. Drag to move the map. On a touch screen a swipe up or down scrolls the page, so move the map sideways or with two fingers.</p>
				<p>With a keyboard, arrow keys move between nearby stars. Enter opens. Escape clears. Plus and minus zoom.</p>
				<p class="method">Positions come from a t-SNE fit over post text and tags. Axes, distances and density are not measurements.</p>
			</div>
		</div>
		<div class="field" bind:this={field}>
			{#each frames as frame (frame.name)}
				<svg class={`silhouette ${frame.name}`} viewBox="0 0 1000 1000" preserveAspectRatio="none" aria-hidden="true" focusable="false" data-testid={`constellation-silhouette-${frame.name}`}>
					{#each frame.paths as [category, size, d] (`${category}:${size}`)}
						<path {d} style={`stroke:var(--star-${category % 8});stroke-width:calc(var(--star-scale) * ${STAR_RADIUS[size] * 2}px)`} />
					{/each}
				</svg>
			{/each}
		</div>
		{#if Sky}
			<Sky {data} {posts} {field} {view} {filter} {focusSlug} tallQuery={TALL_QUERY} tallScale={TALL_SCALE} onlive={(fade: boolean) => (fade ? window.setTimeout(() => (live = true), 280) : (live = true))} />
		{:else if failed}
			<p class="notice">The map did not load. Latest and Archive below have every post.</p>
		{/if}
	</div>

	<details class="reviewed-pulse"><summary>Reviewed public Pulse details</summary><div id="experimental-pulse"><PulseFeed {snapshot} /></div></details>
</section>

<style>
	/* Every colour is a theme token or a mix of theme tokens. Star hues turn around the wheel from the theme's primary. */
	.constellation {
		--sky-dark: 0;
		--sky-ink: var(--color-surface-950);
		--sky-paper: var(--color-root-bg-light);
		--sky-card: var(--color-surface-100);
		--sky-accent: var(--color-primary-700);
		--star-la: 0.42;
		--star-lb: 0.54;
		--star-c: 0.15;
		--star-scale: 1;
		--star-0: var(--color-primary-700);
		--star-1: var(--star-0); --star-2: var(--star-0); --star-3: var(--star-0);
		--star-4: var(--star-0); --star-5: var(--star-0); --star-6: var(--star-0); --star-7: var(--star-0);
		/* Quieter text, still well above 4.5 to 1 on the paper and on a card in every theme. */
		--sky-soft: color-mix(in oklab, var(--sky-ink) 86%, var(--sky-paper));
		--sky-line: color-mix(in srgb, var(--sky-ink) 24%, transparent);
		--sky-shade: color-mix(in srgb, var(--color-surface-950) 45%, transparent);
		margin-bottom: 4rem;
	}
	:global([data-mode='dark']) .constellation {
		--sky-dark: 1;
		--sky-ink: var(--color-surface-50);
		--sky-paper: var(--color-root-bg-dark);
		--sky-card: var(--color-surface-900);
		--sky-accent: var(--color-primary-300);
		--star-la: 0.86;
		--star-lb: 0.74;
		--star-c: 0.13;
		--star-0: var(--color-primary-300);
	}
	/* Neighbouring hues also differ in lightness, so two categories side by side on the wheel still tell apart. */
	@supports (color: oklch(from red l c h)) {
		.constellation {
			--star-0: oklch(from var(--color-primary-500) var(--star-la) var(--star-c) h);
			--star-1: oklch(from var(--color-primary-500) var(--star-lb) var(--star-c) calc(h + 45));
			--star-2: oklch(from var(--color-primary-500) var(--star-la) var(--star-c) calc(h + 90));
			--star-3: oklch(from var(--color-primary-500) var(--star-lb) var(--star-c) calc(h + 135));
			--star-4: oklch(from var(--color-primary-500) var(--star-la) var(--star-c) calc(h + 180));
			--star-5: oklch(from var(--color-primary-500) var(--star-lb) var(--star-c) calc(h + 225));
			--star-6: oklch(from var(--color-primary-500) var(--star-la) var(--star-c) calc(h + 270));
			--star-7: oklch(from var(--color-primary-500) var(--star-lb) var(--star-c) calc(h + 315));
		}
	}

	header { display: flex; flex-wrap: wrap; align-items: end; justify-content: space-between; gap: .75rem 1.5rem; }
	.lede { margin-top: .3rem; max-width: 60ch; }
	.tabs { display: flex; font: 600 .78rem/1 'Inter', system-ui, sans-serif; border: 1px solid var(--sky-line); }
	.tabs button { min-width: 4rem; padding: .55rem .9rem; cursor: pointer; }
	.tabs button[aria-selected='true'] { color: var(--sky-paper); background: var(--sky-ink); }

	.legend { display: flex; flex-wrap: wrap; gap: .1rem; margin: .9rem 0 .25rem -.45rem; font: 600 .72rem/1 'Inter', system-ui, sans-serif; }
	.legend button { display: inline-flex; align-items: center; gap: .38rem; min-height: 1.75rem; padding: 0 .45rem; border: 1px solid transparent; cursor: pointer; }
	.legend button:hover { border-color: var(--sky-line); }
	.legend button[aria-pressed='true'] { border-color: currentColor; font-weight: 700; }
	.dot { width: .6rem; height: .6rem; border-radius: 50%; flex: none; background: var(--dot); box-shadow: inset 0 0 0 2px var(--dot); }
	/* While one category is picked the others keep their text and show a hollow dot. */
	.legend:has([aria-pressed='true']) button[aria-pressed='false'] .dot { background: none; }
	.count { font-variant-numeric: tabular-nums; }

	/* The help sits in the top corner of the panel, above the map. Its text is in the body face, as the lede is. */
	.help { position: absolute; top: .55rem; right: .75rem; z-index: 3; }
	.help > button { min-height: 1.75rem; padding: 0 .3rem; background: var(--sky-paper); font: 600 .72rem/1 'Inter', system-ui, sans-serif; color: var(--sky-soft); text-decoration: underline; text-decoration-color: var(--sky-line); text-underline-offset: .25em; cursor: pointer; white-space: nowrap; }
	.help > button:hover, .help > button[aria-expanded='true'] { color: var(--sky-ink); }
	.pop { position: absolute; right: 0; top: calc(100% + .3rem); width: min(22rem, calc(100vw - 3.5rem)); padding: .9rem 1rem; display: grid; gap: .5rem; font-size: .9rem; line-height: 1.35; color: var(--sky-ink); background: var(--sky-card); border: 1px solid var(--sky-line); box-shadow: 0 16px 36px -16px var(--sky-shade); }
	.pop[hidden] { display: none; }
	.pop .method { padding-top: .55rem; border-top: 1px solid var(--sky-line); color: var(--sky-soft); }

	:is(.tabs, .legend, .help) button:focus-visible, .reviewed-pulse summary:focus-visible { outline: 2px solid var(--sky-accent); outline-offset: 2px; }

	/* The panel has its final size before anything loads. Nothing inside it changes that size. */
	.panel { position: relative; height: clamp(24rem, 66vh, 40rem); color: var(--sky-ink); }
	/* The sky has no box and no edge: two soft tints that end inside the panel, over the page itself. */
	.panel::before {
		content: '';
		position: absolute;
		inset: 0;
		pointer-events: none;
		background:
			radial-gradient(closest-side ellipse at 32% 40%, color-mix(in oklab, var(--color-primary-500) 14%, transparent), transparent),
			radial-gradient(closest-side ellipse at 70% 62%, color-mix(in oklab, var(--color-tertiary-500) 12%, transparent), transparent);
	}
	/* The strip under the field holds the zoom controls, so no star sits beneath them. */
	.field { position: absolute; inset: 2.9rem 3.25rem 3.75rem; }
	.silhouette { position: absolute; inset: 0; width: 100%; height: 100%; overflow: visible; opacity: .55; }
	.silhouette.tall { display: none; }
	.silhouette path { fill: none; stroke-linecap: round; vector-effect: non-scaling-stroke; }
	.panel.live .silhouette, .panel.listing .silhouette { visibility: hidden; }
	.notice { position: absolute; left: 1rem; bottom: .8rem; font-size: .9rem; line-height: 1.3; }

	.reviewed-pulse { margin-top: 1rem; }
	.reviewed-pulse summary { cursor: pointer; padding: .5rem; }

	/* A phone: a tall panel. The controls sit above the field and the picked post below it, so nothing covers the map. */
	@media (max-width: 720px) {
		.constellation { --star-scale: .85; }
		.panel { height: clamp(30rem, 150vw, 38rem); }
		.field { inset: 3.6rem .9rem 10.5rem; }
		.help { top: .4rem; right: .25rem; }
		.help > button { min-height: 2.75rem; }
		.silhouette.wide { display: none; }
		.silhouette.tall { display: block; }
		.legend button { min-height: 2rem; }
	}
</style>
