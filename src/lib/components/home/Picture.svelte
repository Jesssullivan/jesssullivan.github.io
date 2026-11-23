<script lang="ts">
	// One image in the formats the site already makes: AVIF, then WebP, then the source file (TIN-8657).
	// Width and height are always set, so the box is reserved before a byte arrives.
	import type { StreamImage } from '$lib/home/stream';

	let { image, lazy = true, alt = image.alt }: { image: Pick<StreamImage, 'src' | 'width' | 'height' | 'alt' | 'webp' | 'avif'>; lazy?: boolean; alt?: string } = $props();
</script>

<picture>
	{#if image.avif}<source srcset={image.avif} type="image/avif" />{/if}
	{#if image.webp}<source srcset={image.webp} type="image/webp" />{/if}
	<img src={image.src} {alt} width={image.width} height={image.height} loading={lazy ? 'lazy' : 'eager'} decoding="async" />
</picture>

<style>
	picture {
		display: contents;
	}
</style>
