<script lang="ts">
	// The stream's filters as plain words (TIN-8657, rulings RM48 and RM66). They lie at one end of the
	// one row at the foot of the stage. On a narrow screen the row shows the current word, and a press
	// lays the words out across the row in place of the controls.
	import { onMount, tick } from 'svelte';
	import { filterOf, offeredFilters, type FilterId, type StreamFile } from '$lib/home/stream';

	let {
		counts,
		search = '',
		onchoose = () => {},
	}: {
		counts: StreamFile['counts'];
		/** The query of the address, handed down by the page. */
		search?: string;
		/** Called as a word is pressed, before the address changes. */
		onchoose?: () => void;
	} = $props();

	let mounted = $state(false);
	let open = $state(false);
	let nav = $state<HTMLElement | null>(null);
	let pick = $state<HTMLButtonElement | null>(null);

	const offered = $derived(offeredFilters(counts));
	// The filter lives in the address, so a filtered stream can be shared.
	const filter = $derived.by<FilterId>(() => {
		const wanted = mounted ? filterOf(new URLSearchParams(search).get('show')) : 'all';
		return offered.some((candidate) => candidate.id === wanted) ? wanted : 'all';
	});
	const current = $derived(offered.find((candidate) => candidate.id === filter) ?? offered[0]);

	onMount(() => {
		mounted = true;
	});

	function hrefFor(id: FilterId): string {
		const kept = mounted ? [...new URLSearchParams(search)].filter(([name]) => name !== 'show') : [];
		const query = new URLSearchParams(id === 'all' ? kept : [...kept, ['show', id]]).toString();
		return query ? `?${query}` : '/';
	}

	async function show() {
		open = true;
		await tick();
		nav?.querySelector<HTMLElement>('[aria-current]')?.focus({ preventScroll: true });
	}

	/** Close the words. Focus goes back to the one word when it was on one of them. */
	async function close(refocus = nav?.contains(document.activeElement) === true) {
		if (!open) return;
		open = false;
		await tick();
		// On a wide screen the one word is not drawn, and focus stays where it is.
		if (refocus && pick?.getClientRects().length) pick.focus({ preventScroll: true });
	}

	function choose() {
		onchoose();
		void close(true);
	}
</script>

<svelte:window
	onpointerdown={(event) => {
		if (open && event.target instanceof Node && !nav?.contains(event.target)) void close(false);
	}}
	onkeydown={(event) => {
		if (open && event.key === 'Escape') void close();
	}}
/>

<nav class="filters" class:ready={mounted} class:open aria-label="Show" bind:this={nav} data-testid="stream-filters">
	<button type="button" class="pick" aria-expanded={open} aria-controls="stream-filter-words" bind:this={pick} onclick={show} data-testid="stream-filter-pick">
		{current.label}<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4.5 6.5 8 10l3.5-3.5" /></svg>
	</button>
	<span class="words" id="stream-filter-words">
		{#each offered as option (option.id)}
			<a href={hrefFor(option.id)} aria-current={filter === option.id ? 'true' : undefined} data-sveltekit-noscroll data-sveltekit-keepfocus data-sveltekit-replacestate onclick={choose}>{option.label}</a>
		{/each}
	</span>
</nav>

<style>
	/* Plain words. The current one is marked by weight and one underline in the accent. */
	.filters {
		display: flex;
		align-items: center;
		min-width: 0;
		font: 600 0.82rem/1 'Inter', sans-serif;
		letter-spacing: 0.02em;
		/* The filters need scripts. Until those run the words keep their place and stay out of sight. Then they fade in. */
		visibility: hidden;
		opacity: 0;
	}
	.filters.ready {
		visibility: visible;
		opacity: 1;
		transition: opacity 0.6s var(--ease-soft);
	}
	.words {
		display: flex;
	}
	/* Each word is a target 44 pixels high and at least as wide. The space between two words is theirs. */
	.words a,
	.pick {
		display: inline-flex;
		align-items: center;
		min-height: 2.75rem;
		padding: 0 0.8125rem;
		color: var(--quiet);
		white-space: nowrap;
		text-decoration: underline transparent;
		text-decoration-thickness: 2px;
		text-underline-offset: 0.5em;
		transition:
			color 0.3s var(--ease-soft),
			text-decoration-color 0.3s var(--ease-soft);
	}
	.words a:hover,
	.pick:hover {
		color: var(--ink);
	}
	.words a[aria-current],
	.pick {
		color: var(--ink);
		font-weight: 700;
		text-decoration-color: var(--accent);
	}
	.words a:focus-visible,
	.pick:focus-visible {
		outline: 2px solid var(--accent);
		outline-offset: -4px;
	}
	.pick {
		display: none;
		gap: 0.3rem;
		font: inherit;
		font-weight: 700;
		letter-spacing: inherit;
		cursor: pointer;
	}
	.pick svg {
		width: 0.85rem;
		height: 0.85rem;
		fill: none;
		stroke: var(--quiet);
		stroke-width: 1.5;
		stroke-linecap: round;
		stroke-linejoin: round;
		transition: transform 0.3s var(--ease);
	}
	.pick:hover svg {
		transform: translateY(1px);
	}

	/* A narrow screen: the current word alone. Pressed, it gives way to all the words, across the row. */
	@media (max-width: 900px) {
		.pick {
			display: inline-flex;
		}
		.words {
			display: none;
		}
		.open .pick {
			display: none;
		}
		.open .words {
			display: flex;
			animation: words-in 0.4s var(--ease) backwards;
		}
		@keyframes words-in {
			from {
				opacity: 0;
				transform: translate3d(-0.5rem, 0, 0);
			}
		}
	}
	/* A small phone: the words stand a little closer, so all of them fit. */
	@media (max-width: 360px) {
		.words a {
			padding: 0 0.45rem;
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.filters.ready,
		.pick svg {
			transition: none;
		}
		.open .words {
			animation: none;
		}
	}
</style>
