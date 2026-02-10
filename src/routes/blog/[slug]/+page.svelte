<script lang="ts">
	import type { PageData } from './$types';
	import GiscusComments from '$lib/components/GiscusComments.svelte';
	let { data }: { data: PageData } = $props();
</script>

<svelte:head>
	<title>{data.metadata.title} | transscendsurvival.org</title>
	{#if data.metadata.description}
		<meta name="description" content={data.metadata.description} />
	{/if}
</svelte:head>

<article class="container mx-auto px-4 py-12 max-w-3xl">
	<header class="mb-8">
		<a href="/blog" class="text-sm text-primary-500 hover:underline mb-4 inline-block">&larr; Back to blog</a>
		<h1 class="text-3xl font-bold mt-2">{data.metadata.title}</h1>
		<div class="flex items-center gap-3 mt-3 text-sm text-surface-500">
			<time>{new Date(data.metadata.date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</time>
		</div>
		{#if data.metadata.tags?.length}
			<div class="flex gap-2 mt-3">
				{#each data.metadata.tags as tag}
					<a href="/blog/tag/{encodeURIComponent(tag)}" class="badge preset-outlined-primary-500 text-xs hover:preset-filled-primary-500 transition-colors">{tag}</a>
				{/each}
			</div>
		{/if}
	</header>

	<div class="prose prose-lg max-w-none">
		{@render data.content()}
	</div>

	{#if data.metadata.original_url}
		<p class="text-sm text-surface-500 mt-8 italic">
			Originally published at <a href={data.metadata.original_url} class="text-primary-500 hover:underline">{data.metadata.original_url}</a>
		</p>
	{/if}

	<GiscusComments />
</article>
