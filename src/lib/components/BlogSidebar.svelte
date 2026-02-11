<script lang="ts">
	import type { Post } from '$lib/types';

	let {
		recentPosts = [],
		allTags = []
	}: {
		recentPosts: Post[];
		allTags: string[];
	} = $props();
</script>

<aside class="space-y-8">
	<!-- Recent Posts -->
	{#if recentPosts.length > 0}
		<div>
			<h3 class="font-heading text-sm font-bold uppercase tracking-wider text-surface-500 mb-3">
				Recent Posts
			</h3>
			<ul class="space-y-3">
				{#each recentPosts as post}
					<li>
						<a
							href="/blog/{post.slug}"
							class="block hover:text-primary-500 transition-colors"
						>
							<span class="text-sm font-medium leading-tight line-clamp-2">{post.title}</span>
							<time class="text-xs text-surface-500 mt-0.5 block">
								{new Date(post.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
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
			<h3 class="font-heading text-sm font-bold uppercase tracking-wider text-surface-500 mb-3">
				Tags
			</h3>
			<div class="flex flex-wrap gap-1.5">
				{#each allTags as tag}
					<a
						href="/blog/tag/{encodeURIComponent(tag)}"
						class="badge preset-outlined-surface-500 text-xs hover:preset-outlined-primary-500 transition-colors"
					>{tag}</a>
				{/each}
			</div>
		</div>
	{/if}
</aside>
