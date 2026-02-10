<script lang="ts">
	import type { PageData } from './$types';
	import GiscusComments from '$lib/components/GiscusComments.svelte';
	import { onMount } from 'svelte';
	let { data }: { data: PageData } = $props();

	onMount(async () => {
		const diagrams = document.querySelectorAll('.mermaid-diagram[data-mermaid-code]');
		if (diagrams.length === 0) return;
		const mermaid = (await import('mermaid')).default;
		mermaid.initialize({ startOnLoad: false, theme: 'dark' });
		for (const el of diagrams) {
			const code = atob(el.getAttribute('data-mermaid-code') || '');
			const id = el.getAttribute('data-mermaid-id') || 'mermaid';
			try {
				const { svg } = await mermaid.render(id, code);
				el.innerHTML = svg;
			} catch {
				el.innerHTML = `<pre class="text-red-500">${code}</pre>`;
			}
		}
	});
</script>

<svelte:head>
	<title>{data.metadata.title} | transscendsurvival.org</title>
	{#if data.metadata.description}
		<meta name="description" content={data.metadata.description} />
	{/if}
	<meta property="og:title" content={data.metadata.title} />
	<meta property="og:type" content="article" />
	<meta property="og:url" content="https://transscendsurvival.org/blog/{data.metadata.slug}" />
	<meta property="og:site_name" content="transscendsurvival.org" />
	<meta property="article:published_time" content={data.metadata.date} />
	<meta property="article:author" content="Jess Sullivan" />
	{#if data.metadata.description}
		<meta property="og:description" content={data.metadata.description} />
	{/if}
	{#if data.metadata.tags?.length}
		{#each data.metadata.tags as tag}
			<meta property="article:tag" content={tag} />
		{/each}
	{/if}
	<meta name="twitter:card" content="summary" />
	<meta name="twitter:title" content={data.metadata.title} />
	{#if data.metadata.description}
		<meta name="twitter:description" content={data.metadata.description} />
	{/if}
	<link rel="canonical" href="https://transscendsurvival.org/blog/{data.metadata.slug}" />
	{@html `<script type="application/ld+json">${JSON.stringify({
		"@context": "https://schema.org",
		"@type": "BlogPosting",
		"headline": data.metadata.title,
		"datePublished": data.metadata.date,
		"author": { "@type": "Person", "name": "Jess Sullivan", "url": "https://github.com/Jesssullivan" },
		"publisher": { "@type": "Person", "name": "Jess Sullivan" },
		"url": `https://transscendsurvival.org/blog/${data.metadata.slug}`,
		...(data.metadata.description ? { "description": data.metadata.description } : {})
	})}</script>`}
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
		<p class="text-sm text-surface-500 mt-8 pt-4 border-t border-surface-300-700 italic">
			Originally published at <a href={data.metadata.original_url} class="text-primary-500 hover:underline">{new URL(data.metadata.original_url).hostname}</a>
		</p>
	{/if}

	<GiscusComments />
</article>
