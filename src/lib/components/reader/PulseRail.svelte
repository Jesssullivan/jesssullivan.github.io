<script lang="ts">
	import type { PublicPulseItem } from '@blog/pulse-core/schema';
	import PulseNoteCard from '$lib/components/pulse/PulseNoteCard.svelte';
	import PulseBirdCard from '$lib/components/pulse/PulseBirdCard.svelte';

	// The live rail. Renders EVERY snapshot item in producer order — never sliced,
	// never re-ranked — composing the #217 donor cards as-is. Missing/empty
	// snapshot degrades to a calm note; the page still renders.
	let { items }: { items: PublicPulseItem[] } = $props();
</script>

<aside aria-labelledby="reader-pulse" class="space-y-3">
	<h2 id="reader-pulse" class="reader-kicker">
		<span class="beacon" aria-hidden="true"></span> Pulse · live
	</h2>

	{#if items.length === 0}
		<p class="text-sm text-surface-500">No live items right now.</p>
	{:else}
		<ol class="space-y-3">
			{#each items as item (item.id)}
				<li>
					{#if item.kind === 'bird_sighting'}
						<PulseBirdCard {item} />
					{:else}
						<PulseNoteCard {item} />
					{/if}
				</li>
			{/each}
		</ol>
		<p class="font-mono text-xs text-surface-500">
			Producer order preserved — never re-ranked. {items.length} of {items.length} rendered.
		</p>
	{/if}
</aside>

<style>
	.reader-kicker {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		font-family: ui-monospace, 'SF Mono', SFMono-Regular, Menlo, monospace;
		font-size: 0.72rem;
		font-weight: 600;
		letter-spacing: 0.14em;
		text-transform: uppercase;
		opacity: 0.8;
	}
	.beacon {
		width: 7px;
		height: 7px;
		border-radius: 50%;
		background: #c9a227;
		flex: none;
	}
	@media (prefers-reduced-motion: no-preference) {
		.beacon {
			animation: pulse-arrive 1.6s ease-out 1;
		}
		@keyframes pulse-arrive {
			0% {
				box-shadow: 0 0 0 0 rgba(201, 162, 39, 0.55);
			}
			100% {
				box-shadow: 0 0 0 14px rgba(201, 162, 39, 0);
			}
		}
	}
</style>
