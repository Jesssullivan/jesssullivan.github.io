<script lang="ts">
	import type { PageData } from './$types';
	import ReaderArchive from '$lib/components/reader/ReaderArchive.svelte';
	import ReaderLatest from '$lib/components/reader/ReaderLatest.svelte';
	import ReaderPulse from '$lib/components/reader/ReaderPulse.svelte';
	import ReaderConstellation from '$lib/components/reader/ReaderConstellation.svelte';
	import { createHomeReaderCollection } from '$lib/reader/homeProjection';
	import {
		loadTinylandBlogBrokerStream,
		TINYLAND_BLOG_BROKER_STREAM_URL,
		tinylandBlogBrokerStreamToPosts,
	} from '$lib/tinyland/blogBrokerStream';
	import { loadPulsePublicBrokerSnapshot, TINYLAND_PULSE_PUBLIC_SNAPSHOT_URL } from '$lib/pulse/load';
	import type { PublicPulseSnapshotAny } from '$lib/pulse/snapshot';
	import type { Post } from '$lib/posts';
	import { onMount } from 'svelte';

	let { data }: { data: PageData } = $props();
	let brokerPosts = $state<Post[] | null>(null);
	let brokerPulse = $state<PublicPulseSnapshotAny | null>(null);
	let blogStatus = $state<'loading' | 'ready' | 'unavailable'>('loading');
	let pulseStatus = $state<'loading' | 'ready' | 'unavailable'>('loading');
	let publicationHolds = $derived(new Set(data.publicationHolds));
	let collection = $derived(
		brokerPosts === null
			? data.collection
			: createHomeReaderCollection(
					data.collection.archive.flatMap((group) => group.posts),
					brokerPosts,
					publicationHolds,
				),
	);
	let pulseSnapshot = $derived(brokerPulse ?? data.pulseSnapshot);

	onMount(() => {
		let cancelled = false;
		const blogController = new AbortController();
		const pulseController = new AbortController();
		const blogTimer = window.setTimeout(() => blogController.abort(), 10_000);
		const pulseTimer = window.setTimeout(() => pulseController.abort(), 10_000);

		void loadTinylandBlogBrokerStream(fetch, {
			endpoint: TINYLAND_BLOG_BROKER_STREAM_URL,
			signal: blogController.signal,
		})
			.then((stream) => {
				if (cancelled) return;
				brokerPosts = tinylandBlogBrokerStreamToPosts(stream);
				blogStatus = 'ready';
			})
			.catch(() => {
				if (!cancelled) blogStatus = 'unavailable';
			})
			.finally(() => window.clearTimeout(blogTimer));

		void loadPulsePublicBrokerSnapshot(fetch, {
			endpoint: TINYLAND_PULSE_PUBLIC_SNAPSHOT_URL,
			signal: pulseController.signal,
		})
			.then((snapshot) => {
				if (cancelled) return;
				brokerPulse = snapshot;
				pulseStatus = 'ready';
			})
			.catch(() => {
				if (!cancelled) pulseStatus = 'unavailable';
			})
			.finally(() => window.clearTimeout(pulseTimer));

		return () => {
			cancelled = true;
			window.clearTimeout(blogTimer);
			window.clearTimeout(pulseTimer);
			blogController.abort();
			pulseController.abort();
		};
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
	<div class="sr-only" aria-live="polite" data-testid="home-reader-broker-state">
		Blog {blogStatus}; Pulse {pulseStatus}.
	</div>
	<header class="mb-12 max-w-3xl">
		<p class="text-sm text-surface-600-400 mb-2">Jess Sullivan</p>
		<h1 class="font-heading text-4xl font-bold">Writing and notes.</h1>
		<nav class="mt-5 flex flex-wrap gap-x-5 gap-y-2" aria-label="Reader sections">
			<a class="text-primary-500 hover:underline" href="#latest">Latest</a>
			<a class="text-primary-500 hover:underline" href="#pulse">Pulse</a>
			<a class="text-primary-500 hover:underline" href="#archive">Archive</a>
		</nav>
	</header>

	<ReaderConstellation posts={collection.latest} snapshot={pulseSnapshot} />

	<div class="space-y-16">
		<ReaderLatest posts={collection.latest} />
		<ReaderPulse snapshot={pulseSnapshot} />
		<ReaderArchive archive={collection.archive} />
	</div>
</div>
