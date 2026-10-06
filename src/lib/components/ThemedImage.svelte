<script lang="ts">
	import { onMount } from 'svelte';
	let { lightSrc, darkSrc, alt, width, height, class: className = '', loading = 'lazy', compact }: {
		lightSrc: string;
		darkSrc: string;
		alt: string;
		width?: number | string;
		height?: number | string;
		class?: string;
		loading?: 'lazy' | 'eager';
		/** Optional narrow-screen variant, served through <picture> for `media`. */
		compact?: { lightSrc: string; darkSrc: string; width: number; height: number; media: string };
	} = $props();
	let isDark = $state(false);
	let src = $derived(isDark ? darkSrc : lightSrc);
	let compactSrc = $derived(compact ? (isDark ? compact.darkSrc : compact.lightSrc) : '');

	onMount(() => {
		isDark = document.documentElement.getAttribute('data-mode') === 'dark';
		const observer = new MutationObserver(() => {
			isDark = document.documentElement.getAttribute('data-mode') === 'dark';
		});
		observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-mode'] });
		return () => observer.disconnect();
	});
</script>

{#if compact}
	<picture>
		<source media={compact.media} srcset={compactSrc} width={compact.width} height={compact.height} />
		<img {src} {alt} width={width} height={height} {loading} class={className} />
	</picture>
{:else}
	<img {src} {alt} width={width} height={height} {loading} class={className} />
{/if}
