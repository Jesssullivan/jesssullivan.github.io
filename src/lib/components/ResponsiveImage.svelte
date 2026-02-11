<script lang="ts">
	let { src, alt = '', class: className = '', ...rest }: {
		src: string;
		alt?: string;
		class?: string;
		[key: string]: unknown;
	} = $props();

	// Derive WebP source path from the original image path
	let ext = $derived(src.substring(src.lastIndexOf('.')));
	let basePath = $derived(src.substring(0, src.lastIndexOf('.')));
	let webpSrc = $derived(basePath + '.webp');
	let isLocal = $derived(src.startsWith('/images/posts/'));
	let hasWebp = $derived(isLocal && ext !== '.webp');
</script>

{#if hasWebp}
	<picture>
		<source srcset={webpSrc} type="image/webp" />
		<img {src} {alt} class={className} loading="lazy" decoding="async" {...rest} />
	</picture>
{:else}
	<img {src} {alt} class={className} loading="lazy" decoding="async" {...rest} />
{/if}
