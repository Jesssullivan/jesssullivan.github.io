<script lang="ts">
	import PulseFeed from '$lib/components/pulse/PulseFeed.svelte';
	import type { PublicPulseSnapshotAny } from '$lib/pulse/snapshot';

	let { snapshot }: { snapshot: PublicPulseSnapshotAny } = $props();
</script>

<section id="pulse" aria-labelledby="pulse-heading">
	<div class="flex flex-wrap items-baseline justify-between gap-3 mb-5">
		<div>
			<h2 id="pulse-heading" class="font-heading text-2xl font-bold">Pulse</h2>
			<p class="text-surface-600-400 mt-1">Notes and bird sightings.</p>
		</div>
		<a class="text-sm text-primary-500 hover:underline" href="/pulse">Open Pulse</a>
	</div>
	<PulseFeed {snapshot} />
</section>
