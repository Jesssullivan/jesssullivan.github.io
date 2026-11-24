<script lang="ts">
	// The home page behind ?flags=home (TIN-8657): the heading stage, then one mixed stream.
	// It has no footer and no side column, and it asks the network for nothing while it runs.
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import HomeStage from './HomeStage.svelte';
	import HomeStream from './HomeStream.svelte';
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
		arrives = false,
	}: {
		stream: StreamFile | null;
		archive: ReaderCollection['archive'];
		/** True when this page takes the place of one that has already painted, as the flag does on a production build. */
		arrives?: boolean;
	} = $props();

	const scenes = $derived(buildScenes(stream));
	let stage = $state<ReturnType<typeof HomeStage> | null>(null);
	let focusSlug = $state<string | null>(null);
	/** True once the device missed the stage's frame budget. The stream then arrives with no blur. */
	let calm = $state(false);

	onMount(() => {
		focusSlug = new URLSearchParams(page.url.search).get('focus');
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

<div class="home" class:calm data-testid="home-stage-stream">
	<h1 class="sr-only">Jess Sullivan</h1>
	<HomeStage bind:this={stage} {scenes} {archive} {focusSlug} {arrives} onstill={() => (calm = true)} />
	{#if stream}
		<HomeStream {stream} {arrives} onsky={() => stage?.showFirst()} />
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
	.home :global(::selection) {
		color: var(--ground);
		background: var(--ink);
	}
</style>
