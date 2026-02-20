<script lang="ts">
	import type { Post } from '$lib/types';
	import { onMount } from 'svelte';
	import { loadFlexSearch, searchFlexSearch, type SearchResult } from '$lib/search';

	let {
		recentPosts = [],
		allTags = []
	}: {
		recentPosts: Post[];
		allTags: string[];
	} = $props();

	let searchQuery = $state('');
	let searchResults = $state.raw<SearchResult[]>([]);
	let searchAvailable = $state(false);

	onMount(() => {
		loadFlexSearch().then((ok) => {
			searchAvailable = ok;
		});
	});

	$effect(() => {
		const query = searchQuery;
		if (!query.trim()) {
			searchResults = [];
			return;
		}
		searchResults = searchFlexSearch(query, 5);
	});
</script>

<aside class="space-y-8">
	<!-- Search -->
	<div>
		<h3 class="font-heading text-sm font-bold uppercase tracking-wider text-surface-500 mb-3">
			Search
		</h3>
		{#if searchAvailable}
			<input
				type="search"
				placeholder="Search posts..."
				bind:value={searchQuery}
				class="w-full px-3 py-1.5 rounded-lg border border-surface-300-700 bg-surface-50-950 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
			/>
			{#if searchQuery.trim() && searchResults.length > 0}
				<ul class="mt-3 space-y-2">
					{#each searchResults as result}
						<li>
							<a
								href="/blog/{result.slug}"
								class="block hover:text-primary-500 transition-colors"
							>
								<span class="text-sm font-medium leading-tight line-clamp-2"
									>{result.title}</span
								>
								<span class="text-xs text-surface-500 mt-0.5 block line-clamp-2"
									>{result.description}</span
								>
							</a>
						</li>
					{/each}
				</ul>
			{:else if searchQuery.trim() && searchResults.length === 0}
				<p class="text-xs text-surface-500 mt-2">No results found.</p>
			{/if}
		{:else}
			<p class="text-xs text-surface-500 italic">Search loading...</p>
		{/if}
	</div>

	<!-- Recent Posts -->
	{#if recentPosts.length > 0}
		<div>
			<h3
				class="font-heading text-sm font-bold uppercase tracking-wider text-surface-500 mb-3"
			>
				Recent Posts
			</h3>
			<ul class="space-y-3">
				{#each recentPosts as post}
					<li>
						<a
							href="/blog/{post.slug}"
							class="block hover:text-primary-500 transition-colors"
						>
							<span class="text-sm font-medium leading-tight line-clamp-2"
								>{post.title}</span
							>
							<time class="text-xs text-surface-500 mt-0.5 block">
								{new Date(post.date).toLocaleDateString('en-US', {
									month: 'short',
									day: 'numeric',
									year: 'numeric'
								})}
							</time>
						</a>
					</li>
				{/each}
			</ul>
		</div>
	{/if}

	<!-- Tags Cloud -->
	{#if allTags.length > 0}
		<div>
			<h3
				class="font-heading text-sm font-bold uppercase tracking-wider text-surface-500 mb-3"
			>
				Tags
			</h3>
			<div class="flex flex-wrap gap-1.5">
				{#each allTags as tag}
					<a
						href="/blog/tag/{encodeURIComponent(tag)}"
						class="badge preset-outlined-surface-500 text-xs hover:preset-outlined-primary-500 transition-colors"
						>{tag}</a
					>
				{/each}
			</div>
		</div>
	{/if}
</aside>
