<script lang="ts">
	import type { PageData } from './$types';
	let { data }: { data: PageData } = $props();

	const POSTS_PER_PAGE = 20;
	let currentPage = $state(0);

	let totalPages = $derived(Math.ceil(data.posts.length / POSTS_PER_PAGE));
	let paginatedPosts = $derived(
		data.posts.slice(currentPage * POSTS_PER_PAGE, (currentPage + 1) * POSTS_PER_PAGE)
	);

	// Collect all unique tags
	let allTags = $derived(
		[...new Set(data.posts.flatMap(p => p.tags))].sort()
	);
</script>

<svelte:head>
	<title>Blog | transscendsurvival.org</title>
	<meta name="description" content="Blog posts by Jess Sullivan" />
</svelte:head>

<div class="container mx-auto px-4 py-12 max-w-3xl">
	<div class="flex items-baseline justify-between mb-8">
		<h1 class="text-3xl font-bold">Blog</h1>
		<span class="text-sm text-surface-500">{data.posts.length} posts</span>
	</div>

	{#if allTags.length > 0}
		<div class="flex flex-wrap gap-2 mb-8">
			{#each allTags as tag}
				<a
					href="/blog/tag/{encodeURIComponent(tag)}"
					class="badge preset-outlined-surface-500 text-xs hover:preset-outlined-primary-500 transition-colors"
				>{tag}</a>
			{/each}
		</div>
	{/if}

	{#if paginatedPosts.length === 0}
		<p class="text-surface-500">No posts yet.</p>
	{:else}
		<div class="space-y-6">
			{#each paginatedPosts as post}
				<article class="card p-6 hover:ring-2 ring-primary-500 transition-all">
					<a href="/blog/{post.slug}" class="block">
						<time class="text-sm text-surface-500">{new Date(post.date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</time>
						<h2 class="text-xl font-semibold mt-1">{post.title}</h2>
						{#if post.description}
							<p class="text-surface-600-400 mt-2 line-clamp-3">{post.description}</p>
						{/if}
					</a>
					{#if post.tags.length > 0}
						<div class="flex gap-2 mt-3">
							{#each post.tags as tag}
								<a href="/blog/tag/{encodeURIComponent(tag)}" class="badge preset-outlined-primary-500 text-xs hover:preset-filled-primary-500 transition-colors">{tag}</a>
							{/each}
						</div>
					{/if}
				</article>
			{/each}
		</div>

		{#if totalPages > 1}
			<nav class="flex items-center justify-center gap-2 mt-8">
				<button
					class="btn btn-sm preset-outlined-surface-500"
					disabled={currentPage === 0}
					onclick={() => currentPage--}
				>&larr; Newer</button>
				<span class="text-sm text-surface-500">
					Page {currentPage + 1} of {totalPages}
				</span>
				<button
					class="btn btn-sm preset-outlined-surface-500"
					disabled={currentPage >= totalPages - 1}
					onclick={() => currentPage++}
				>Older &rarr;</button>
			</nav>
		{/if}
	{/if}
</div>
