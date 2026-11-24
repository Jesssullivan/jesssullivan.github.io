<script lang="ts">
	// One image in the formats the site already makes: AVIF, then WebP, then the source file (TIN-8657).
	// Width and height are always set, so the box is reserved before a byte arrives.
	// A name that starts with `asset:` is a file the page brings with it. It gets its built address here.
	import { assetUrl } from '$lib/home/assets';
	import type { StreamImage } from '$lib/home/stream';

	let { image, lazy = true, alt = image.alt }: { image: Pick<StreamImage, 'src' | 'width' | 'height' | 'alt' | 'webp' | 'avif'>; lazy?: boolean; alt?: string } = $props();
	const avif = $derived(assetUrl(image.avif));
	const webp = $derived(assetUrl(image.webp));

	// A picture still on its way when the page comes alive fades in as it lands, so nothing pops.
	// One that is already here, and any picture without scripts, just shows.
	// A picture asked for ahead of its turn, as a scene's is, is also decoded ahead of it, so it is there in the first frame it shows.
	function land(node: HTMLImageElement) {
		if (!lazy) void node.decode?.().catch(() => {});
		if (node.complete || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
		const landed = () => node.classList.remove('landing');
		node.classList.add('landing');
		node.addEventListener('load', landed, { once: true });
		node.addEventListener('error', landed, { once: true });
		return {
			destroy() {
				node.removeEventListener('load', landed);
				node.removeEventListener('error', landed);
			},
		};
	}
</script>

<picture>
	{#if avif}<source srcset={avif} type="image/avif" />{/if}
	{#if webp}<source srcset={webp} type="image/webp" />{/if}
	<img src={assetUrl(image.src)} {alt} width={image.width} height={image.height} loading={lazy ? 'lazy' : 'eager'} decoding="async" use:land />
</picture>

<style>
	picture {
		display: contents;
	}
	img {
		transition: opacity 0.6s var(--ease-soft);
	}
	img:global(.landing) {
		opacity: 0;
	}
</style>
