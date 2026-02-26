<script lang="ts">
	import type { PageData } from './$types';
	import Search from '$lib/components/Search.svelte';
	import BlogCard from '$lib/components/BlogCard.svelte';
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
				<div class="grid grid-cols-1 sm:grid-cols-2 gap-6">
					{#each paginatedPosts as post}
						<BlogCard {post} />
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
