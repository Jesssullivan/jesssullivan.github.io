<script lang="ts">
	import { onMount } from 'svelte';
	let { lightSrc, darkSrc, alt, width, height, class: className = '', loading = 'lazy' }: {
		lightSrc: string;
		darkSrc: string;
		alt: string;
		width?: number | string;
		height?: number | string;
		class?: string;
		loading?: 'lazy' | 'eager';
	} = $props();
	let isDark = $state(false);
	let src = $derived(isDark ? darkSrc : lightSrc);

	onMount(() => {
		isDark = document.documentElement.getAttribute('data-mode') === 'dark';
		const observer = new MutationObserver(() => {
			isDark = document.documentElement.getAttribute('data-mode') === 'dark';
		});
		observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-mode'] });
		return () => observer.disconnect();
	});
</script>

<img {src} {alt} width={width} height={height} {loading} class={className} />
