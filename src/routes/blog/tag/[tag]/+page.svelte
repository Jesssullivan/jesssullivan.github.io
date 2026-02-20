<script lang="ts">
	import type { PageData } from './$types';
	import { Tooltip } from '@skeletonlabs/skeleton-svelte';
	let { data }: { data: PageData } = $props();
</script>

<svelte:head>
	<title>Posts tagged "{data.tag}" | transscendsurvival.org</title>
</svelte:head>

<div class="container mx-auto px-4 py-12 max-w-3xl">
	<a href="/blog" class="text-sm text-primary-500 hover:underline mb-4 inline-block">&larr; All posts</a>
	<h1 class="text-3xl font-bold mb-8">Tagged: {data.tag}</h1>

	{#if data.posts.length === 0}
		<p class="text-surface-500">No posts with this tag.</p>
	{:else}
		<div class="space-y-6">
			{#each data.posts as post}
				<article class="card glass p-8 hover:ring-2 ring-primary-500 transition-all">
					<a href="/blog/{post.slug}" class="block">
						<div class="flex items-center gap-3 text-sm text-surface-500">
							<time>{new Date(post.date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</time>
							{#if post.reading_time}
								<span>&middot;</span>
								<Tooltip positioning={{ placement: 'top' }}>
									{#snippet trigger()}<span>{post.reading_time} min read</span>{/snippet}
									{#snippet content()}<span class="text-xs">~{(post.reading_time ?? 1) * 230} words</span>{/snippet}
								</Tooltip>
							{/if}
						</div>
						<h2 class="text-2xl font-semibold mt-2">{post.title}</h2>
						{#if post.description}
							<p class="text-surface-600-400 mt-2 line-clamp-3">{post.description}</p>
						{/if}
						{#if post.body_excerpt}
							<p class="text-sm text-surface-500 mt-2 line-clamp-3">{post.body_excerpt}</p>
						{/if}
					</a>
				</article>
			{/each}
		</div>
	{/if}
</div>
