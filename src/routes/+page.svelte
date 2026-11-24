<script lang="ts">
	import type { PageData } from './$types';
	import ReaderArchive from '$lib/components/reader/ReaderArchive.svelte';
	import ReaderLatest from '$lib/components/reader/ReaderLatest.svelte';
	import ReaderPulse from '$lib/components/reader/ReaderPulse.svelte';
	import ReaderConstellation from '$lib/components/reader/ReaderConstellation.svelte';
	import { resolveConstellationFlag } from '$lib/flags/constellation';
	import { askHome, homeFlag, homeLoaded, type HomeLoaded, type HomeView } from '$lib/flags/home-state.svelte';
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import { createHomeReaderCollection } from '$lib/reader/homeProjection';
	import { loadTinylandBlogBrokerStream, tinylandBlogBrokerStreamToPosts } from '$lib/tinyland/blogBrokerStream';
	import { loadPulsePublicBrokerSnapshot } from '$lib/pulse/load';
	import type { PublicPulseSnapshotAny } from '$lib/pulse/snapshot';
	import type { Post } from '$lib/posts';
	import publicationHolds from '../../static/blog-publication-holds.json';

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
	// A production build keeps the ordinary page whole until both have arrived, then the two change places in one step.
	// svelte-ignore state_referenced_locally
	const prerenderedHome = data.home ? ({ Home: data.home.Home as unknown as HomeView, stream: data.home.stream } satisfies HomeLoaded) : null;
	const home = $derived(homeFlag.on && homeFlag.ready ? (prerenderedHome ?? homeLoaded()) : null);
	$effect(() => {
		if (!homeFlag.on || homeFlag.ready) return;
		askHome(async () => {
			const [module, stream] = await Promise.all([import('$lib/components/home/Home.svelte'), import('$lib/home/load').then(({ loadHomeStream }) => loadHomeStream(fetch))]);
			return { Home: module.default as unknown as HomeView, stream };
		});
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
	{#if !home}
		<title>Jess Sullivan — Latest, Pulse, Archive</title>
		<meta name="description" content="Posts and notes from Jess Sullivan." />
		<link rel="canonical" href="https://transscendsurvival.org/" />
		<meta property="og:title" content="Jess Sullivan — Writing and notes." />
		<meta property="og:description" content="Posts and notes from Jess Sullivan." />
		<meta property="og:type" content="website" />
		<meta property="og:url" content="https://transscendsurvival.org/" />
	{/if}
</svelte:head>

{#if home}
	<home.Home stream={home.stream} archive={data.collection.archive} arrives={!prerenderedHome} />
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
