<script lang="ts">
	import type { PublicPulseItem } from '@blog/pulse-core/schema';
	import TierBadge from '$lib/components/TierBadge.svelte';

	let { item }: { item: PublicPulseItem } = $props();

	const sighting = $derived(item.birdSighting);

	const formatted = $derived(
		new Date(item.occurredAt).toLocaleString(undefined, {
			dateStyle: 'medium',
			timeStyle: 'short',
		}),
	);
</script>

<article class="card preset-outlined-success-500 p-4 space-y-2">
	<header class="flex items-center justify-between gap-3 text-sm text-surface-600-400">
		<span class="flex items-center gap-2">
			<span aria-label="kind">🐦 bird sighting</span>
			<!-- Reader-weight tier, display-only. Renders nothing when salience is absent. -->
			<TierBadge tier={item.salience} />
		</span>
		<time datetime={item.occurredAt}>{formatted}</time>
	</header>
	{#if sighting}
		<div class="space-y-1">
			<p class="font-heading text-lg">
				{sighting.count > 1 ? `${sighting.count}× ` : ''}{sighting.commonName || sighting.scientificName}
			</p>
			{#if sighting.commonName && sighting.scientificName}
				<p class="text-sm italic text-surface-600-400">{sighting.scientificName}</p>
			{/if}
			{#if sighting.placeLabel}
				<p class="text-sm text-surface-600-400">📍 {sighting.placeLabel}</p>
			{/if}
		</div>
	{/if}
	{#if item.tags.length > 0}
		<ul class="flex flex-wrap gap-2 text-xs text-surface-600-400">
			{#each item.tags as tag (tag)}
				<li class="badge preset-outlined-success-500">#{tag}</li>
			{/each}
		</ul>
	{/if}
</article>
