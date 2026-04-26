<script lang="ts">
	import ActivityStream from '$lib/components/ActivityStream.svelte';
	import type { ResolvedActivity } from '$lib/activitypub/types';

	let { data }: { data: { activities: ResolvedActivity[] } } = $props();
</script>

<svelte:head>
	<title>Pulse — jesssullivan.github.io</title>
	<meta name="description" content="A living stream of what I'm up to — birds spotted, miles biked, code shipped, sensors polled, and the occasional note." />
</svelte:head>

<div class="max-w-2xl mx-auto py-8 px-4">
	<header class="mb-8">
		<h1 class="font-heading text-3xl font-bold">Pulse</h1>
		<p class="text-surface-600-400 mt-2 text-lg leading-relaxed">
			A living stream of what I'm up to — birds spotted, miles biked, code shipped, and the occasional note.
		</p>
	</header>

	<ActivityStream activities={data.activities} />
</div>
