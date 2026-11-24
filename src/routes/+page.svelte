<script lang="ts">
	import type { PageData } from './$types';
	import ReaderArchive from '$lib/components/reader/ReaderArchive.svelte';
	import ReaderLatest from '$lib/components/reader/ReaderLatest.svelte';
	import ReaderPulse from '$lib/components/reader/ReaderPulse.svelte';
	import { resolveConstellationFlag } from '$lib/flags/constellation';
	import { onMount, type Component } from 'svelte';
	import { page } from '$app/state';
	import { createHomeReaderCollection } from '$lib/reader/homeProjection';
	import { loadTinylandBlogBrokerStream, tinylandBlogBrokerStreamToPosts } from '$lib/tinyland/blogBrokerStream';
	import { loadPulsePublicBrokerSnapshot } from '$lib/pulse/load';
	import type { PublicPulseSnapshotAny } from '$lib/pulse/snapshot';
	import type { Post } from '$lib/posts';
	import publicationHolds from '../../static/blog-publication-holds.json';

	let { data }: { data: PageData } = $props();
	let constellationEnabled = $state(false);
	// The section's code and styles load only with the flag: the default page carries none of them.
	let Constellation = $state<Component<{ archive?: PageData['collection']['archive']; focusSlug?: string | null }> | null>(null);
	let constellationRequested = false;
	let mounted = $state(false);
	let experimentPosts = $state<Post[] | null>(null);
	let experimentPulse = $state<PublicPulseSnapshotAny | null>(null);
	let blogStatus = $state('loading');
	let pulseStatus = $state('loading');
	let experimentalCollection = $derived(createHomeReaderCollection(data.collection.archive.flatMap(group => group.posts), experimentPosts ?? [], new Set(publicationHolds)));
	onMount(() => {
		mounted = true;
		return () => document.documentElement.removeAttribute('data-sky');
	});
	$effect(() => {
		if (!mounted) return;
		const enabled = resolveConstellationFlag({ search: page.url.search, getStorage: () => window.localStorage });
		constellationEnabled = enabled;
		// The sky's room is part of the page while the flag is on. On a fresh load the first-paint script in app.html has already set this.
		document.documentElement.toggleAttribute('data-sky', enabled);
		experimentPosts = null;
		experimentPulse = null;
		blogStatus = 'loading';
		pulseStatus = 'loading';
		if (!enabled) return;
		if (!constellationRequested) {
			constellationRequested = true;
			void import('$lib/components/reader/ReaderConstellation.svelte').then(module => { Constellation = module.default as typeof Constellation; }).catch(() => {
				// The section did not load: the page gives the room back.
				constellationRequested = false;
				document.documentElement.removeAttribute('data-sky');
			});
		}
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

{#if constellationEnabled}
	<div class="sr-only" aria-live="polite" data-testid="home-reader-broker-state">Blog {blogStatus}; Pulse {pulseStatus}.</div>
	<!-- Before the page's column, in the room the page keeps for it, so the sky runs edge to edge and the page opens onto it. -->
	{#if Constellation}
		<Constellation archive={experimentalCollection.archive} focusSlug={page.url.searchParams.get('focus')} />
	{/if}
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

<style>
	/*
	 * The constellation flag (TIN-8628). The flag is read in the browser, so the section is not in the
	 * page as built. The page keeps the sky's room from its first paint instead: the script in app.html
	 * marks the document before anything is drawn, and these rules pad the main column and the profile
	 * column by the sky's height. The section then lies in that room, and nothing moves when it loads.
	 * ReaderConstellation.svelte takes its height from the same property. Without the flag none of this applies.
	 */
	:global(html[data-sky]) { --sky-h: max(31rem, 86vh); }
	:global(html[data-sky] #main-content) { position: relative; padding-top: var(--sky-h); }
	:global(html[data-sky] #main-content + aside) { padding-top: var(--sky-h); }
	/* The banner's photo fades into the page above the sky, so the two join with no edge. The fade is short on a narrow screen, where the banner's words run close to its foot. */
	:global(html[data-sky] .hero-banner) {
		-webkit-mask-image: linear-gradient(to bottom, currentColor calc(100% - min(5rem, 4vw)), transparent);
		mask-image: linear-gradient(to bottom, currentColor calc(100% - min(5rem, 4vw)), transparent);
	}
	@supports (height: 1dvh) {
		:global(html[data-sky]) { --sky-h: max(31rem, 86dvh); }
	}
	/* A phone: the visible height below the site header, which is 5.25rem tall below 768px. From there up the header's height varies, and the sky takes the desktop's share. */
	@media (max-width: 767px) {
		:global(html[data-sky]) { --sky-h: max(28rem, calc(100vh - 5.25rem)); }
		@supports (height: 1dvh) {
			:global(html[data-sky]) { --sky-h: max(28rem, calc(100dvh - 5.25rem)); }
		}
	}
</style>
