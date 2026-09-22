<script lang="ts">
	import BlogCard from '$lib/components/BlogCard.svelte';
	import type { Post } from '$lib/posts';

	let { posts }: { posts: Post[] } = $props();
</script>

<section id="latest" aria-labelledby="latest-heading">
	<div class="flex flex-wrap items-baseline justify-between gap-3 mb-5">
		<div>
			<h2 id="latest-heading" class="font-heading text-2xl font-bold">Latest</h2>
			<p class="text-surface-600-400 mt-1">Recent posts from the public blog archive.</p>
		</div>
		<a class="text-sm text-primary-500 hover:underline" href="#archive">Browse the archive</a>
	</div>

	{#if posts.length > 0}
		<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
			{#each posts as post (post.slug)}
				<BlogCard {post} />
			{/each}
		</div>
	{:else}
		<p class="text-surface-600-400">No public posts yet.</p>
	{/if}
</section>
