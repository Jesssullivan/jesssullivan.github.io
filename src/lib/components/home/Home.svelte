<script lang="ts">
	// The home page behind ?flags=home (TIN-8657): the heading stage, then one mixed stream.
	// It has no footer and no side column, and it asks the network for nothing while it runs.
	import { onMount } from 'svelte';
	import HomeStage from './HomeStage.svelte';
	import HomeStream from './HomeStream.svelte';
	import StreamFilters from './StreamFilters.svelte';
	import { HOME_STREAM_URL } from '$lib/home/load';
	// The three type files the first screen sets its words in. They are the files the site's stylesheet already names.
	import bodyFace from '@fontsource/crimson-pro/files/crimson-pro-latin-400-normal.woff2?url';
	import labelFace from '@fontsource/inter/files/inter-latin-600-normal.woff2?url';
	import titleFace from '@fontsource/inter/files/inter-latin-700-normal.woff2?url';
	import { buildScenes } from '$lib/home/scenes';
	import type { StreamFile } from '$lib/home/stream';
	import type { ReaderCollection } from '$lib/reader/collection';

	let {
		stream,
		archive,
		search = '',
		arrives = false,
	}: {
		stream: StreamFile | null;
		archive: ReaderCollection['archive'];
		/** The query of the address. The page hands it over, so this code shares no file with the ordinary page. */
		search?: string;
		/** True when this page takes the place of one that has already painted, as the flag does on a production build. */
		arrives?: boolean;
	} = $props();

	const scenes = $derived(buildScenes(stream));
	let stage = $state<ReturnType<typeof HomeStage> | null>(null);
	let flow = $state<ReturnType<typeof HomeStream> | null>(null);
	const focusSlug = $derived(new URLSearchParams(search).get('focus'));
	/** True once the device missed the stage's frame budget. The stream then arrives with no blur. */
	let calm = $state(false);

	// What the visitor last used: a mouse, the keyboard or a finger. A tooltip is for a mouse over a control
	// and for a control reached by keyboard. A touch never leaves one up, and neither does a press.
	let input = $state<'mouse' | 'keys' | 'touch'>('mouse');
	onMount(() => {
		const options = { capture: true, passive: true };
		const onDown = (event: PointerEvent) => (input = event.pointerType === 'mouse' ? 'mouse' : 'touch');
		const onMove = (event: PointerEvent) => {
			if (event.pointerType === 'mouse' && input === 'touch') input = 'mouse';
		};
		const onKey = () => (input = 'keys');
		document.addEventListener('pointerdown', onDown, options);
		document.addEventListener('pointermove', onMove, options);
		document.addEventListener('keydown', onKey, options);
		return () => {
			document.removeEventListener('pointerdown', onDown, options);
			document.removeEventListener('pointermove', onMove, options);
			document.removeEventListener('keydown', onKey, options);
		};
	});
</script>

<svelte:head>
	<title>Jess Sullivan | transscendsurvival.org</title>
	<meta name="description" content="Posts and notes from Jess Sullivan." />
	<link rel="canonical" href="https://transscendsurvival.org/" />
	<meta property="og:title" content="Jess Sullivan | transscendsurvival.org" />
	<meta property="og:description" content="Posts and notes from Jess Sullivan." />
	<meta property="og:type" content="website" />
	<meta property="og:url" content="https://transscendsurvival.org/" />
	{#if !arrives}
		<!-- A prerendered page asks for its type with the stylesheet, not after it, so no word is set twice and nothing moves. -->
		{#each [labelFace, titleFace, bodyFace] as face (face)}
			<link rel="preload" as="font" type="font/woff2" crossorigin="anonymous" href={face} />
		{/each}
		<!-- A prerendered page asks for the stream's data early, by its hashed name, so it comes alive without waiting on it. -->
		<link rel="preload" as="fetch" crossorigin="anonymous" href={HOME_STREAM_URL} />
	{/if}
</svelte:head>

<div class="home" class:calm class:keys={input === 'keys'} class:touch={input === 'touch'} data-testid="home-stage-stream">
	<h1 class="sr-only">Jess Sullivan</h1>
	<!-- One row at the foot of the stage holds the stream's filters and the stage's controls. -->
	<HomeStage bind:this={stage} {scenes} {archive} {focusSlug} {arrives} onstill={() => (calm = true)}>
		{#snippet lead()}
			{#if stream}<StreamFilters counts={stream.counts} {search} onchoose={() => flow?.choose()} />{/if}
		{/snippet}
	</HomeStage>
	{#if stream}
		<HomeStream bind:this={flow} {stream} {search} {arrives} onsky={() => stage?.showFirst()} row={() => stage?.row() ?? null} />
	{/if}
</div>

<style>
	/*
	 * The page's ground, its ink and one accent, read from the theme. Everything on the
	 * home page is mixed from these three, so all five themes and both modes re-tint it.
	 */
	.home {
		--ground: var(--color-root-bg-light);
		--ink: var(--color-surface-950);
		--accent: var(--color-primary-700);
		--quiet: color-mix(in oklch, var(--ink) 70%, var(--ground));
		--gutter: clamp(1.25rem, 7vw, 11rem);
		/* One family of curves for everything that arrives on this page: fast out of the gate, a long settle.
		   The quick one is for what travels. The soft one is for light: a fade or a blur. */
		--ease: cubic-bezier(0.16, 1, 0.3, 1);
		--ease-soft: cubic-bezier(0.33, 1, 0.68, 1);
		overflow-x: clip;
		background: var(--ground);
		color: var(--ink);
	}
	:global([data-mode='dark']) .home {
		--ground: var(--color-root-bg-dark);
		--ink: var(--color-surface-50);
		--accent: var(--color-primary-300);
	}
	/* A visitor who also kept the older sky flag: the room that flag keeps above the page is not kept above this one, from the first paint. */
	:global(html[data-sky] #main-content:has(> .home)) {
		padding-top: 0;
	}
	/* After a touch no tooltip shows. After a press with a mouse, one shows only while the mouse is over its control. */
	.home.touch :global([data-tip]::after) {
		opacity: 0 !important;
		transition: none !important;
	}
	.home:not(.keys) :global([data-tip]:focus-visible:not(:hover)::after),
	.home:not(.keys) :global(.poster:focus-visible:not(:hover) [data-tip]::after) {
		opacity: 0 !important;
	}
	.home :global(::selection) {
		color: var(--ground);
		background: var(--ink);
	}
</style>
