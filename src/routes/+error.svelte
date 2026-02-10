<script lang="ts">
	import { page } from '$app/stores';
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';

	let attempted = $state(false);
	let redirecting = $state(false);

	onMount(() => {
		const path = window.location.pathname;
		// WordPress pattern: /YYYY/MM/DD/slug/ -> /blog/slug
		const wpMatch = path.match(/^\/(\d{4})\/(\d{2})\/(\d{2})\/([^/]+)\/?$/);
		if (wpMatch) {
			const slug = wpMatch[4];
			redirecting = true;
			goto(`/blog/${slug}`).catch(() => {
				redirecting = false;
				attempted = true;
			});
			return;
		}
		attempted = true;
	});
</script>

<svelte:head>
	<title>Not Found | transscendsurvival.org</title>
</svelte:head>

<div class="container mx-auto px-4 py-12 max-w-3xl text-center">
	{#if redirecting}
		<p class="text-surface-500">Redirecting...</p>
	{:else}
		<h1 class="text-4xl font-bold mb-4">404</h1>
		<p class="text-lg text-surface-600-400 mb-6">
			This page doesn't exist. It may have been part of the old WordPress site.
		</p>
		<div class="flex gap-3 justify-center">
			<a href="/blog" class="btn preset-filled-primary-500">Browse the Blog</a>
			<a href="/" class="btn preset-outlined-primary-500">Go Home</a>
		</div>
	{/if}
</div>
