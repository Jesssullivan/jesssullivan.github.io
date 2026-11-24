<script lang="ts">
	// The constellation section (TIN-8628). This shell is all the page loads up front:
	// a sky that already has its final size, edge to edge of the viewport, with the
	// stars as a static silhouette, a legend and five small controls laid over it.
	// The interactive sky and its data arrive on their own.
	// Type is Inter at 600 and 700 and the body face: the files the home page already loads.
	import { onMount } from 'svelte';
	import type { Component } from 'svelte';
	import type { ReaderCollection } from '$lib/reader/collection';
	import silhouette from '$lib/data/constellation-silhouette.v1.json';
	// A content hash is in the emitted file name, so the data can be cached for good.
	import dataUrl from '$lib/data/constellation.v1.json?url';
	import { readSession, writeSession } from '$lib/reader/projection/session';
	import { STAR_RADIUS, starScale } from '$lib/reader/projection/view';

	// The section opens on the map. The list carries the same posts and neighbours for readers who cannot use the map (RM27).
	type View = 'map' | 'list';
	// Up to this width the map is drawn transposed, as a tall panel, and the picked post docks at the foot. Both style blocks repeat the width.
	const TALL_QUERY = '(max-width: 880px)';

	let {
		archive = [],
		focusSlug = null,
		initialView = 'map',
		arrives = false,
	}: {
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
	let controls = $state<HTMLDivElement | null>(null);
	let help = $state<HTMLDivElement | null>(null);
	let scale = $state(1);

	const posts = $derived(archive.flatMap((group) => group.posts));
	const countText = (count: number) => `${count} ${count === 1 ? 'post' : 'posts'}`;
	const frames = [
		{ name: 'wide', paths: silhouette.wide as Array<[number, number, string]> },
		{ name: 'tall', paths: silhouette.tall as Array<[number, number, string]> },
	];

	// The interactive layer: code and data, fetched once the sky is near the viewport or the browser is idle.
	interface SkyApi {
		zoomBy: (factor: number) => void;
		reset: () => void;
	}
	type SkyComponent = Component<Record<string, unknown>, SkyApi, 'zoomed' | 'picked'>;
	let Sky = $state<SkyComponent | null>(null);
	let api = $state<SkyApi | null>(null);
	let data = $state<unknown>(null);
	let live = $state(false);
	let ready = $state(false);
	let zoomed = $state(false);
	let picked = $state(false);
	let failed = $state(false);
	let requested = false;
	const onMap = $derived(ready && view === 'map');

	async function load() {
		if (requested) return;
		requested = true;
		try {
			const [module, response] = await Promise.all([import('./ConstellationSky.svelte'), fetch(dataUrl)]);
			if (!response.ok) throw new Error(`constellation data: ${response.status}`);
			data = await response.json();
			Sky = module.default as unknown as SkyComponent;
		} catch {
			failed = true;
		}
	}

	/** The site header. On a phone the sky takes the height that is left below it. */
	let bar: HTMLElement | null = null;

	/** The profile column beside the page's main column, when the layout has one. */
	const sidebar = () => {
		const next = section?.parentElement?.nextElementSibling;
		return next instanceof HTMLElement && next.tagName === 'ASIDE' ? next : null;
	};

	/**
	 * Full bleed: the sky is as wide as the viewport, whatever column the page puts it in.
	 * The legend and the controls line up with the page's own column, and the profile
	 * column starts below the sky, so nothing lies over the stars.
	 */
	function fit() {
		const host = section?.parentElement;
		if (!section || !host || !panel) return;
		const width = document.documentElement.clientWidth;
		const left = host.getBoundingClientRect().left + host.clientLeft + (parseFloat(getComputedStyle(host).paddingLeft) || 0);
		const below = section.nextElementSibling;
		const edge = below instanceof HTMLElement ? below.getBoundingClientRect().left + (parseFloat(getComputedStyle(below).paddingLeft) || 0) : 16;
		section.style.setProperty('--bleed', `${width}px`);
		section.style.setProperty('--shift', `${-left}px`);
		section.style.setProperty('--edge', `${Math.max(12, Math.round(edge))}px`);
		if (bar) section.style.setProperty('--site-header', `${bar.getBoundingClientRect().height}px`);
		scale = starScale({ w: width, h: panel.offsetHeight });
		const aside = sidebar();
		if (aside) aside.style.paddingTop = `${section.offsetHeight}px`;
	}

	/**
	 * The flag is read after the page has painted, so the section cannot be in the first paint.
	 * It takes its full size at once and what follows it must move down. Nothing a reader is
	 * looking at jumps: what follows starts where it was and slides down as the sky fades in.
	 * With reduced motion nothing slides: what follows fades out where it was and the sky fades
	 * in. A page that is scrolled past this point is held still by the browser and needs nothing.
	 */
	function unfold() {
		if (!section) return;
		const rise = section.offsetHeight;
		const top = section.getBoundingClientRect().top;
		if (rise <= 0 || top < 0 || top >= window.innerHeight) return;
		const moved = [section.nextElementSibling, sidebar()?.firstElementChild].filter((element): element is HTMLElement => element instanceof HTMLElement);
		const from = `translateY(${-rise}px)`;
		if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
			const timing = { duration: 260, easing: 'linear' };
			for (const element of moved) {
				element.animate(
					[
						{ transform: from, opacity: 1 },
						{ transform: from, opacity: 0, offset: 0.45 },
						{ transform: 'translateY(0)', opacity: 0, offset: 0.46 },
						{ transform: 'translateY(0)', opacity: 1 },
					],
					timing,
				);
			}
			section.animate([{ opacity: 0 }, { opacity: 0, offset: 0.46 }, { opacity: 1 }], timing);
			return;
		}
		const timing = { duration: 320, easing: 'cubic-bezier(.2, .7, .2, 1)' };
		for (const element of moved) element.animate([{ transform: from }, { transform: 'translateY(0)' }], timing);
		section.animate([{ opacity: 0 }, { opacity: 1 }], timing);
	}

	onMount(() => {
		bar = document.querySelector<HTMLElement>('[data-scope="app-bar"][data-part="root"]');
		fit();
		if (arrives) unfold();
		const session = readSession();
		if (session.list && !focusSlug) view = 'list';
		if (session.category) filter = silhouette.categories.findIndex((category) => category.id === session.category);
		const host = section?.parentElement;
		const resized = new ResizeObserver(fit);
		if (host) resized.observe(host);
		// The header can change height after the fonts load.
		if (bar) resized.observe(bar);
		window.addEventListener('resize', fit);
		const near = new IntersectionObserver((entries) => entries.some((entry) => entry.isIntersecting) && void load(), { rootMargin: '600px 0px' });
		if (panel) near.observe(panel);
		const idle = window.requestIdleCallback ? window.requestIdleCallback(() => void load(), { timeout: 4000 }) : window.setTimeout(() => void load(), 2500);
		const aside = sidebar();
		return () => {
			resized.disconnect();
			window.removeEventListener('resize', fit);
			near.disconnect();
			if (aside) aside.style.paddingTop = '';
			if (window.cancelIdleCallback) window.cancelIdleCallback(idle);
			else window.clearTimeout(idle);
		};
	});

	function show(next: View) {
		view = next;
		writeSession({ list: next === 'list' });
	}

	function toggleFilter(index: number) {
		filter = filter === index ? -1 : index;
		writeSession({ category: filter < 0 ? null : silhouette.categories[filter].id });
	}

	// The controls and the legend are each one tab stop. Arrow keys move inside them.
	function rove(event: KeyboardEvent) {
		const step = event.key === 'ArrowRight' || event.key === 'ArrowDown' ? 1 : event.key === 'ArrowLeft' || event.key === 'ArrowUp' ? -1 : 0;
		if (!step) return;
		const items = Array.from((event.currentTarget as HTMLElement).querySelectorAll<HTMLButtonElement>('button'));
		const at = items.indexOf(document.activeElement as HTMLButtonElement);
		if (at < 0) return;
		event.preventDefault();
		items[(at + step + items.length) % items.length].focus();
	}

	function stop(event: FocusEvent) {
		for (const button of (event.currentTarget as HTMLElement).querySelectorAll('button')) button.tabIndex = button === event.target ? 0 : -1;
	}

	// ?focus=<slug> always opens on the map.
	$effect(() => {
		if (focusSlug) view = 'map';
	});
</script>

<svelte:window
	onclick={(event) => {
		if (helpOpen && event.target instanceof Node && !help?.contains(event.target) && !controls?.contains(event.target)) helpOpen = false;
	}}
	onkeydown={(event) => {
		if (helpOpen && event.key === 'Escape') helpOpen = false;
	}}
/>

{#snippet glyph(name: string)}
	<svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" focusable="false">
		{#if name === 'list'}
			<path d="M6 4h7.5M6 8h7.5M6 12h7.5" /><path class="dots" d="M2.6 4h.01M2.6 8h.01M2.6 12h.01" />
		{:else if name === 'map'}
			<path d="M3 12 7.2 4l5.8 4.6" /><path class="dots" d="M3 12h.01M7.2 4h.01M13 8.6h.01" />
		{:else if name === 'in'}
			<path d="M8 3v10M3 8h10" />
		{:else if name === 'out'}
			<path d="M3 8h10" />
		{:else if name === 'reset'}
			<path d="M3.4 8.6a4.6 4.6 0 1 0 1.2-3.7M3 2.6v2.8h2.8" />
		{:else}
			<path d="M5.9 6.1a2.1 2.1 0 1 1 3.2 1.8c-.7.45-1.1.9-1.1 1.7" /><path class="dots" d="M8 12.4h.01" />
		{/if}
	</svg>
{/snippet}

<section class="constellation" class:live class:listing={view === 'list' && Sky !== null} class:picked aria-labelledby="constellation-heading" bind:this={section} style:--star-scale={scale}>
	<!-- The landmark keeps its name. Nothing is printed above the sky. -->
	<h2 id="constellation-heading" class="sr-only">The constellation</h2>
	<div class="sky" id="constellation-panel" bind:this={panel} data-testid="constellation-panel">
		<!-- First in the tab order, so the list is one tab stop away. A control that cannot act yet stays focusable and says so. -->
		<div class="controls" role="toolbar" aria-label="Map controls" tabindex="-1" bind:this={controls} onkeydown={rove} onfocusin={stop}>
			<button type="button" tabindex="0" aria-label={view === 'map' ? 'Show as a list' : 'Show the map'} aria-controls="constellation-panel" data-testid="constellation-view" onclick={() => show(view === 'map' ? 'list' : 'map')}>{@render glyph(view === 'map' ? 'list' : 'map')}</button>
			<button type="button" class="apart" tabindex="-1" aria-label="Zoom in" aria-disabled={!onMap} onclick={() => onMap && api?.zoomBy(1.6)}>{@render glyph('in')}</button>
			<button type="button" tabindex="-1" aria-label="Zoom out" aria-disabled={!onMap || !zoomed} onclick={() => onMap && zoomed && api?.zoomBy(1 / 1.6)}>{@render glyph('out')}</button>
			<button type="button" tabindex="-1" aria-label="Reset" aria-disabled={!onMap || (!zoomed && !picked)} onclick={() => onMap && api?.reset()}>{@render glyph('reset')}</button>
			<button type="button" class="apart" tabindex="-1" aria-label="How it works" aria-expanded={helpOpen} aria-controls="constellation-help" onclick={() => (helpOpen = !helpOpen)}>{@render glyph('help')}</button>
		</div>
		<div class="pop" id="constellation-help" hidden={!helpOpen} bind:this={help}>
			<p id="constellation-about">Each star is a post. Posts that share words or tags sit together.</p>
			<p>Colour is the category. Bigger stars are longer posts. The newest ones glow.</p>
			<p>Click or tap a star to pick it, then again to open it. Click a name to go there.</p>
			<p>Zoom with the buttons, a pinch, or Ctrl and scroll. Drag to move the map. On a touch screen a swipe up or down scrolls the page, so move the map sideways or with two fingers.</p>
			<p>With a keyboard, arrow keys move between nearby stars. Enter opens. Space picks. Escape clears. Plus and minus zoom.</p>
			<p class="method">Positions come from a t-SNE fit over post text and tags. Axes, distances and density are not measurements.</p>
		</div>
		<!-- The legend is the filter: the same eight words and colours as the names on the sky. -->
		<div class="legend" role="toolbar" aria-label="Show one category" tabindex="-1" onkeydown={rove} onfocusin={stop}>
			{#each silhouette.categories as category, index (category.id)}
				<button type="button" tabindex={index === 0 ? 0 : -1} aria-pressed={filter === index} aria-label={`${category.label}, ${countText(category.count)}`} data-tip={countText(category.count)} onclick={() => toggleFilter(index)}>
					<span class="dot" style={`--dot:var(--star-${index % 8})`} aria-hidden="true"></span>{category.label}
				</button>
			{/each}
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
			<Sky
				bind:this={api}
				bind:zoomed
				bind:picked
				{data}
				{posts}
				{field}
				{view}
				{filter}
				{focusSlug}
				{scale}
				tallQuery={TALL_QUERY}
				onlive={(fade: boolean) => {
					ready = true;
					if (fade) window.setTimeout(() => (live = true), 280);
					else live = true;
				}}
			/>
		{:else if failed}
			<p class="notice">The map did not load. Latest and Archive below have every post.</p>
		{/if}
	</div>
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
		--star-0: var(--color-primary-700);
		--star-1: var(--star-0); --star-2: var(--star-0); --star-3: var(--star-0);
		--star-4: var(--star-0); --star-5: var(--star-0); --star-6: var(--star-0); --star-7: var(--star-0);
		/* Quieter text, still well above 4.5 to 1 on the paper and on a card in every theme. */
		--sky-soft: color-mix(in oklab, var(--sky-ink) 86%, var(--sky-paper));
		--sky-line: color-mix(in srgb, var(--sky-ink) 24%, transparent);
		--sky-shade: color-mix(in srgb, var(--color-surface-950) 45%, transparent);
		/* The band behind the stars: the page's own paper, laid a little thicker over its moving background. */
		--sky-night: color-mix(in srgb, var(--sky-paper) 55%, transparent);
		/* Edge to edge of the viewport. Without a script the section keeps to its column. */
		width: var(--bleed, 100%);
		margin-left: var(--shift, 0px);
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
		--sky-night: color-mix(in srgb, var(--sky-paper) 70%, transparent);
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
		/* At night the band is the page's own dark, deepened. */
		:global([data-mode='dark']) .constellation { --sky-night: oklch(from var(--sky-paper) calc(l * 0.6) c h / 0.8); }
	}

	/* The sky has its final size before anything loads: most of the viewport's height. Nothing inside it changes that size. */
	.sky { position: relative; isolation: isolate; height: max(31rem, 86vh); height: max(31rem, 86dvh); color: var(--sky-ink); }
	/* No box and no edge: one band that fades out at the top and the foot, and two soft tints that end inside it. */
	.sky::before {
		content: '';
		position: absolute;
		inset: 0;
		z-index: -1;
		pointer-events: none;
		background:
			radial-gradient(closest-side ellipse at 30% 42%, color-mix(in oklab, var(--color-primary-500) 13%, transparent), transparent),
			radial-gradient(closest-side ellipse at 72% 60%, color-mix(in oklab, var(--color-tertiary-500) 11%, transparent), transparent),
			linear-gradient(to bottom, transparent, var(--sky-night) 26%, var(--sky-night) 74%, transparent);
	}
	/* The stars keep clear of the strip at the foot, where the legend and the controls lie. */
	.field { position: absolute; inset: 3.5rem clamp(1.5rem, 4vw, 5rem) 5rem; }
	.silhouette { position: absolute; inset: 0; width: 100%; height: 100%; overflow: visible; opacity: .55; }
	.silhouette.tall { display: none; }
	.silhouette path { fill: none; stroke-linecap: round; vector-effect: non-scaling-stroke; }
	.live .silhouette, .listing .silhouette { visibility: hidden; }
	.notice { position: absolute; left: var(--edge, 1rem); right: var(--edge, 1rem); bottom: 4rem; font-size: .9rem; line-height: 1.3; }

	/* Five small controls in one corner, in line with the page's column. Each says its name on hover and on focus. */
	.controls { position: absolute; z-index: 3; right: var(--edge, 1rem); bottom: 1rem; display: flex; gap: 1px; }
	.controls button { position: relative; display: grid; place-items: center; width: 2rem; height: 2rem; color: var(--sky-soft); cursor: pointer; }
	.controls .apart { margin-left: .4rem; }
	/* No box behind an icon: a halo of paper keeps it legible over a star, as it does for the legend. */
	.controls svg { fill: none; stroke: currentColor; stroke-width: 1.5; stroke-linecap: round; stroke-linejoin: round; filter: drop-shadow(0 0 2px var(--sky-paper)) drop-shadow(0 0 4px var(--sky-paper)); }
	.controls .dots { stroke-width: 2.6; }
	.controls button[aria-expanded='true'] svg, .controls button:hover svg { filter: none; }
	.controls button[aria-disabled='true'] { color: color-mix(in srgb, var(--sky-ink) 40%, var(--sky-paper)); cursor: default; }
	.controls button[aria-expanded='true'] { color: var(--sky-paper); background: var(--sky-ink); }
	/* A tooltip for each control, with its name, and for each legend entry, with its count of posts. */
	.controls button::after, .legend button::after { position: absolute; bottom: calc(100% + .4rem); display: none; padding: .32rem .45rem; font: 600 .68rem/1 'Inter', system-ui, sans-serif; white-space: nowrap; text-shadow: none; color: var(--sky-paper); background: var(--sky-ink); pointer-events: none; }
	.controls button::after { content: attr(aria-label); right: 0; }
	.legend button::after { content: attr(data-tip); left: .45rem; bottom: calc(100% + .1rem); }
	.controls button:focus-visible:not([aria-expanded='true'])::after, .legend button:focus-visible::after { display: block; }
	@media (hover: hover) {
		.controls button:not([aria-disabled='true'], [aria-expanded='true']):hover { color: var(--sky-ink); background: var(--sky-paper); }
		.controls button:not([aria-expanded='true']):hover::after, .legend button:hover::after { display: block; }
	}

	/* The help holds what the page no longer prints: how the map reads, how to use it and what it does not measure. */
	.pop { position: absolute; z-index: 5; right: var(--edge, 1rem); bottom: 3.5rem; width: min(22rem, calc(100% - 1rem)); max-height: calc(100% - 4.5rem); overflow-y: auto; padding: .9rem 1rem; display: grid; gap: .5rem; font-size: .9rem; line-height: 1.35; color: var(--sky-ink); background: var(--sky-card); border: 1px solid var(--sky-line); box-shadow: 0 16px 36px -16px var(--sky-shade); }
	.pop[hidden] { display: none; }
	.pop { scrollbar-width: thin; scrollbar-color: var(--sky-line) transparent; }
	.pop .method { padding-top: .55rem; border-top: 1px solid var(--sky-line); color: var(--sky-soft); }

	/* A dot and one word for each category, along the foot of the sky. A halo of paper keeps a word legible over a star. */
	.legend { position: absolute; z-index: 3; left: calc(var(--edge, 1rem) - .45rem); bottom: 1rem; max-width: calc(100% - 2 * var(--edge, 1rem) - 11rem); display: flex; flex-wrap: wrap; gap: 0 .1rem; font: 600 .7rem/1 'Inter', system-ui, sans-serif; }
	.legend button { position: relative; display: inline-flex; align-items: center; gap: .36rem; height: 2rem; padding: 0 .45rem; color: var(--sky-soft); text-shadow: 0 0 .3em var(--sky-paper), 0 0 .6em var(--sky-paper); cursor: pointer; }
	.legend button[aria-pressed='true'] { color: var(--sky-ink); box-shadow: inset 0 -2px 0 currentColor; }
	@media (hover: hover) {
		.legend button:hover { color: var(--sky-ink); }
	}
	.dot { width: .55rem; height: .55rem; border-radius: 50%; flex: none; background: var(--dot); box-shadow: inset 0 0 0 2px var(--dot); }
	/* While one category is picked the others keep their text and show a hollow dot. */
	.legend:has([aria-pressed='true']) button[aria-pressed='false'] .dot { background: none; }

	:is(.controls, .legend) button:focus-visible { outline: 2px solid var(--sky-accent); outline-offset: 2px; }
	/* Selected text takes the sky's own ink and paper. */
	.constellation :global(::selection) { color: var(--sky-paper); background: var(--sky-ink); }

	/* A phone: the sky fills the screen below the site header. The controls sit at the top, the legend at the foot, and a picked post docks over the legend. */
	@media (max-width: 880px) {
		.sky { height: max(28rem, calc(100vh - var(--site-header, 5.25rem))); height: max(28rem, calc(100dvh - var(--site-header, 5.25rem))); }
		.field { inset: 4rem 1rem 5.75rem; }
		.silhouette.wide { display: none; }
		.silhouette.tall { display: block; }
		.controls { top: .5rem; right: .5rem; bottom: auto; }
		.controls button { width: 2.5rem; height: 2.5rem; }
		.controls .apart { margin-left: .25rem; }
		.controls button::after { top: calc(100% + .4rem); bottom: auto; }
		.pop { top: 3.4rem; right: .5rem; bottom: auto; }
		.legend { left: .5rem; right: .5rem; bottom: .5rem; max-width: none; }
		.legend button { height: 1.9rem; padding: 0 .4rem; }
		.picked:not(.listing) .legend { visibility: hidden; }
	}
	/* A narrow phone: the legend takes three rows, and the stars keep clear of all three. ConstellationSky.svelte repeats the width. */
	@media (max-width: 350px) {
		.field { inset: 4rem .75rem 7.75rem; }
	}
</style>
