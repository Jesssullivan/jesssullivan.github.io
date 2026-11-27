<script lang="ts">
	// The one mixed stream of the home page (TIN-8657, ruling RM48): newest first, every kind
	// in its own form, with whitespace for rhythm and no card, rule or label.
	// The years before 2020 are each one line, a year and its count, that opens on a press (RM95).
	// Each is a details element with its items inside it, so it opens with no script and by keyboard.
	import { onMount } from 'svelte';
	import { afterNavigate } from '$app/navigation';
	import StreamEntry from './StreamEntry.svelte';
	import { formOf } from '$lib/home/forms';
	import { filterItems, filterOf, foldYears, kindsOf, markerFor, offeredFilters, shows, type FilterId, type StreamFile, type StreamItem } from '$lib/home/stream';

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
	// The filter cuts first, so a year counts and shows only what matches, and a year with nothing is absent.
	const parts = $derived(foldYears(list));
	const shown = $derived(parts.open.slice(0, visible));

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
		visible = Math.min(parts.open.length, visible + BATCH);
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
	// A year that opens: what it holds below the screen arrives the same way, once.
	const seen = new WeakSet<Element>();
	function opened(event: Event) {
		const year = event.currentTarget as HTMLDetailsElement;
		if (!year.open || seen.has(year)) return;
		seen.add(year);
		for (const node of year.querySelectorAll<HTMLElement>(':scope > ol > li')) arrive(node);
	}
</script>

{#snippet entry(item: StreamItem, marker: string | null)}
	{@const form = formOf(item)}
	<li class={`item ${item.kind}`} class:month={marker !== null} class:pic={shows(item)} class:plate={form === 'plate'} class:words={form === 'words'} use:arrive data-testid="stream-item" data-kind={item.kind} data-kinds={kindsOf(item).join(' ')}>
		{#if marker}<p class="marker">{marker}</p>{/if}
		<div class="entry"><StreamEntry {item} /></div>
	</li>
{/snippet}

<section class="stream" class:arrives id="stream" aria-label="Stream" data-testid="home-stream" data-pagefind-body>
	<ol class="flow" class:none={shown.length === 0} bind:this={flowEl}>
		{#each shown as item, i (item.id)}
			{@render entry(item, markerFor(parts.open, i))}
		{/each}
	</ol>

	{#if visible < parts.open.length}
		<p class="end">
			<!-- Without scripts this is a plain link to every post. With them it shows the next part of the stream. -->
			<a class="more" href="/blog" bind:this={moreEl} onclick={more} data-testid="stream-more">More</a>
		</p>
	{/if}

	<!-- An older year is one line. Its items are inside it from the first paint, so it opens on a press with no script. -->
	{#each parts.years as fold (fold.year)}
		<details class="year" ontoggle={opened} data-testid="stream-year" data-year={fold.year}>
			<summary data-tip="Open" data-tip-open="Close">
				<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 5l7 7-7 7" /></svg>
				<span class="of">{fold.year}</span>
				<span class="count">{fold.items.length}<span class="sr-only">{fold.items.length === 1 ? ' item' : ' items'}</span></span>
			</summary>
			<ol class="flow">
				{#each fold.items as item, i (item.id)}
					{@render entry(item, markerFor(fold.items, i, true))}
				{/each}
			</ol>
		</details>
	{/each}

	{#if visible >= parts.open.length}
		<p class="end">
			<a href="#sky" onclick={toSky}>Back to the sky</a>
			<a href="/blog">All posts</a>
		</p>
	{/if}
</section>

<style>
	/* One left edge for the whole page: the type on the stage, the controls, the filters and the stream all start on it. */
	.stream {
		padding: 0 var(--gutter) 6rem;
		color: var(--ink);
		/* Wide enough for the longest month and its year, with room before a play control that hangs in the rail. */
		--rail: 10.25rem;
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
			--word-title: clamp(1.22rem, 1.3vw, 1.5rem);
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
	/*
	 * A post that is words alone is a tight row (RM95): its title a step smaller, and a run of them close together,
	 * so the same posts take about half the screens and a picture comes up sooner. A new month still takes more room.
	 */
	.item.words.article {
		--title: var(--word-title, 1.24rem);
	}
	.item.words + .item.words {
		margin-top: clamp(1.7rem, 3vw, 2.1rem);
	}
	.item.words + .item.words.month {
		margin-top: clamp(3rem, 6vw, 3.75rem);
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
		.item.words + .item.words {
			margin-top: 1.75rem;
		}
		.item.words + .item.words.month {
			margin-top: 3.25rem;
		}
		.item.pic:not(:first-child),
		.item.pic + .item {
			margin-top: 5.5rem;
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

	/*
	 * An older year: one line, a year and its count, on the line every title starts on. The sign that opens it
	 * hangs in the rail, in the accent, as a recording's play control does. No rule, no box: the line is the control.
	 */
	.year {
		margin-top: 0.35rem;
	}
	.year:first-of-type {
		margin-top: clamp(4rem, 8vw, 6.5rem);
	}
	/* A filter may leave nothing newer than the folded years. They then start where the stream starts. */
	.flow.none + .year:first-of-type {
		margin-top: 0;
	}
	.year[open]:not(:first-of-type) {
		margin-top: 2.5rem;
	}
	.year[open] + .year {
		margin-top: clamp(4rem, 8vw, 6rem);
	}
	summary {
		position: relative;
		display: flex;
		align-items: baseline;
		gap: 0.85rem;
		width: fit-content;
		min-height: 2.75rem;
		padding: 0.3rem 1.25rem 0.3rem var(--rail);
		list-style: none;
		cursor: pointer;
		user-select: none;
	}
	summary::-webkit-details-marker {
		display: none;
	}
	summary svg {
		position: absolute;
		left: calc(var(--rail) - 2.15rem);
		top: 50%;
		width: 1.35rem;
		height: 1.35rem;
		margin-top: -0.675rem;
		fill: none;
		stroke: var(--accent);
		stroke-width: 2.4;
		stroke-linecap: round;
		stroke-linejoin: round;
		transition:
			transform 0.5s var(--ease),
			stroke 0.3s var(--ease-soft);
	}
	.year[open] > summary svg {
		transform: rotate(90deg);
	}
	.of {
		font: 700 var(--year, clamp(1.6rem, 5.4vw, 2.1rem)) / 1.1 'Inter', sans-serif;
		letter-spacing: -0.02em;
		font-variant-numeric: tabular-nums;
		text-decoration: underline transparent;
		text-decoration-thickness: 2px;
		text-underline-offset: 0.2em;
		transition: text-decoration-color 0.3s var(--ease-soft);
	}
	summary .count {
		font: 600 0.78rem/1.2 'Inter', sans-serif;
		letter-spacing: 0.05em;
		font-variant-numeric: tabular-nums;
		color: var(--quiet);
	}
	summary:hover .of,
	summary:focus-visible .of {
		text-decoration-color: var(--accent);
	}
	summary:hover svg {
		stroke: var(--ink);
	}
	summary:focus-visible {
		outline: 2px solid var(--accent);
		outline-offset: 2px;
	}
	.year > .flow {
		margin-top: 1.75rem;
	}
	/* What a year holds comes out of the same short soft blur, once, as it opens. */
	.year[open] > .flow {
		animation: year-opens 0.7s var(--ease-soft) backwards;
	}
	@keyframes year-opens {
		from {
			opacity: 0;
			filter: blur(6px);
			transform: translate3d(0, -0.5rem, 0);
		}
	}
	:global(.home.calm) .year[open] > .flow {
		animation-name: stream-in;
	}
	/* The tooltip says what a press does. It is for the eye: the browser already tells a screen reader whether the year is open. */
	summary::after {
		content: attr(data-tip);
		content: attr(data-tip) / '';
		position: absolute;
		left: var(--rail);
		bottom: calc(100% - 0.1rem);
		z-index: 5;
		padding: 0.3rem 0.5rem;
		font: 600 0.72rem/1 'Inter', sans-serif;
		letter-spacing: 0.02em;
		white-space: nowrap;
		color: var(--ground);
		background: var(--ink);
		opacity: 0;
		transform: translateY(0.25rem);
		pointer-events: none;
		transition:
			opacity 0.2s var(--ease-soft),
			transform 0.3s var(--ease);
	}
	.year[open] > summary::after {
		content: attr(data-tip-open);
		content: attr(data-tip-open) / '';
	}
	summary:focus-visible::after {
		opacity: 1;
		transform: none;
	}
	@media (hover: hover) {
		summary:hover::after {
			opacity: 1;
			transform: none;
			transition-delay: 0.3s;
		}
	}
	@media (min-width: 1100px) {
		.stream {
			--year: clamp(1.9rem, 2.3vw, 2.75rem);
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
		.item.words .marker {
			padding-bottom: 0.7rem;
		}
		.end {
			padding-left: 0;
		}
		/* With no rail, the sign stands before the year. */
		summary {
			padding-left: 1.9rem;
		}
		summary svg {
			left: -0.15rem;
		}
		summary::after {
			left: 1.9rem;
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.item {
			transition: none;
		}
		.year[open] > .flow {
			animation: none;
		}
		summary svg {
			transition: none;
		}
		.stream.arrives :is(.flow, .end) {
			animation: none;
		}
	}
</style>
