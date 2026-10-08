<script lang="ts">
	import type { PageData } from './$types';
	import ReaderArchive from '#lib/components/reader/ReaderArchive.svelte';
	import ReaderLatest from '#lib/components/reader/ReaderLatest.svelte';
	import ReaderPulse from '#lib/components/reader/ReaderPulse.svelte';
	import ReaderConstellation from '#lib/components/reader/ReaderConstellation.svelte';
	import { resolveConstellationFlag } from '#lib/flags/constellation.js';
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import { createHomeReaderCollection } from '#lib/reader/homeProjection.js';
	import { loadTinylandBlogBrokerStream, tinylandBlogBrokerStreamToPosts } from '#lib/tinyland/blogBrokerStream.js';
	import { loadPulsePublicBrokerSnapshot } from '#lib/pulse/load.js';
	import type { PublicPulseSnapshotAny } from '#lib/pulse/snapshot.js';
	import type { Post } from '#lib/posts.js';
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
	$effect(() => {
		if (!mounted) return;
		const enabled = resolveConstellationFlag({ search: page.url.search, getStorage: () => window.localStorage });
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
	<title>Jess Sullivan — Latest, Pulse, Archive</title>
	<meta name="description" content="Posts and notes from Jess Sullivan." />
	<link rel="canonical" href="https://transscendsurvival.org/" />
	<meta property="og:title" content="Jess Sullivan — Writing and notes." />
	<meta property="og:description" content="Posts and notes from Jess Sullivan." />
	<meta property="og:type" content="website" />
	<meta property="og:url" content="https://transscendsurvival.org/" />
</svelte:head>

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

	{#if constellationEnabled}
		<div class="sr-only" aria-live="polite" data-testid="home-reader-broker-state">Blog {blogStatus}; Pulse {pulseStatus}.</div>
		<ReaderConstellation posts={experimentalCollection.latest} archive={experimentalCollection.archive} snapshot={experimentPulse ?? data.pulseSnapshot} />
	{/if}

	<div class="space-y-16">
		<ReaderLatest posts={data.collection.latest} />
		<ReaderPulse snapshot={data.pulseSnapshot} />
		<ReaderArchive archive={data.collection.archive} />
	</div>
</div>
