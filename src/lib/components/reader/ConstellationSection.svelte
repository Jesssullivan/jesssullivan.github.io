<script lang="ts">
	import type { ConstellationGroup } from '$lib/reader/ledger';

	// The accessible, deterministic counterpart to the decorative masthead
	// constellation: the SAME nodes, grouped honestly by the metadata already on
	// each entry, exposed as native <details> disclosures (keyboard + AT native).
	let { groups }: { groups: ConstellationGroup[] } = $props();
</script>

{#if groups.length > 0}
	<section aria-labelledby="reader-constellation" class="space-y-2">
		<h2 id="reader-constellation" class="reader-kicker">
			Constellation · grouped by current category &amp; tag metadata
		</h2>
		<p class="text-xs text-surface-500 max-w-prose">
			The accessible, deterministic view behind the masthead — the same nodes, an honest label, keyboard-native
			disclosures. Not an embedding, not t-SNE.
		</p>

		{#each groups as group (group.key)}
			<details class="border-b border-surface-300-700">
				<summary class="cursor-pointer py-2 font-mono text-sm">
					{group.label}
					<span class="text-surface-500">· {group.nodes.length} {group.nodes.length === 1 ? 'entry' : 'entries'}</span>
				</summary>
				<ol class="pb-2 pl-4 space-y-1">
					{#each group.nodes as node (node.id)}
						<li class="text-sm text-surface-700-300">
							<a href={node.href} class="hover:text-primary-500 transition-colors">{node.label}</a>
						</li>
					{/each}
				</ol>
			</details>
		{/each}
	</section>
{/if}

<style>
	.reader-kicker {
		font-family: ui-monospace, 'SF Mono', SFMono-Regular, Menlo, monospace;
		font-size: 0.72rem;
		font-weight: 600;
		letter-spacing: 0.14em;
		text-transform: uppercase;
		opacity: 0.75;
	}
	summary:focus-visible {
		outline: 2px solid #c9a227;
		outline-offset: 2px;
	}
</style>
