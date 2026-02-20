<script lang="ts">
	import type { PageData } from './$types';
	import Search from '$lib/components/Search.svelte';
	import BlogSidebar from '$lib/components/BlogSidebar.svelte';
	import ProfileSidebar from '$lib/components/ProfileSidebar.svelte';
	import { page } from '$app/stores';
	import { browser } from '$app/environment';
	let { data }: { data: PageData } = $props();

	const POSTS_PER_PAGE = 20;

	let totalPages = $derived(Math.ceil(data.posts.length / POSTS_PER_PAGE));
	let pageParam = $derived(
		browser ? parseInt($page.url.searchParams.get('page') || '1') : 1
	);
	let currentPage = $derived(
		Math.max(0, Math.min(pageParam - 1, totalPages - 1))
	);
	let paginatedPosts = $derived(
		data.posts.slice(currentPage * POSTS_PER_PAGE, (currentPage + 1) * POSTS_PER_PAGE)
	);

	// Collect all unique tags
	let allTags = $derived(
		[...new Set(data.posts.flatMap(p => p.tags))].sort()
	);

	// Recent 5 posts for sidebar
	let recentPosts = $derived(data.posts.slice(0, 5));
</script>

<svelte:head>
	<title>Blog | transscendsurvival.org</title>
	<meta name="description" content="Blog posts by Jess Sullivan — hardware, FOSS, birding, ecology, and more." />
	<meta property="og:title" content="Blog | transscendsurvival.org" />
	<meta property="og:description" content="Blog posts by Jess Sullivan — hardware, FOSS, birding, ecology, and more." />
	<meta property="og:type" content="website" />
	<meta property="og:url" content="https://transscendsurvival.org/blog" />
	<meta name="twitter:card" content="summary" />
	<link rel="canonical" href="https://transscendsurvival.org/blog" />
</svelte:head>

<div class="container mx-auto px-4 py-12 max-w-5xl">
	<div class="flex items-baseline justify-between mb-8">
		<h1 class="font-heading text-3xl font-bold">Blog</h1>
		<span class="text-sm text-surface-500">{data.posts.length} posts</span>
	</div>

	<!-- Mobile profile (visible on small screens only) -->
	<div class="lg:hidden mb-6">
		<ProfileSidebar compact={true} />
	</div>

	<div class="grid grid-cols-1 lg:grid-cols-[1fr_250px] gap-8">
		<!-- Main content column -->
		<div>
			<Search />

			{#if allTags.length > 0}
				<div class="flex flex-wrap gap-2 mb-8 lg:hidden">
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
						<article class="card glass p-6 hover:ring-2 ring-primary-500 transition-all {post.featured ? 'ring-1 ring-primary-300' : ''}">
							<a href="/blog/{post.slug}" class="block">
								{#if post.featured}
									<div class="flex items-center gap-1 text-xs text-primary-500 font-semibold mb-1">
										<svg xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/></svg>
										Featured
									</div>
								{/if}
								<div class="{post.feature_image ? 'sm:flex sm:gap-4' : ''}">
									{#if post.feature_image}
										<div class="sm:w-32 sm:h-24 sm:flex-shrink-0 mb-3 sm:mb-0">
											<img src={post.feature_image} alt="" class="w-full h-32 sm:h-24 object-cover rounded-lg" loading="lazy" />
										</div>
									{/if}
									<div class="flex-1 min-w-0">
										<div class="flex items-center gap-3 text-sm text-surface-500">
											<time>{new Date(post.date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</time>
											{#if post.reading_time}
												<span>&middot;</span>
												<span>{post.reading_time} min read</span>
											{/if}
											{#if post.category}
												<span>&middot;</span>
												<span class="badge preset-outlined-surface-500 text-xs capitalize">{post.category}</span>
											{/if}
										</div>
										<h2 class="text-xl font-semibold mt-1">{post.title}</h2>
										{#if post.description}
											<p class="text-surface-600-400 mt-2 line-clamp-5">{post.description}</p>
										{/if}
									</div>
								</div>
							</a>
							{#if post.tags.length > 0}
								<div class="flex flex-wrap gap-2 mt-3">
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
						{#if currentPage > 0}
							<a
								href="/blog?page={currentPage}"
								class="btn btn-sm preset-outlined-surface-500"
							>&larr; Newer</a>
						{:else}
							<span class="btn btn-sm preset-outlined-surface-500 opacity-50 pointer-events-none">&larr; Newer</span>
						{/if}
						<span class="text-sm text-surface-500">
							Page {currentPage + 1} of {totalPages}
						</span>
						{#if currentPage < totalPages - 1}
							<a
								href="/blog?page={currentPage + 2}"
								class="btn btn-sm preset-outlined-surface-500"
							>Older &rarr;</a>
						{:else}
							<span class="btn btn-sm preset-outlined-surface-500 opacity-50 pointer-events-none">Older &rarr;</span>
						{/if}
					</nav>
				{/if}
			{/if}
		</div>

		<!-- Sidebar column (hidden on mobile) -->
		<div class="hidden lg:block">
			<div class="sticky top-20 max-h-[calc(100vh-6rem)] overflow-y-auto space-y-8 sidebar-scroll glass rounded-xl p-4">
				<ProfileSidebar />
				<hr class="border-surface-300-700" />
				<BlogSidebar {recentPosts} {allTags} />
			</div>
		</div>
	</div>
</div>
