<script lang="ts">
	import type { PageData } from './$types';
	import GiscusComments from '$lib/components/GiscusComments.svelte';
	import TableOfContents from '$lib/components/TableOfContents.svelte';
	import Breadcrumbs from '$lib/components/Breadcrumbs.svelte';
	import { onMount } from 'svelte';
	let { data }: { data: PageData } = $props();

	onMount(async () => {
		// Mermaid diagrams
		const diagrams = document.querySelectorAll('.mermaid-diagram[data-mermaid-code]');
		if (diagrams.length > 0) {
			const mermaid = (await import('mermaid')).default;
			const mode = document.documentElement.getAttribute('data-mode') || 'dark';
			mermaid.initialize({ startOnLoad: false, theme: mode === 'dark' ? 'dark' : 'default' });
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
		}

		// Code copy buttons
		document.querySelectorAll('.prose pre').forEach((pre) => {
			const wrapper = document.createElement('div');
			wrapper.className = 'relative group';
			pre.parentNode?.insertBefore(wrapper, pre);
			wrapper.appendChild(pre);

			const btn = document.createElement('button');
			btn.className =
				'absolute top-2 right-2 px-2 py-1 text-xs rounded bg-surface-700 text-surface-200 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer';
			btn.textContent = 'Copy';
			btn.addEventListener('click', () => {
				const code = pre.querySelector('code')?.textContent || pre.textContent || '';
				navigator.clipboard.writeText(code).then(() => {
					btn.textContent = 'Copied!';
					setTimeout(() => (btn.textContent = 'Copy'), 1500);
				});
			});
			wrapper.appendChild(btn);
		});

		// Heading anchors
		document.querySelectorAll('.prose h2, .prose h3, .prose h4').forEach((heading) => {
			const text = heading.textContent || '';
			const id =
				heading.id ||
				text
					.toLowerCase()
					.replace(/[^\w\s-]/g, '')
					.replace(/\s+/g, '-')
					.replace(/-+/g, '-')
					.trim();
			heading.id = id;

			const link = document.createElement('a');
			link.href = `#${id}`;
			link.className = 'heading-anchor';
			link.setAttribute('aria-label', `Link to ${text}`);
			link.textContent = '#';
			heading.prepend(link);
		});
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

<article class="container mx-auto px-4 py-12 max-w-5xl">
	<div class="grid grid-cols-1 lg:grid-cols-[1fr_220px] gap-8">
		<div class="min-w-0">
			<header class="mb-8">
				<Breadcrumbs crumbs={[
					{ label: 'Home', href: '/' },
					{ label: 'Blog', href: '/blog' },
					{ label: data.metadata.title, href: `/blog/${data.metadata.slug}` }
				]} />
				<h1 class="text-3xl font-bold mt-2">{data.metadata.title}</h1>
				<div class="flex items-center gap-3 mt-3 text-sm text-surface-500">
					<time>{new Date(data.metadata.date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</time>
					{#if data.reading_time}
						<span>&middot;</span>
						<span>{data.reading_time} min read</span>
					{/if}
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

			{#if data.prev || data.next}
				<nav class="flex justify-between items-start mt-8 pt-6 border-t border-surface-300-700 gap-4">
					{#if data.prev}
						<a href="/blog/{data.prev.slug}" class="text-sm text-primary-500 hover:underline max-w-[45%]">
							&larr; {data.prev.title}
						</a>
					{:else}
						<span></span>
					{/if}
					{#if data.next}
						<a href="/blog/{data.next.slug}" class="text-sm text-primary-500 hover:underline text-right max-w-[45%]">
							{data.next.title} &rarr;
						</a>
					{:else}
						<span></span>
					{/if}
				</nav>
			{/if}

			<GiscusComments />
		</div>

		<TableOfContents />
	</div>
</article>

<style>
	:global(.heading-anchor) {
		opacity: 0;
		margin-right: 0.25rem;
		color: var(--color-primary-500);
		text-decoration: none;
		font-weight: normal;
		transition: opacity 0.15s;
	}
	:global(h2:hover .heading-anchor),
	:global(h3:hover .heading-anchor),
	:global(h4:hover .heading-anchor) {
		opacity: 1;
	}
</style>
