<script lang="ts">
	import type { ConstellationGroup } from '$lib/reader/ledger';
	import TierBadge from '$lib/components/TierBadge.svelte';

	// The accessible, deterministic counterpart to the decorative masthead
	// constellation: the SAME nodes, grouped honestly by the metadata already on
	// each entry, exposed as native <details> disclosures (keyboard + AT native).
	// The canvas encodes three axes (tier as brightness, time as radius, topic as
	// tag-lines); this surface carries the same three — topic via grouping, tier
	// via TierBadge, time via <time datetime> in the nodes' date-desc order.
	let { groups }: { groups: ConstellationGroup[] } = $props();

	// Short, stable date label for the time axis. Absent date -> empty (guarded
	// by the {#if} below), so untimed nodes simply omit the <time>.
	function fmtDate(iso: string): string {
		const d = new Date(iso);
		if (Number.isNaN(d.getTime())) return '';
		return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
	}
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
						<li class="text-sm text-surface-700-300 flex items-baseline gap-2 flex-wrap">
							<a href={node.href} class="hover:text-primary-500 transition-colors">{node.label}</a>
							<TierBadge tier={node.tier} />
							{#if node.date}
								<time datetime={node.date} class="text-xs text-surface-500 tabular-nums">{fmtDate(node.date)}</time>
							{/if}
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
