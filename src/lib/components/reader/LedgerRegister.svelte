<script lang="ts">
	import type { Post } from '$lib/types';
	import TierBadge from '$lib/components/TierBadge.svelte';

	// Register 02 — the quieter ledger: a dense, type-first table of the entries
	// that are not headlined in register 01. Capped at `cap` rows per the ratified
	// Broadsheet stance, with the full paginated archive a click away. Each row's
	// TierBadge renders ONLY when that post carries an explicit tier — untiered
	// rows show no badge (never inferred).
	let {
		rows,
		heading = 'The ledger',
		index = '02',
		archiveTotal,
		cap = 8,
	}: { rows: Post[]; heading?: string; index?: string; archiveTotal?: number; cap?: number } = $props();

	const shown = $derived(rows.slice(0, cap));
	const total = $derived(archiveTotal ?? rows.length);

	function monthDay(iso: string): string {
		if (!iso) return '';
		const d = new Date(iso);
		return `${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
	}
</script>

{#if rows.length > 0}
	<section aria-labelledby="reader-reg-{index}" class="space-y-3">
		<h2 id="reader-reg-{index}" class="reader-kicker">
			{index} · {heading}
			<span class="reader-count">
				{shown.length} of {rows.length}{#if rows.length > cap}
					· rest in archive{/if}
			</span>
		</h2>

		<table class="w-full text-sm">
			<tbody>
				{#each shown as post (post.slug)}
					<tr class="border-b border-surface-300-700 align-baseline">
						<td class="py-2 pr-3 font-mono text-xs text-surface-500 tabular-nums whitespace-nowrap w-[5em]">
							{monthDay(post.date)}
						</td>
						<td class="py-2 pr-3">
							<TierBadge tier={post.editorial_tier} class="mr-1 align-middle" />
							<a href="/blog/{post.slug}" class="hover:text-primary-500 transition-colors">{post.title}</a>
						</td>
						{#if post.category}
							<td class="py-2 font-mono text-xs text-surface-500 text-right whitespace-nowrap">{post.category}</td>
						{:else}
							<td class="py-2"></td>
						{/if}
					</tr>
				{/each}
			</tbody>
		</table>

		<p class="font-mono text-xs">
			<a href="/blog" class="text-surface-600-400 hover:text-primary-500 transition-colors">
				Full archive at /blog — {total} entries →
			</a>
		</p>
	</section>
{/if}

<style>
	.reader-kicker {
		display: flex;
		align-items: baseline;
		gap: 0.6rem;
		font-family: ui-monospace, 'SF Mono', SFMono-Regular, Menlo, monospace;
		font-size: 0.72rem;
		font-weight: 600;
		letter-spacing: 0.14em;
		text-transform: uppercase;
		opacity: 0.75;
	}
	.reader-count {
		letter-spacing: 0;
		text-transform: none;
		opacity: 0.7;
		font-weight: 400;
	}
</style>
