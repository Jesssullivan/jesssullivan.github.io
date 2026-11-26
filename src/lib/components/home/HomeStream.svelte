<script lang="ts">
	// The one mixed stream of the home page (TIN-8657, ruling RM48): newest first, every kind
	// in its own form, with whitespace for rhythm and no card, rule or label.
	import { onMount } from 'svelte';
	import { afterNavigate } from '$app/navigation';
	import StreamEntry from './StreamEntry.svelte';
	import { formOf } from '$lib/home/forms';
	import { filterItems, filterOf, kindsOf, markerFor, offeredFilters, shows, type FilterId, type StreamFile } from '$lib/home/stream';

	let {
		stream,
		search = '',
		arrives = false,
		onsky = () => {},
		row = () => null,
	}: {
		stream: StreamFile;
		/** The query of the address, handed down by the page. */
		search?: string;
		/** True when the stream is put into a page that has already painted. It then fades in with the stage. */
		arrives?: boolean;
		onsky?: () => void;
		/** The row at the foot of the stage, which holds the filters. A chosen filter brings it to the top of the screen. */
		row?: () => HTMLElement | null;
	} = $props();

	// A screen or two is in the first paint. More comes as the reader nears the end.
	const BATCH = 12;

	let mounted = $state(false);
	let filter = $state<FilterId>('all');
	let visible = $state(BATCH);
	let moreEl = $state<HTMLAnchorElement | null>(null);
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
		const next = filterOf(new URLSearchParams(search).get('show'));
		const wanted = offered.some((candidate) => candidate.id === next) ? next : 'all';
		if (wanted !== filter) {
			filter = wanted;
			visible = BATCH;
		}
	});

	// A filter chosen from the first screen brings the stream up, so the choice shows.
	// It waits for the address to change, because the router settles the scroll position first.
	let chosen = false;
	/** The filters call this as a word is pressed. */
	export function choose() {
		chosen = true;
	}
	afterNavigate(() => {
		if (chosen) reveal();
		chosen = false;
	});
	function reveal() {
		const top = flowEl?.getBoundingClientRect().top ?? 0;
		if (top < window.innerHeight * 0.6) return;
		const calm = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
		row()?.scrollIntoView({ block: 'start', behavior: calm ? 'auto' : 'smooth' });
	}

	// The way back up: the stage shows its first scene, and the page glides to it. Focus goes with it.
	function toSky(event: MouseEvent) {
		onsky();
		// With reduced motion the plain link does the work, and the page jumps.
		if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
		event.preventDefault();
		const sky = document.getElementById('sky');
		sky?.scrollIntoView({ behavior: 'smooth', block: 'start' });
		sky?.focus({ preventScroll: true });
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

<section class="stream" class:arrives id="stream" aria-label="Stream" data-testid="home-stream" data-pagefind-body>
	<ol class="flow" bind:this={flowEl}>
		{#each shown as item, i (item.id)}
			{@const marker = markerFor(list, i)}
			<li class={`item ${item.kind}`} class:month={marker !== null} class:pic={shows(item)} class:plate={formOf(item) === 'plate'} use:arrive data-testid="stream-item" data-kind={item.kind} data-kinds={kindsOf(item).join(' ')}>
				{#if marker}<p class="marker">{marker}</p>{/if}
				<div class="entry"><StreamEntry {item} /></div>
			</li>
		{/each}
	</ol>

	<p class="end">
		{#if visible < list.length}
			<!-- Without scripts this is a plain link to every post. With them it shows the next part of the stream. -->
			<a class="more" href="/blog" bind:this={moreEl} onclick={more} data-testid="stream-more">More</a>
		{:else}
			<a href="#sky" onclick={toSky}>Back to the sky</a>
			<a href="/blog">All posts</a>
		{/if}
	</p>
</section>

<style>
	/* One left edge for the whole page: the type on the stage, the controls, the filters and the stream all start on it. */
	.stream {
		padding: 0 var(--gutter) 6rem;
		color: var(--ink);
		--rail: 9.5rem;
		--measure: 38rem;
	}
	/* A wide screen: the words keep a column of their own, and what there is to see starts on a second line beside it. */
	@media (min-width: 1100px) {
		.stream {
			--say: clamp(27rem, 37vw, 42rem);
			--between: clamp(3rem, 4.4vw, 5.5rem);
			/* A title set as words is a step smaller than a title that lies on its photograph. */
			--title: clamp(1.55rem, 1.8vw, 2.2rem);
			--plate-title: clamp(1.75rem, 2.3vw, 2.75rem);
		}
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
		grid-template-columns: var(--rail) minmax(0, 1fr);
		margin-top: clamp(3.25rem, 6.5vw, 5.5rem);
	}
	.item:first-child {
		margin-top: 0;
	}
	.item.month:not(:first-child) {
		margin-top: clamp(5rem, 10vw, 8.5rem);
	}
	.entry {
		grid-column: 2;
		min-width: 0;
		max-width: 44rem;
	}
	/* The month, once, small and quiet, in the rail beside the first item of that month. */
	.marker {
		grid-column: 1;
		grid-row: 1;
		align-self: start;
		padding-top: calc(var(--title, 1.9rem) * 0.6 - 0.55rem);
		font: 600 0.72rem/1.2 'Inter', sans-serif;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		color: var(--quiet);
	}
	/*
	 * A wide screen. Words alone sit close, as a run. Something to see takes room above and below it,
	 * and a new month takes the most. Whitespace is the only rule there is.
	 */
	@media (min-width: 1100px) {
		.entry {
			max-width: none;
		}
		.item {
			margin-top: 3rem;
		}
		.item.month:not(:first-child) {
			margin-top: 4.5rem;
		}
		.item.pic:not(:first-child),
		.item.pic + .item {
			margin-top: 6rem;
		}
		/* Beside a plate the month stands level with the head of the photograph. */
		.item.plate .marker {
			padding-top: 0.15rem;
		}
		.flow {
			margin-top: 2.75rem;
		}
	}

	/* The arrival: once, short, out of a soft blur. Without scripts nothing waits. */
	.item {
		transition:
			opacity 0.8s var(--ease-soft),
			transform 1s var(--ease),
			filter 0.8s var(--ease-soft);
	}
	.item:global(.waiting) {
		opacity: 0;
		transform: translate3d(0, 0.9rem, 0);
		filter: blur(6px);
	}
	/* A device that missed the stage's frame budget gets the rise and the fade with no blur. */
	:global(.home.calm) .item:global(.waiting) {
		filter: none;
	}
	/* Put into a page that has already painted, the stream fades in with the stage. */
	.stream.arrives :is(.flow, .end) {
		animation: stream-in 0.9s var(--ease-soft) 0.15s backwards;
	}
	@keyframes stream-in {
		from {
			opacity: 0;
		}
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
			color 0.3s var(--ease-soft),
			text-decoration-color 0.3s var(--ease-soft);
	}
	.end a:hover {
		color: var(--ink);
		text-decoration-color: var(--accent);
	}

	@media (max-width: 900px) {
		.stream {
			--rail: 0rem;
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
		.stream.arrives :is(.flow, .end) {
			animation: none;
		}
	}
</style>
