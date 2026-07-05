<script lang="ts">
	import type { PageData } from './$types';
	import type { StreamItem } from '$lib/stream/blend';
	import TierBadge from '$lib/components/TierBadge.svelte';

	let { data }: { data: PageData } = $props();

	const items = $derived(data.items as StreamItem[]);

	// Kind indicator — a small, accessible label per source. Pulse sub-kinds get
	// their own glyph so a blended timeline still reads at a glance.
	function kindLabel(item: StreamItem): string {
		if (item.kind === 'post') return '📝 post';
		if (item.pulseKind === 'bird_sighting') return '🐦 bird sighting';
		return '💬 note';
	}

	function accentClass(item: StreamItem): string {
		if (item.kind === 'post') return 'preset-outlined-primary-500';
		if (item.pulseKind === 'bird_sighting') return 'preset-outlined-success-500';
		return 'preset-outlined-surface-500';
	}

	function formatDate(value: string): string {
		const d = new Date(value);
		// Pulse items carry a time; posts are date-only (UTC midnight) — show the
		// time only when it is meaningful.
		const hasTime = /T\d{2}:\d{2}/.test(value);
		return d.toLocaleString(undefined, {
			dateStyle: 'medium',
			...(hasTime ? { timeStyle: 'short' } : {}),
		});
	}
</script>

<svelte:head>
	<title>Stream — transscendsurvival.org</title>
	<meta
		name="description"
		content="A blended, reverse-chronological ingestion timeline of long-form posts and public pulse items."
	/>
	<!-- Shadow ingestion surface is HELD-for-freeze: shadow-only, never indexed. -->
	<meta name="robots" content="noindex,nofollow" />
</svelte:head>

<div class="max-w-2xl mx-auto py-8 px-4">
	<header class="mb-8 space-y-2">
		<h1 class="font-heading text-3xl font-bold">Stream</h1>
		<p class="text-surface-600-400 leading-relaxed">
			One blended timeline: long-form <a href="/blog" class="underline hover:text-primary-500">posts</a> and public
			<a href="/pulse" class="underline hover:text-primary-500">pulse</a> items, interleaved in reverse chronological order
			with a gentle reader-weight lift for noteworthy entries.
		</p>
		<p class="text-xs text-surface-500">{items.length} items</p>
	</header>

	{#if items.length === 0}
		<p class="text-surface-600-400">Nothing in the stream yet.</p>
	{:else}
		<ol class="space-y-4">
			{#each items as item (item.id)}
				<li>
					<article class="card {accentClass(item)} p-4 space-y-2" data-kind={item.kind}>
						<header class="flex items-center justify-between gap-3 text-sm text-surface-600-400">
							<span class="flex items-center gap-2">
								<span aria-label="kind">{kindLabel(item)}</span>
								<TierBadge tier={item.tier} />
							</span>
							<time datetime={item.date}>{formatDate(item.date)}</time>
						</header>
						<h2 class="font-heading text-lg leading-snug">
							<a href={item.url} class="hover:text-primary-500 transition-colors">{item.title}</a>
						</h2>
						{#if item.summary}
							<p class="text-sm text-surface-600-400 leading-relaxed line-clamp-3">{item.summary}</p>
						{/if}
					</article>
				</li>
			{/each}
		</ol>
	{/if}
</div>
