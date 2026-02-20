<script lang="ts">
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
	let selectedPhoto = $state<null | {
		src: string;
		webp: string | null;
		width: number;
		height: number;
		post_slug: string | null;
		post_title: string | null;
	}>(null);

	function closeLightbox() {
		selectedPhoto = null;
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') closeLightbox();
	}
</script>

<svelte:head>
	<title>Photography | transscendsurvival.org</title>
	<meta name="description" content="Bird and nature photography by Jess Sullivan — warblers, raptors, and field research in New Hampshire and beyond." />
	<meta property="og:title" content="Photography | transscendsurvival.org" />
	<meta property="og:description" content="Bird and nature photography from field research and birding expeditions." />
	<meta property="og:type" content="website" />
	<meta property="og:url" content="https://transscendsurvival.org/photography" />
	<meta property="og:image" content="https://transscendsurvival.org/images/header.png" />
	<meta property="og:site_name" content="transscendsurvival.org" />
	<meta name="twitter:card" content="summary_large_image" />
	<link rel="canonical" href="https://transscendsurvival.org/photography" />
</svelte:head>

<svelte:window onkeydown={handleKeydown} />

<div class="container mx-auto px-4 py-12 max-w-5xl">
	<h1 class="text-3xl font-bold mb-2">Photography</h1>
	<p class="text-surface-500 mb-8">
		Bird and nature photography from field research, birding expeditions, and the backyard.
		Mostly shot in New Hampshire with a Canon 7D Mark II.
	</p>

	<!-- Photo Gallery -->
	<section class="mb-12">
		<h2 class="text-xl font-semibold mb-4">{data.gallery.length} Photos</h2>
		<div class="columns-2 md:columns-3 lg:columns-4 gap-3">
			{#each data.gallery as photo}
				<button
					class="mb-3 break-inside-avoid block w-full text-left cursor-pointer group"
					onclick={() => selectedPhoto = photo}
				>
					<picture>
						{#if photo.webp}
							<source srcset={photo.webp} type="image/webp" />
						{/if}
						<img
							src={photo.src}
							alt={photo.post_title || photo.src.split('/').pop() || 'Photo'}
							width={photo.width || undefined}
							height={photo.height || undefined}
							loading="lazy"
							decoding="async"
							class="w-full rounded-lg transition-transform group-hover:scale-[1.02] group-hover:shadow-lg"
						/>
					</picture>
					{#if photo.post_title}
						<p class="text-xs text-surface-500 mt-1 opacity-0 group-hover:opacity-100 transition-opacity truncate">
							{photo.post_title}
						</p>
					{/if}
				</button>
			{/each}
		</div>
	</section>

	<!-- Lightbox -->
	{#if selectedPhoto}
		<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
		<div
			class="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
			onclick={closeLightbox}
			onkeydown={(e) => e.key === 'Escape' && closeLightbox()}
			role="dialog"
			aria-modal="true"
			aria-label="Photo viewer"
			tabindex="-1"
		>
			<button
				class="absolute top-4 right-4 text-white/70 hover:text-white text-3xl z-10"
				onclick={closeLightbox}
				aria-label="Close"
			>&times;</button>
			<div class="max-w-[90vw] max-h-[90vh] flex flex-col items-center">
				<picture>
					{#if selectedPhoto.webp}
						<source srcset={selectedPhoto.webp} type="image/webp" />
					{/if}
					<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
					<img
						src={selectedPhoto.src}
						alt={selectedPhoto.post_title || 'Photo'}
						class="max-w-full max-h-[85vh] object-contain rounded-lg"
						onclick={(e) => e.stopPropagation()}
						onkeydown={() => {}}
					/>
				</picture>
				{#if selectedPhoto.post_slug}
					<a
						href="/blog/{selectedPhoto.post_slug}"
						class="mt-3 text-sm text-primary-400 hover:text-primary-300 hover:underline"
						onclick={(e) => e.stopPropagation()}
					>
						{selectedPhoto.post_title} &rarr;
					</a>
				{/if}
			</div>
		</div>
	{/if}

	<!-- Related Blog Posts -->
	{#if data.photographyPosts.length > 0}
		<section class="mb-12">
			<h2 class="text-xl font-semibold mb-4">Related Posts</h2>
			<div class="space-y-4">
				{#each data.photographyPosts as post}
					<a href="/blog/{post.slug}" class="block card p-4 hover:ring-2 ring-primary-500 transition-all">
						<div class="flex items-baseline justify-between gap-4">
							<h3 class="font-semibold">{post.title}</h3>
							<time class="text-xs text-surface-500 whitespace-nowrap">
								{new Date(post.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
							</time>
						</div>
						{#if post.description}
							<p class="text-sm text-surface-500 mt-1 line-clamp-2">{post.description}</p>
						{/if}
						<div class="flex flex-wrap gap-1 mt-2">
							{#each post.tags as tag}
								<span class="text-xs px-2 py-0.5 bg-surface-200-800 rounded">{tag}</span>
							{/each}
						</div>
					</a>
				{/each}
			</div>
		</section>
	{/if}
</div>
