<script lang="ts">
	import { onMount } from 'svelte';
	let { term = '' }: { term?: string } = $props();
	let container: HTMLDivElement;

	onMount(() => {
		const script = document.createElement('script');
		script.src = 'https://giscus.app/client.js';
		script.setAttribute('data-repo', 'Jesssullivan/jesssullivan.github.io');
		script.setAttribute('data-repo-id', 'R_kgDORMp11w');
		script.setAttribute('data-category', 'General');
		script.setAttribute('data-category-id', 'DIC_kwDORMp1184C2H4C');
		script.setAttribute('data-mapping', 'pathname');
		script.setAttribute('data-strict', '0');
		script.setAttribute('data-reactions-enabled', '1');
		script.setAttribute('data-emit-metadata', '0');
		script.setAttribute('data-input-position', 'top');
		script.setAttribute('data-theme', 'preferred_color_scheme');
		script.setAttribute('data-lang', 'en');
		script.setAttribute('crossorigin', 'anonymous');
		script.async = true;
		container.appendChild(script);
	});
</script>

<section class="mt-12 pt-8 border-t border-surface-300-700">
	<h2 class="text-xl font-semibold mb-4">Comments</h2>
	<div bind:this={container}></div>
</section>
