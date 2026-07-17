<script lang="ts">
	import type { PageData } from './$types';
	import Search from '$lib/components/Search.svelte';
	import BlogCard from '$lib/components/BlogCard.svelte';
	import BlogSidebar from '$lib/components/BlogSidebar.svelte';
	import ProfileSidebar from '$lib/components/ProfileSidebar.svelte';
	import { page } from '$app/stores';
	import { browser } from '$app/environment';
	import { onMount } from 'svelte';
	import {
		TINYLAND_BLOG_BROKER_STREAM_URL,
		loadTinylandBlogBrokerStream,
		mergeBrokerPostsIntoStatic,
		summarizeTinylandBlogBrokerError,
		tinylandBlogBrokerStreamToPosts,
		type TinylandBlogBrokerState,
	} from '$lib/tinyland/blogBrokerStream';

	let { data }: { data: PageData } = $props();

	const POSTS_PER_PAGE = 20;
	const brokerEndpoint = TINYLAND_BLOG_BROKER_STREAM_URL;
	const publicationHolds = new Set(data.publicationHolds);

	let brokerState = $state<TinylandBlogBrokerState>({
		status: 'loading',
		endpoint: brokerEndpoint,
	});

	// The build-time static index (data.posts) is authoritative for which posts
	// EXIST — it is always at least as fresh as the deploy. The hub broker stream
	// can lag the deploy (a just-published post sits in the hub's held-back
	// remainder for a window), so it is merged additively: it enriches existing
	// posts and appends broker-only ones, but can never drop a freshly published
	// post. Explicit local publication holds still win over either source. This
	// fixes the listing flash-then-disappear on hydration; see
	// mergeBrokerPostsIntoStatic for the full rationale.
	let displayPosts = $derived(
		brokerState.status === 'ready'
			? mergeBrokerPostsIntoStatic(data.posts, brokerState.posts, publicationHolds)
			: data.posts.filter((post) => !publicationHolds.has(post.slug)),
	);

	// Reader-weight ordering (docs/blog-editorial-taxonomy-2026-07-03.md): keep the
	// date-desc contract globally and only tie-break WITHIN an equal date so
	// 'noteworthy' posts float gently up. Array.sort is stable (ES2019+), so untiered
	// posts keep their existing relative order — the change is additive and reversible.
	let orderedPosts = $derived(
		[...displayPosts].sort((a, b) => {
			const ad = new Date(a.date).getTime();
			const bd = new Date(b.date).getTime();
			if (ad !== bd) return bd - ad;
			const aw = a.editorial_tier === 'noteworthy' ? 1 : 0;
			const bw = b.editorial_tier === 'noteworthy' ? 1 : 0;
			return bw - aw;
		}),
	);

	// Optional reader filter — a view-only lens, never drops posts from the corpus.
	// Defaults to 'all', so nothing is hidden unless the reader opts in.
	let tierFilter = $state<'all' | 'noteworthy' | 'less-noteworthy'>('all');
	const TIER_CHIPS = [
		{ value: 'all', label: 'All' },
		{ value: 'noteworthy', label: 'Noteworthy' },
		{ value: 'less-noteworthy', label: 'Less noteworthy' },
	] as const;
	let hasTieredPosts = $derived(displayPosts.some((p) => p.editorial_tier));
	let visiblePosts = $derived(
		tierFilter === 'all' ? orderedPosts : orderedPosts.filter((p) => p.editorial_tier === tierFilter),
	);

	let totalPages = $derived(Math.ceil(visiblePosts.length / POSTS_PER_PAGE));
	let pageParam = $derived(browser ? parseInt($page.url.searchParams.get('page') || '1') : 1);
	let currentPage = $derived(Math.max(0, Math.min(pageParam - 1, totalPages - 1)));
	let paginatedPosts = $derived(visiblePosts.slice(currentPage * POSTS_PER_PAGE, (currentPage + 1) * POSTS_PER_PAGE));

	// Collect all unique tags
	let allTags = $derived([...new Set(displayPosts.flatMap((p) => p.tags))].sort());

	// Recent 5 posts for sidebar
	let recentPosts = $derived(orderedPosts.slice(0, 5));
	let brokerStatusLabel = $derived(
		brokerState.status === 'ready'
			? `Updated ${formatTimestamp(brokerState.stream.generatedAt)}`
			: brokerState.status === 'unavailable'
				? 'Static snapshot may be stale'
				: 'Checking broker',
	);

	function formatTimestamp(value: string): string {
		return new Date(value).toLocaleString(undefined, {
			dateStyle: 'medium',
			timeStyle: 'short',
		});
	}

	onMount(() => {
		let cancelled = false;
		const controller = new AbortController();
		const timer = window.setTimeout(() => controller.abort(), 10_000);

		loadTinylandBlogBrokerStream(fetch, {
			endpoint: brokerEndpoint,
			signal: controller.signal,
		})
			.then((stream) => {
				if (!cancelled) {
					brokerState = {
						status: 'ready',
						endpoint: brokerEndpoint,
						stream,
						posts: tinylandBlogBrokerStreamToPosts(stream),
					};
				}
			})
			.catch((error: unknown) => {
				if (!cancelled) {
					brokerState = {
						status: 'unavailable',
						endpoint: brokerEndpoint,
						reason: summarizeTinylandBlogBrokerError(error),
					};
				}
			})
			.finally(() => {
				window.clearTimeout(timer);
			});

		return () => {
			cancelled = true;
			window.clearTimeout(timer);
			controller.abort();
		};
	});
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
	<div class="sr-only" aria-live="polite" data-testid="tinyland-blog-broker-state">
		{#if brokerState.status === 'ready'}
			Tinyland broker stream loaded.
		{:else if brokerState.status === 'unavailable'}
			Tinyland broker stream unavailable: {brokerState.reason}
		{:else}
			Tinyland broker stream loading.
		{/if}
	</div>

	<div class="flex flex-wrap items-baseline justify-between gap-3 mb-8">
		<h1 class="font-heading text-3xl font-bold">Blog</h1>
		<div class="text-right">
			<p class="text-sm text-surface-500">{displayPosts.length} posts</p>
			<p
				class="text-xs text-surface-600-400"
				title={brokerState.status === 'unavailable' ? brokerState.reason : brokerEndpoint}
			>
				{brokerStatusLabel}
			</p>
		</div>
	</div>

	<!-- Mobile profile (visible on small screens only) -->
	<div class="lg:hidden mb-6">
		<ProfileSidebar compact={true} />
	</div>

	<div class="grid grid-cols-1 lg:grid-cols-[1fr_250px] gap-8">
		<!-- Main content column -->
		<div>
			<Search />

			{#if hasTieredPosts}
				<div class="flex flex-wrap items-center gap-2 mt-4" role="group" aria-label="Filter posts by editorial tier">
					<span class="text-xs text-surface-500">Tier</span>
					{#each TIER_CHIPS as chip (chip.value)}
						<button
							type="button"
							onclick={() => (tierFilter = chip.value)}
							aria-pressed={tierFilter === chip.value}
							class="badge text-xs {tierFilter === chip.value
								? 'preset-filled-primary-500'
								: 'preset-outlined-surface-500'}">{chip.label}</button
						>
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
							<a href="/blog?page={currentPage}" class="btn btn-sm preset-outlined-surface-500">&larr; Newer</a>
						{:else}
							<span class="btn btn-sm preset-outlined-surface-500 opacity-50 pointer-events-none">&larr; Newer</span>
						{/if}
						<span class="text-sm text-surface-500">
							Page {currentPage + 1} of {totalPages}
						</span>
						{#if currentPage < totalPages - 1}
							<a href="/blog?page={currentPage + 2}" class="btn btn-sm preset-outlined-surface-500">Older &rarr;</a>
						{:else}
							<span class="btn btn-sm preset-outlined-surface-500 opacity-50 pointer-events-none">Older &rarr;</span>
						{/if}
					</nav>
				{/if}
			{/if}
		</div>

		<!-- Sidebar column (hidden on mobile) -->
		<div class="hidden lg:block">
			<div class="sticky top-20 max-h-[calc(100dvh-6rem)] overflow-y-auto space-y-8 sidebar-scroll glass p-4">
				<ProfileSidebar />
				<hr class="border-surface-300-700" />
				<BlogSidebar {recentPosts} {allTags} />
			</div>
		</div>
	</div>
</div>
