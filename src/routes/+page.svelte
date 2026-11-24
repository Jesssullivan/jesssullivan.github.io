<script lang="ts">
	import type { PageData } from './$types';
	import ReaderArchive from '$lib/components/reader/ReaderArchive.svelte';
	import ReaderLatest from '$lib/components/reader/ReaderLatest.svelte';
	import ReaderPulse from '$lib/components/reader/ReaderPulse.svelte';
	import ReaderConstellation from '$lib/components/reader/ReaderConstellation.svelte';
	import { resolveConstellationFlag } from '$lib/flags/constellation';
	import { homeFlag } from '$lib/flags/home-state.svelte';
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import { createHomeReaderCollection } from '$lib/reader/homeProjection';
	import { loadTinylandBlogBrokerStream, tinylandBlogBrokerStreamToPosts } from '$lib/tinyland/blogBrokerStream';
	import { loadPulsePublicBrokerSnapshot } from '$lib/pulse/load';
	import type { PublicPulseSnapshotAny } from '$lib/pulse/snapshot';
	import type { Post } from '$lib/posts';
	import publicationHolds from '../../static/blog-publication-holds.json';
	import type { Component } from 'svelte';
	import type { StreamFile } from '$lib/home/stream';

	let { data }: { data: PageData } = $props();
	let constellationEnabled = $state(false);
	let mounted = $state(false);
	let experimentPosts = $state<Post[] | null>(null);
	let experimentPulse = $state<PublicPulseSnapshotAny | null>(null);
	let blogStatus = $state('loading');
	let pulseStatus = $state('loading');
	let experimentalCollection = $derived(createHomeReaderCollection(data.collection.archive.flatMap(group => group.posts), experimentPosts ?? [], new Set(publicationHolds)));
	onMount(() => { mounted = true; });

	// TIN-8657: the heading stage and the stream, behind ?flags=home. The layout resolves the flag.
	// A preview build hands both over from the load, already prerendered. Otherwise the code and the
	// data file are asked for only once the flag is on, so the default page loads nothing new.
	type HomeView = Component<{ stream: StreamFile | null; archive: PageData['collection']['archive'] }>;
	// svelte-ignore state_referenced_locally
	let Home = $state<HomeView | null>((data.home?.Home as HomeView | undefined) ?? null);
	// svelte-ignore state_referenced_locally
	let homeStream = $state<StreamFile | null>(data.home?.stream ?? null);
	let homeAsked = false;
	$effect(() => {
		if (!homeFlag.on || homeAsked || (Home && homeStream)) return;
		homeAsked = true;
		void import('$lib/components/home/Home.svelte').then((module) => (Home = module.default as unknown as HomeView));
		void import('$lib/home/load').then(({ loadHomeStream }) => loadHomeStream(fetch)).then((stream) => (homeStream = stream)).catch(() => {});
	});

	$effect(() => {
		if (!mounted) return;
		// The stage carries the constellation as its first scene, so the older flag stands down beside it.
		const enabled = !homeFlag.on && resolveConstellationFlag({ search: page.url.search, getStorage: () => window.localStorage });
		constellationEnabled = enabled;
		experimentPosts = null;
		experimentPulse = null;
		blogStatus = 'loading';
		pulseStatus = 'loading';
		if (!enabled) return;
		const controller = new AbortController();
		let cancelled = false;
		const timer = window.setTimeout(() => controller.abort(), 10_000);
		void Promise.allSettled([
			loadTinylandBlogBrokerStream(fetch, { signal: controller.signal }).then(stream => {
				if (!cancelled) { experimentPosts = tinylandBlogBrokerStreamToPosts(stream); blogStatus = 'ready'; }
			}).catch(() => { if (!cancelled) blogStatus = 'unavailable'; }),
			loadPulsePublicBrokerSnapshot(fetch, { signal: controller.signal }).then(snapshot => {
				if (!cancelled) { experimentPulse = snapshot; pulseStatus = 'ready'; }
			}).catch(() => { if (!cancelled) pulseStatus = 'unavailable'; }),
		]).finally(() => window.clearTimeout(timer));
		return () => { cancelled = true; window.clearTimeout(timer); controller.abort(); };
	});
</script>

<svelte:head>
	{#if !(homeFlag.on && Home)}
		<title>Jess Sullivan — Latest, Pulse, Archive</title>
		<meta name="description" content="Posts and notes from Jess Sullivan." />
		<link rel="canonical" href="https://transscendsurvival.org/" />
		<meta property="og:title" content="Jess Sullivan — Writing and notes." />
		<meta property="og:description" content="Posts and notes from Jess Sullivan." />
		<meta property="og:type" content="website" />
		<meta property="og:url" content="https://transscendsurvival.org/" />
	{/if}
</svelte:head>

{#if homeFlag.on && Home}
	<Home stream={homeStream} archive={data.collection.archive} />
{:else if homeFlag.on}
	<!-- The flag is on and the page's code is on its way: hold the stage's room so nothing jumps. -->
	<div class="home-wait" aria-hidden="true"></div>
{:else}

{#if constellationEnabled}
	<!-- Before the page's column, so the sky can run edge to edge and the page opens onto it. -->
	<div class="sr-only" aria-live="polite" data-testid="home-reader-broker-state">Blog {blogStatus}; Pulse {pulseStatus}.</div>
	<ReaderConstellation arrives archive={experimentalCollection.archive} focusSlug={page.url.searchParams.get('focus')} />
{/if}

<div class="container mx-auto px-4 py-12 max-w-6xl" data-pagefind-body>
	<header class="mb-12 max-w-3xl">
		<p class="text-sm text-surface-600-400 mb-2">Jess Sullivan</p>
		<h1 class="font-heading text-4xl font-bold">Writing and notes.</h1>
		<nav class="mt-5 flex flex-wrap gap-x-5 gap-y-2" aria-label="Reader sections">
			<a class="text-primary-500 hover:underline" href="#latest">Latest</a>
			<a class="text-primary-500 hover:underline" href="#pulse">Pulse</a>
			<a class="text-primary-500 hover:underline" href="#archive">Archive</a>
		</nav>
	</header>

	<div class="space-y-16">
		<ReaderLatest posts={data.collection.latest} />
		<!-- With the flag on, Pulse shows the reviewed public snapshot the broker serves, when it has loaded. -->
		<ReaderPulse snapshot={experimentPulse ?? data.pulseSnapshot} />
		<ReaderArchive archive={data.collection.archive} />
	</div>
</div>
{/if}
