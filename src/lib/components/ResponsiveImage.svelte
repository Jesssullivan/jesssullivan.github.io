<script lang="ts">
	let { src, alt = '', class: className = '', ...rest }: {
		src: string;
		alt?: string;
		class?: string;
		[key: string]: unknown;
	} = $props();

	// Derive WebP source path from the original image path
	const ext = src.substring(src.lastIndexOf('.'));
	const basePath = src.substring(0, src.lastIndexOf('.'));
	const webpSrc = basePath + '.webp';
	const isLocal = src.startsWith('/images/posts/');
	const hasWebp = isLocal && ext !== '.webp';
</script>

{#if hasWebp}
	<picture>
		<source srcset={webpSrc} type="image/webp" />
		<img {src} {alt} class={className} loading="lazy" decoding="async" {...rest} />
	</picture>
{:else}
	<img {src} {alt} class={className} loading="lazy" decoding="async" {...rest} />
{/if}
