<script lang="ts">
	// The one mixed stream of the home page (TIN-8657, ruling RM48): newest first, every kind
	// in its own form, with whitespace for rhythm and no card, rule or label.
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import { afterNavigate } from '$app/navigation';
	import StreamEntry from './StreamEntry.svelte';
	import { filterItems, filterOf, markerFor, offeredFilters, type FilterId, type StreamFile } from '$lib/home/stream';

	let { stream, onsky = () => {} }: { stream: StreamFile; onsky?: () => void } = $props();

	// A screen or two is in the first paint. More comes as the reader nears the end.
	const BATCH = 12;

	let mounted = $state(false);
	let filter = $state<FilterId>('all');
	let visible = $state(BATCH);
	let moreEl = $state<HTMLAnchorElement | null>(null);
	let filtersEl = $state<HTMLElement | null>(null);
	let flowEl = $state<HTMLOListElement | null>(null);

	const offered = $derived(offeredFilters(stream.counts));
	const list = $derived(filterItems(stream.items, filter));
	const shown = $derived(list.slice(0, visible));

	onMount(() => {
		mounted = true;
	});

	// The filter lives in the address, so a filtered stream can be shared.
	$effect(() => {
		if (!mounted) return;
		const next = filterOf(new URLSearchParams(page.url.search).get('show'));
		const wanted = offered.some((candidate) => candidate.id === next) ? next : 'all';
		if (wanted !== filter) {
			filter = wanted;
			visible = BATCH;
		}
	});

	function hrefFor(id: FilterId): string {
		const kept = mounted ? [...new URLSearchParams(page.url.search)].filter(([name]) => name !== 'show') : [];
		const query = new URLSearchParams(id === 'all' ? kept : [...kept, ['show', id]]).toString();
		return query ? `?${query}` : '/';
	}

	// A filter chosen from the first screen brings the stream up, so the choice shows.
	// It waits for the address to change, because the router settles the scroll position first.
	let chosen = false;
	afterNavigate(() => {
		if (chosen) reveal();
		chosen = false;
	});
	function reveal() {
		const top = flowEl?.getBoundingClientRect().top ?? 0;
		if (top < window.innerHeight * 0.6) return;
		const calm = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
		filtersEl?.scrollIntoView({ block: 'start', behavior: calm ? 'auto' : 'smooth' });
	}

	function more(event?: MouseEvent) {
		event?.preventDefault();
		visible = Math.min(list.length, visible + BATCH);
	}

	// The More link is also the sentinel: when it nears the screen the next batch shows.
	$effect(() => {
		const el = moreEl;
		if (!el) return;
		const near = new IntersectionObserver((entries) => entries.some((entry) => entry.isIntersecting) && more(), { rootMargin: '0px 0px 900px 0px' });
		near.observe(el);
		return () => near.disconnect();
	});

	// An item arrives out of a short soft blur the first time it enters the screen, and never again.
	let arrivals: IntersectionObserver | null = null;
	function arrive(node: HTMLElement) {
		// Only an item still below the screen waits. What is on show stays as it is, and scrolling back never replays one.
		const waits = !window.matchMedia('(prefers-reduced-motion: reduce)').matches && node.getBoundingClientRect().top > window.innerHeight;
		if (waits) {
			arrivals ??= new IntersectionObserver(
				(entries) => {
					for (const entry of entries) {
						if (!entry.isIntersecting) continue;
						entry.target.classList.remove('waiting');
						arrivals?.unobserve(entry.target);
					}
				},
				{ rootMargin: '0px 0px -6% 0px' },
			);
			node.classList.add('waiting');
			arrivals.observe(node);
		}
		return { destroy: () => arrivals?.unobserve(node) };
	}
</script>

<section class="stream" id="stream" aria-label="Stream" data-testid="home-stream" data-pagefind-body>
	<nav class="filters" class:ready={mounted} aria-label="Show" bind:this={filtersEl}>
		{#each offered as option (option.id)}
			<a href={hrefFor(option.id)} aria-current={filter === option.id ? 'true' : undefined} data-sveltekit-noscroll data-sveltekit-keepfocus data-sveltekit-replacestate onclick={() => (chosen = true)}>{option.label}</a>
		{/each}
	</nav>

	<ol class="flow" bind:this={flowEl}>
		{#each shown as item, i (item.id)}
			{@const marker = markerFor(list, i)}
			{@const follows = item.kind === 'photos' && i > 0 && shown[i - 1].kind === 'article' && shown[i - 1].url === item.url}
			<li class={`item ${item.kind}`} class:month={marker !== null} class:follows use:arrive data-testid="stream-item" data-kind={item.kind}>
				{#if marker}<p class="marker">{marker}</p>{/if}
				<div class="entry"><StreamEntry {item} {follows} /></div>
			</li>
		{/each}
	</ol>

	<p class="end">
		{#if visible < list.length}
			<!-- Without scripts this is a plain link to every post. With them it shows the next part of the stream. -->
			<a class="more" href="/blog" bind:this={moreEl} onclick={more} data-testid="stream-more">More</a>
		{:else}
			<a href="#sky" onclick={onsky}>Back to the sky</a>
			<a href="/blog">All posts</a>
		{/if}
	</p>
</section>

<style>
	/* One left edge for the whole page: the type on the stage, the controls, the filters and the stream all start on it. */
	.stream {
		/* The filters share one quiet line with the stage's controls: words at one end, pause and next at the other. */
		margin-top: -2.75rem;
		padding: 0 var(--gutter) 6rem;
		color: var(--ink);
		--rail: 9.5rem;
		--measure: 38rem;
	}

	/* Plain words. The current one is marked by weight and one underline in the accent. */
	.filters {
		/* The row lies over the foot of the stage, so it is lifted above it to take a press. */
		position: relative;
		z-index: 1;
		display: flex;
		flex-wrap: wrap;
		gap: 0 1.6rem;
		max-width: calc(100% - 15rem);
		min-height: 2.75rem;
		align-items: center;
		font: 600 0.82rem/1 'Inter', sans-serif;
		letter-spacing: 0.02em;
		/* The filters need scripts. Until those run the row keeps its place and stays out of sight. */
		visibility: hidden;
	}
	.filters.ready {
		visibility: visible;
	}
	.filters a {
		padding: 0.9rem 0;
		color: var(--quiet);
		text-decoration: underline transparent;
		text-decoration-thickness: 2px;
		text-underline-offset: 0.5em;
		transition:
			color 0.2s ease,
			text-decoration-color 0.2s ease;
	}
	.filters a:hover {
		color: var(--ink);
	}
	.filters a[aria-current] {
		color: var(--ink);
		font-weight: 700;
		text-decoration-color: var(--accent);
	}
	a:focus-visible {
		outline: 2px solid var(--accent);
		outline-offset: 3px;
	}

	.flow {
		margin-top: clamp(2rem, 5vw, 3.5rem);
	}
	/* Whitespace sets the rhythm. A new month takes more of it. */
	.item {
		display: grid;
		grid-template-columns: var(--rail) minmax(0, var(--measure)) minmax(0, 1fr);
		margin-top: clamp(3.25rem, 6.5vw, 5.5rem);
	}
	.item:first-child {
		margin-top: 0;
	}
	.item.month:not(:first-child) {
		margin-top: clamp(5rem, 10vw, 8.5rem);
	}
	/* Photographs that follow their own writing sit close under it. */
	.item.follows {
		margin-top: 1.5rem;
	}
	.entry {
		grid-column: 2;
		min-width: 0;
	}
	/* A photograph or a video runs wide: from the date rail across the column and beyond it. */
	.item.photos .entry {
		grid-column: 1 / -1;
		max-width: 72rem;
	}
	.item.video .entry {
		grid-column: 2 / -1;
		max-width: 52rem;
	}
	/* The month, once, small and quiet, in the rail beside the first item of that month. */
	.marker {
		grid-column: 1;
		grid-row: 1;
		align-self: start;
		padding-top: 0.55rem;
		font: 600 0.72rem/1.2 'Inter', sans-serif;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		color: var(--quiet);
	}
	.item.photos .marker,
	.item.photos .entry {
		grid-row: auto;
	}
	.item.photos .marker {
		padding: 0 0 0.9rem;
	}

	/* The arrival: once, short, out of a soft blur. Without scripts nothing waits. */
	.item {
		transition:
			opacity 0.7s ease,
			transform 0.7s cubic-bezier(0.16, 1, 0.3, 1),
			filter 0.7s cubic-bezier(0.16, 1, 0.3, 1);
	}
	.item:global(.waiting) {
		opacity: 0;
		transform: translateY(10px);
		filter: blur(6px);
	}

	.end {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem 2rem;
		margin-top: clamp(4rem, 9vw, 7rem);
		padding-left: var(--rail);
		font: 600 0.82rem/1 'Inter', sans-serif;
		letter-spacing: 0.02em;
	}
	.end a {
		padding: 0.9rem 0;
		color: var(--quiet);
		text-decoration: underline;
		text-decoration-color: color-mix(in oklch, var(--ink) 25%, transparent);
		text-decoration-thickness: 1px;
		text-underline-offset: 0.45em;
		transition:
			color 0.2s ease,
			text-decoration-color 0.2s ease;
	}
	.end a:hover {
		color: var(--ink);
		text-decoration-color: var(--accent);
	}

	@media (max-width: 900px) {
		.stream {
			--rail: 0rem;
			margin-top: 0;
		}
		.filters {
			max-width: none;
		}
		.item {
			display: block;
		}
		.marker {
			padding: 0 0 1rem;
		}
		.end {
			padding-left: 0;
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.item {
			transition: none;
		}
	}
</style>
