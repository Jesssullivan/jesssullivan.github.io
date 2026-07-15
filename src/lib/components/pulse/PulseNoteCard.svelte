<script lang="ts">
	import type { PublicPulseItem } from '@blog/pulse-core/schema';
	import TierBadge from '$lib/components/TierBadge.svelte';

	let { item }: { item: PublicPulseItem } = $props();

	const formatted = $derived(
		new Date(item.occurredAt).toLocaleString(undefined, {
			dateStyle: 'medium',
			timeStyle: 'short',
		}),
	);
</script>

<article class="card preset-outlined-surface-500 p-4 space-y-2">
	<header class="flex items-center justify-between gap-3 text-sm text-surface-600-400">
		<span class="flex items-center gap-2">
			<span aria-label="kind">💬 note</span>
			<!-- Reader-weight tier, display-only. Renders nothing when salience is absent. -->
			<TierBadge tier={item.salience} />
		</span>
		<time datetime={item.occurredAt}>{formatted}</time>
	</header>
	<p class="leading-relaxed whitespace-pre-wrap">{item.content}</p>
	{#if item.tags.length > 0}
		<ul class="flex flex-wrap gap-2 text-xs text-surface-600-400">
			{#each item.tags as tag (tag)}
				<li class="badge preset-outlined-surface-500">#{tag}</li>
			{/each}
		</ul>
	{/if}
</article>
