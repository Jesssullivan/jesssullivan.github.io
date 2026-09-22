<script lang="ts">
	import type { Post } from '$lib/posts';

	let { archive }: { archive: ReadonlyArray<{ year: string; posts: Post[] }> } = $props();
</script>

<section id="archive" aria-labelledby="archive-heading">
	<h2 id="archive-heading" class="font-heading text-2xl font-bold">Archive</h2>
	<p class="text-surface-600-400 mt-1 mb-5">Every public post has a permanent blog address.</p>

	<div class="space-y-8">
		{#each archive as group (group.year)}
			<section aria-labelledby={`archive-${group.year}`}>
				<h3 id={`archive-${group.year}`} class="font-heading text-xl font-semibold mb-3">{group.year}</h3>
				<ul class="space-y-2">
					{#each group.posts as post (post.slug)}
						<li>
							<a class="text-primary-500 hover:underline" href={`/blog/${post.slug}`} aria-label={`Read ${post.title}`}>{post.title}</a>
							<time class="ml-2 text-sm text-surface-600-400" datetime={post.date}>{post.date}</time>
						</li>
					{/each}
				</ul>
			</section>
		{/each}
	</div>
</section>
