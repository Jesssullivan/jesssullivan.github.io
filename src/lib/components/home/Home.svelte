<script lang="ts">
	// The home page behind ?flags=home (TIN-8657): the heading stage, then one mixed stream.
	// It has no footer and no side column, and it asks the network for nothing while it runs.
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import HomeStage from './HomeStage.svelte';
	import HomeStream from './HomeStream.svelte';
	import { buildScenes } from '$lib/home/scenes';
	import type { StreamFile } from '$lib/home/stream';
	import type { PublicPulseSnapshotAny } from '$lib/pulse/snapshot';
	import type { ReaderCollection } from '$lib/reader/collection';

	let {
		stream,
		archive,
		snapshot,
	}: {
		/** Null while the data file is on its way, in a build that does not prerender this page. */
		stream: StreamFile | null;
		archive: ReaderCollection['archive'];
		snapshot: PublicPulseSnapshotAny;
	} = $props();

	const scenes = $derived(buildScenes(stream));
	let stage = $state<ReturnType<typeof HomeStage> | null>(null);
	let focusSlug = $state<string | null>(null);

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
</svelte:head>

<div class="home" data-testid="home-stage-stream">
	<h1 class="sr-only">Jess Sullivan</h1>
	<HomeStage bind:this={stage} {scenes} {archive} {snapshot} {focusSlug} />
	{#if stream}
		<HomeStream {stream} onsky={() => stage?.showFirst()} />
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
