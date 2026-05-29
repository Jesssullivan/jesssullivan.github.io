<script lang="ts">
	import type { Snippet } from 'svelte';
	import GiscusComments from '$lib/components/GiscusComments.svelte';
	import TableOfContents from '$lib/components/TableOfContents.svelte';
	import Breadcrumbs from '$lib/components/Breadcrumbs.svelte';
	import ProfileSidebar from '$lib/components/ProfileSidebar.svelte';
	import ReadingProgressRing from '$lib/components/ReadingProgressRing.svelte';
	import { onMount } from 'svelte';
	import { browser } from '$app/environment';
	import {
		TINYLAND_BLOG_BROKER_STREAM_URL,
		findTinylandBlogBrokerPost,
		loadTinylandBlogBrokerStream,
		summarizeTinylandBlogBrokerError,
		tinylandBlogBrokerPostToPost,
		type TinylandBlogBrokerPost,
	} from '$lib/tinyland/blogBrokerStream';
	import { renderTrustedBrokerMarkdown } from '$lib/tinyland/runtimeMarkdown';

	// Decoupled from the route's generated $types so this component can live in $lib.
	// Shape mirrors the return of src/routes/blog/[slug]/+page.ts.
	type BlogArticleData = {
		content: Snippet | null;
		metadata: ActiveMetadata & { reading_time?: number };
		reading_time: number | null;
		prev: { slug: string; title: string } | null;
		next: { slug: string; title: string } | null;
		relatedPosts: { slug: string; title: string; date: string }[];
		brokerSlug: string;
		brokerOnly: boolean;
	};

	let { data }: { data: BlogArticleData } = $props();

	type ActiveMetadata = {
		title: string;
		slug: string;
		date: string;
		published?: boolean;
		description?: string;
		tags?: string[];
		original_url?: string;
		category?: string;
		feature_image?: string;
	};

	let readingProgress = $state(0);
	let brokerPost = $state<TinylandBlogBrokerPost | null>(null);
	let brokerHtml = $state('');
	let brokerStatus = $state<'idle' | 'loading' | 'ready' | 'unavailable'>('idle');
	let brokerUnavailableReason = $state('');

	// Broker content drives display ONLY for live-only posts (not in the repo).
	// Repo posts render their static prerendered content (mermaid SVG + Shiki),
	// so the broker body never suppresses the rich static render.
	let activePost = $derived(
		data.brokerOnly && brokerPost ? tinylandBlogBrokerPostToPost(brokerPost) : null
	);
	let activeMetadata = $derived(
		activePost
			? {
					...data.metadata,
					title: activePost.title,
					slug: activePost.slug,
					date: activePost.date,
					description: activePost.description,
					tags: activePost.tags,
					category: activePost.category,
					feature_image: activePost.feature_image,
				}
			: data.metadata
	) as ActiveMetadata;
	let activeReadingTime = $derived(activePost?.reading_time ?? data.reading_time);
	let activeImageUrl = $derived(resolveSiteImageUrl(activeMetadata.feature_image));
	let activeOriginalUrl = $derived(activeMetadata.original_url);
	let activeOriginalHost = $derived(activeOriginalUrl ? new URL(activeOriginalUrl).hostname : '');
	// Build the JSON-LD tag here with split tag literals so neither the Svelte
	// compiler nor svelte-eslint-parser mis-tokenizes the embedded element in markup.
	let jsonLdScript = $derived(
		'<' +
			'script type="application/ld+json">' +
			JSON.stringify({
				'@context': 'https://schema.org',
				'@type': 'BlogPosting',
				headline: activeMetadata.title,
				datePublished: activeMetadata.date,
				dateModified: brokerPost?.updatedAt ?? activeMetadata.date,
				author: { '@type': 'Person', name: 'Jess Sullivan', url: 'https://github.com/Jesssullivan' },
				publisher: { '@type': 'Person', name: 'Jess Sullivan' },
				url: `https://transscendsurvival.org/blog/${activeMetadata.slug}`,
				image: activeImageUrl,
				mainEntityOfPage: {
					'@type': 'WebPage',
					'@id': `https://transscendsurvival.org/blog/${activeMetadata.slug}`,
				},
				...(activeMetadata.description ? { description: activeMetadata.description } : {}),
				...(activeMetadata.tags?.length ? { keywords: activeMetadata.tags.join(', ') } : {}),
			}) +
			'</' +
			'script>'
	);
	let brokerStatusLabel = $derived(
		brokerStatus === 'ready' && brokerPost
			? `Updated ${formatTimestamp(brokerPost.updatedAt)}`
			: brokerStatus === 'unavailable' && !data.brokerOnly
				? 'Static snapshot may be stale'
				: brokerStatus === 'loading'
					? 'Checking broker'
					: '',
	);

	function resolveSiteImageUrl(value: string | undefined): string {
		if (!value) return 'https://transscendsurvival.org/images/header.png';
		if (/^https?:\/\//.test(value)) return value;
		const path = value.startsWith('/') ? value : `/${value}`;
		return `https://transscendsurvival.org${path}`;
	}

	function formatTimestamp(value: string): string {
		return new Date(value).toLocaleString(undefined, {
			dateStyle: 'medium',
			timeStyle: 'short',
		});
	}

	function updateReadingProgress() {
		const article = document.querySelector('article');
		if (!article) return;
		const rect = article.getBoundingClientRect();
		const totalHeight = rect.height - window.innerHeight;
		if (totalHeight <= 0) { readingProgress = 100; return; }
		const scrolled = -rect.top;
		readingProgress = Math.min(100, Math.max(0, (scrolled / totalHeight) * 100));
	}

	onMount(() => {
		// Reading progress bar
		const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
		if (!prefersReducedMotion) {
			updateReadingProgress();
			window.addEventListener('scroll', updateReadingProgress, { passive: true });
		}

		return () => {
			window.removeEventListener('scroll', updateReadingProgress);
		};
	});

	onMount(async () => {
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

	onMount(() => {
		const slug = data.brokerSlug;
		// Repo posts render statically; only live-only posts need the broker body.
		if (!slug || !data.brokerOnly) return;

		let cancelled = false;
		const controller = new AbortController();
		const timer = window.setTimeout(() => controller.abort(), 10_000);
		brokerStatus = 'loading';

		loadTinylandBlogBrokerStream(fetch, {
			endpoint: TINYLAND_BLOG_BROKER_STREAM_URL,
			signal: controller.signal,
		})
			.then(async (stream) => {
				const post = findTinylandBlogBrokerPost(stream, slug);
				if (!post) {
					if (!cancelled && data.brokerOnly) {
						brokerStatus = 'unavailable';
						brokerUnavailableReason = 'post is not in the reviewed Tinyland broker stream';
					}
					return;
				}

				const html = await renderTrustedBrokerMarkdown(post.contentMarkdown);
				if (!cancelled) {
					brokerPost = post;
					brokerHtml = html;
					brokerStatus = 'ready';
				}
			})
			.catch((error: unknown) => {
				if (!cancelled) {
					brokerStatus = 'unavailable';
					brokerUnavailableReason = summarizeTinylandBlogBrokerError(error);
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
	<title>{activeMetadata.title} | transscendsurvival.org</title>
	{#if activeMetadata.description}
		<meta name="description" content={activeMetadata.description} />
	{/if}
	<meta property="og:title" content={activeMetadata.title} />
	<meta property="og:type" content="article" />
	<meta property="og:url" content="https://transscendsurvival.org/blog/{activeMetadata.slug}" />
	<meta property="og:site_name" content="transscendsurvival.org" />
	<meta property="article:published_time" content={activeMetadata.date} />
	<meta property="article:author" content="Jess Sullivan" />
	{#if activeMetadata.description}
		<meta property="og:description" content={activeMetadata.description} />
	{/if}
	{#if activeMetadata.tags?.length}
		{#each activeMetadata.tags as tag (tag)}
			<meta property="article:tag" content={tag} />
		{/each}
	{/if}
	<meta property="og:image" content={activeImageUrl} />
	<meta name="twitter:card" content="summary" />
	<meta name="twitter:title" content={activeMetadata.title} />
	{#if activeMetadata.description}
		<meta name="twitter:description" content={activeMetadata.description} />
	{/if}
	<meta name="twitter:image" content={activeImageUrl} />
	<link rel="canonical" href="https://transscendsurvival.org/blog/{activeMetadata.slug}" />
	<!-- eslint-disable-next-line svelte/no-at-html-tags -- self-constructed JSON-LD, no user input -->
	{@html jsonLdScript}
</svelte:head>

{#if browser && readingProgress > 0}
	<div
		class="reading-progress"
		role="progressbar"
		aria-valuenow={Math.round(readingProgress)}
		aria-valuemin={0}
		aria-valuemax={100}
		aria-label="Reading progress"
		style="width: {readingProgress}%"
	></div>
{/if}

<article class="container mx-auto px-4 py-12 max-w-5xl">
	<div class="sr-only" aria-live="polite" data-testid="tinyland-blog-post-broker-state">
		{#if brokerStatus === 'ready'}
			Tinyland broker post loaded.
		{:else if brokerStatus === 'unavailable'}
			Tinyland broker post unavailable: {brokerUnavailableReason}
		{:else if brokerStatus === 'loading'}
			Tinyland broker post loading.
		{/if}
	</div>

	<div class="grid grid-cols-1 lg:grid-cols-[1fr_250px] gap-8">
		<div class="min-w-0">
			<header class="mb-8">
				<Breadcrumbs crumbs={[
					{ label: 'Home', href: '/' },
					{ label: 'Blog', href: '/blog' },
					{ label: activeMetadata.title, href: `/blog/${activeMetadata.slug}` }
				]} />
				<h1 class="text-3xl font-bold mt-2">{activeMetadata.title}</h1>
				<div class="flex items-center gap-3 mt-3 text-sm text-surface-500">
					{#if activeMetadata.date}
						<time>{new Date(activeMetadata.date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</time>
					{/if}
					{#if activeReadingTime}
						<span>&middot;</span>
						<span>{activeReadingTime} min read</span>
					{/if}
					{#if activeMetadata.category}
						<span>&middot;</span>
						<span class="badge preset-outlined-surface-500 text-xs capitalize">{activeMetadata.category}</span>
					{/if}
				</div>
				{#if activeMetadata.tags?.length}
						<div class="flex flex-wrap gap-2 mt-3">
							{#each activeMetadata.tags as tag (tag)}
								<a
									href="/blog/tag/{encodeURIComponent(tag)}"
									class="badge preset-outlined-primary-500 text-xs hover:preset-filled-primary-500 transition-colors"
									aria-label={`View posts tagged ${tag}`}
								>{tag}</a>
							{/each}
						</div>
					{/if}
				{#if brokerStatusLabel}
					<p
						class="mt-3 text-xs text-surface-600-400"
						title={brokerStatus === 'unavailable' ? brokerUnavailableReason : TINYLAND_BLOG_BROKER_STREAM_URL}
					>
						{brokerStatusLabel}
					</p>
				{/if}
			</header>

			<div class="prose prose-lg max-w-none overflow-x-hidden" data-pagefind-body>
				{#if data.content}
					{@render data.content()}
				{:else if brokerHtml}
					<!-- eslint-disable-next-line svelte/no-at-html-tags -- broker markdown sanitized via dompurify in renderTrustedBrokerMarkdown -->
					{@html brokerHtml}
				{:else if brokerStatus === 'unavailable'}
					<p>Post unavailable.</p>
				{:else}
					<p>Loading post.</p>
				{/if}
			</div>

			{#if activeOriginalUrl}
				<p class="text-sm text-surface-500 mt-8 pt-4 border-t border-surface-300-700 italic">
					Originally published at <a href={activeOriginalUrl} class="text-primary-500 hover:underline" aria-label={`Visit original post on ${activeOriginalHost}`}>{activeOriginalHost}</a>
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

			{#if data.relatedPosts?.length}
				<section class="mt-10 pt-6 border-t border-surface-300-700" aria-label="Related posts">
					<h2 class="text-lg font-semibold mb-4">Related Posts</h2>
					<div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
						{#each data.relatedPosts as related (related.slug)}
							<a
								href="/blog/{related.slug}"
								class="block p-4 border border-surface-300-700 hover:border-primary-500 transition-colors"
								aria-label={`Read related post: ${related.title}`}
							>
								<h3 class="text-sm font-semibold line-clamp-2">{related.title}</h3>
								<time class="text-xs text-surface-500 mt-1 block">{new Date(related.date).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}</time>
							</a>
						{/each}
					</div>
				</section>
			{/if}

		</div>

		<div class="hidden lg:block">
			<div class="sticky top-20 max-h-[calc(100dvh-6rem)] overflow-y-auto space-y-6 sidebar-scroll glass p-4">
				{#if browser && readingProgress > 0}
					<div class="flex flex-col items-center">
						<ReadingProgressRing progress={readingProgress} />
					</div>
				{/if}
				<TableOfContents />
				<hr class="border-surface-300-700" />
				<ProfileSidebar />
			</div>
		</div>
	</div>
	<GiscusComments />
</article>

<style>
	.reading-progress {
		position: fixed;
		top: 0;
		left: 0;
		height: 3px;
		background: var(--color-primary-500);
		z-index: 100;
		transition: width 0.1s linear;
		pointer-events: none;
	}
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
