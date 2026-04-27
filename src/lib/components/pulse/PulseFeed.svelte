<script lang="ts">
	import type { PublicPulseSnapshot } from '@blog/pulse-core/schema';
	import PulseNoteCard from './PulseNoteCard.svelte';
	import PulseBirdCard from './PulseBirdCard.svelte';

	let { snapshot }: { snapshot: PublicPulseSnapshot } = $props();
</script>

{#if snapshot.items.length === 0}
	<p class="text-surface-600-400">No public events yet.</p>
{:else}
	<ol class="space-y-4">
		{#each snapshot.items as item (item.id)}
			<li>
				{#if item.kind === 'note'}
					<PulseNoteCard {item} />
				{:else if item.kind === 'bird_sighting'}
					<PulseBirdCard {item} />
				{/if}
			</li>
		{/each}
	</ol>
{/if}

<footer class="mt-6 text-xs text-surface-600-400 space-y-1">
	<p>
		Schema {snapshot.manifest.schemaVersion} · policy {snapshot.manifest.policyVersion} ·
		{snapshot.manifest.itemCount} items
	</p>
	<p>Generated {snapshot.manifest.generatedAt}</p>
</footer>
