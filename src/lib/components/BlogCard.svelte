<script lang="ts">
	import type { Post } from '$lib/types';
	import { Tooltip } from '@skeletonlabs/skeleton-svelte';

	let { post, loading = false }: { post?: Post; loading?: boolean } = $props();

	function formatDate(date: string): string {
		return new Date(date).toLocaleDateString('en-US', {
			year: 'numeric',
			month: 'short',
			day: 'numeric'
		});
	}

	function webpSrc(src: string): string | null {
		if (!src) return null;
		const webp = src.replace(/\.(jpe?g|png|gif)$/i, '.webp');
		return webp !== src ? webp : null;
	}

	const CATEGORY_COLORS: Record<string, string> = {
		hardware: 'preset-outlined-warning-500',
		software: 'preset-outlined-primary-500',
		ecology: 'preset-outlined-success-500',
		music: 'preset-outlined-secondary-500',
		photography: 'preset-outlined-tertiary-500',
		personal: 'preset-outlined-surface-500',
		tutorial: 'preset-outlined-primary-500',
		devops: 'preset-outlined-warning-500'
	};
</script>

{#if loading}
	<!-- Skeleton loading state -->
	<article class="card glass p-0 overflow-hidden animate-pulse">
		<div class="h-48 bg-surface-300/30"></div>
		<div class="p-6 space-y-3">
			<div class="flex gap-3">
				<div class="h-4 w-24 bg-surface-300/40 rounded"></div>
				<div class="h-4 w-16 bg-surface-300/40 rounded"></div>
			</div>
			<div class="h-6 w-3/4 bg-surface-300/50 rounded"></div>
			<div class="space-y-2">
				<div class="h-4 w-full bg-surface-300/30 rounded"></div>
				<div class="h-4 w-5/6 bg-surface-300/30 rounded"></div>
			</div>
			<div class="flex gap-2 pt-2">
				<div class="h-5 w-14 bg-surface-300/30 rounded-full"></div>
				<div class="h-5 w-18 bg-surface-300/30 rounded-full"></div>
			</div>
		</div>
	</article>
{:else if post}
	<article class="card glass p-0 overflow-hidden hover:ring-2 ring-primary-500 transition-all group {post.featured ? 'ring-1 ring-primary-300' : ''}">
		<a href="/blog/{post.slug}" class="block">
			<!-- Feature image banner -->
			{#if post.feature_image}
				<div class="relative w-full h-48 overflow-hidden bg-surface-200-800">
					{#if post.featured}
						<div class="absolute top-3 left-3 z-10 flex items-center gap-1 text-xs font-semibold bg-primary-500 text-white px-2 py-1 rounded-full shadow-sm">
							<svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3" fill="currentColor" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/></svg>
							Featured
						</div>
					{/if}
					<picture>
						{#if webpSrc(post.feature_image)}
							<source srcset={webpSrc(post.feature_image)} type="image/webp" />
						{/if}
						<img
							src={post.feature_image}
							alt=""
							class="w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
							loading="lazy"
							decoding="async"
						/>
					</picture>
				</div>
			{:else if post.featured}
				<div class="flex items-center gap-1 text-xs text-primary-500 font-semibold px-6 pt-5 pb-0">
					<svg xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/></svg>
					Featured
				</div>
			{/if}

			<!-- Card body -->
			<div class="p-6 {post.feature_image ? '' : 'pt-6'}">
				<!-- Metadata row -->
				<div class="flex items-center gap-3 text-sm text-surface-500 mb-2">
					<time class="font-mono text-xs">{formatDate(post.date)}</time>
					{#if post.reading_time}
						<span class="text-surface-300">|</span>
						<Tooltip positioning={{ placement: 'top' }}>
							{#snippet trigger()}<span class="text-xs">{post.reading_time} min</span>{/snippet}
							{#snippet content()}<span class="text-xs">~{(post.reading_time ?? 1) * 230} words</span>{/snippet}
						</Tooltip>
					{/if}
					{#if post.category}
						<span class="badge {CATEGORY_COLORS[post.category] ?? 'preset-outlined-surface-500'} text-xs capitalize">{post.category}</span>
					{/if}
				</div>

				<!-- Title -->
				<h2 class="font-heading text-xl font-semibold leading-snug group-hover:text-primary-500 transition-colors">
					{post.title}
				</h2>

				<!-- Description -->
				{#if post.description}
					<p class="text-surface-600-400 mt-2 text-sm leading-relaxed line-clamp-3">{post.description}</p>
				{/if}

				<!-- Body excerpt (only if no description or as supplement) -->
				{#if post.body_excerpt && !post.description}
					<p class="text-sm text-surface-500 mt-2 line-clamp-2">{post.body_excerpt}</p>
				{/if}
			</div>
		</a>

		<!-- Tags (outside the link for independent clickability) -->
		{#if post.tags.length > 0}
			<div class="flex flex-wrap gap-1.5 px-6 pb-5 -mt-2">
				{#each post.tags as tag}
					<a
						href="/blog/tag/{encodeURIComponent(tag)}"
						class="badge preset-outlined-primary-500 text-xs hover:preset-filled-primary-500 transition-colors"
					>{tag}</a>
				{/each}
			</div>
		{/if}
	</article>
{/if}
