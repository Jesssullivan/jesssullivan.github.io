<script lang="ts">
	import PulseFeed from '$lib/components/pulse/PulseFeed.svelte';
	import type { PublicPulseSnapshot } from '@blog/pulse-core/schema';

	let { data }: { data: { snapshot: PublicPulseSnapshot } } = $props();
</script>

<svelte:head>
	<title>Pulse — jesssullivan.github.io</title>
	<meta name="description" content="Notes and bird sightings published from the tinyland pulse broker." />
</svelte:head>

<div class="max-w-2xl mx-auto py-8 px-4">
	<header class="mb-8 space-y-2">
		<h1 class="font-heading text-3xl font-bold">Pulse</h1>
		<p class="text-surface-600-400 leading-relaxed">
			A small public-safe stream of notes and bird sightings, projected from the tinyland broker under the M1
			public-data policy.
		</p>
	</header>

	<PulseFeed snapshot={data.snapshot} />
</div>
