<script lang="ts">
	import type { PageData } from './$types';
	import ReaderArchive from '$lib/components/reader/ReaderArchive.svelte';
	import ReaderLatest from '$lib/components/reader/ReaderLatest.svelte';
	import ReaderPulse from '$lib/components/reader/ReaderPulse.svelte';
	import ReaderConstellation from '$lib/components/reader/ReaderConstellation.svelte';

	let { data }: { data: PageData } = $props();
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

	<ReaderConstellation posts={data.collection.latest} snapshot={data.pulseSnapshot} />

	<div class="space-y-16">
		<ReaderLatest posts={data.collection.latest} />
		<ReaderPulse snapshot={data.pulseSnapshot} />
		<ReaderArchive archive={data.collection.archive} />
	</div>
</div>
