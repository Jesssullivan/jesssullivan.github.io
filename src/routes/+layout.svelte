<script lang="ts">
	import '../app.css';
	import { AppBar } from '@skeletonlabs/skeleton-svelte';
	import { page } from '$app/stores';
	import { onMount } from 'svelte';
	import { browser } from '$app/environment';

	let { children } = $props();
	let mobileOpen = $state(false);
	let darkMode = $state(false);

	const navLinks = [
		{ href: '/blog', label: 'Blog' },
		{ href: '/cv', label: 'CV' },
		{ href: '/about', label: 'About' },
	];

	onMount(() => {
		darkMode = document.documentElement.getAttribute('data-mode') === 'dark';
	});

	function toggleTheme() {
		const current = document.documentElement.getAttribute('data-mode');
		const next = current === 'dark' ? 'light' : 'dark';
		document.documentElement.setAttribute('data-mode', next);
		document.documentElement.style.colorScheme = next;
		localStorage.setItem('color-mode', next);
		darkMode = next === 'dark';
	}

	function isActive(href: string): boolean {
		const path = $page.url.pathname;
		if (href === '/blog') return path.startsWith('/blog');
		return path === href;
	}
</script>

<div class="min-h-screen flex flex-col">
	<AppBar
		border="border-b border-surface-300-700"
		padding="px-4 py-2"
		shadow="shadow-sm"
	>
		{#snippet lead()}
			<a href="/" class="text-lg font-bold font-heading hover:text-primary-500 transition-colors whitespace-nowrap tracking-wide">
				transscendsurvival.org
			</a>
		{/snippet}

		{#snippet trail()}
			<nav class="hidden sm:flex items-center gap-4 text-sm">
				{#each navLinks as { href, label }}
					<a
						{href}
						class="hover:text-primary-500 transition-colors {isActive(href) ? 'text-primary-500 font-semibold' : ''}"
					>{label}</a>
				{/each}
				<a
					href="https://github.com/Jesssullivan"
					class="hover:text-primary-500 transition-colors"
					target="_blank"
					rel="noopener"
				>GitHub</a>
				<button
					onclick={toggleTheme}
					class="p-1.5 hover:bg-surface-200-800 rounded transition-colors"
					aria-label="Toggle dark/light mode"
				>
					{#if darkMode}
						<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
					{:else}
						<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" /></svg>
					{/if}
				</button>
			</nav>
			<!-- Mobile hamburger -->
			<button
				class="sm:hidden p-2 hover:bg-surface-200-800 rounded"
				onclick={() => mobileOpen = !mobileOpen}
				aria-label="Toggle navigation"
			>
				<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
					{#if mobileOpen}
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
					{:else}
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16" />
					{/if}
				</svg>
			</button>
		{/snippet}
	</AppBar>

	<!-- Mobile nav dropdown -->
	{#if mobileOpen}
		<nav class="sm:hidden bg-surface-100-900 border-b border-surface-300-700 px-4 py-3 flex flex-col gap-2 text-sm">
			{#each navLinks as { href, label }}
				<a
					{href}
					class="py-2 hover:text-primary-500 transition-colors {isActive(href) ? 'text-primary-500 font-semibold' : ''}"
					onclick={() => mobileOpen = false}
				>{label}</a>
			{/each}
			<a
				href="https://github.com/Jesssullivan"
				class="py-2 hover:text-primary-500 transition-colors"
				target="_blank"
				rel="noopener"
			>GitHub</a>
		</nav>
	{/if}

	<main class="flex-1">
		{@render children()}
	</main>

	<footer class="bg-surface-100-900 border-t border-surface-300-700 py-6 text-center text-sm text-surface-500">
		<div class="container mx-auto px-4 flex items-center justify-center gap-4">
			<p>Dedicated to the <a href="https://creativecommons.org/publicdomain/zero/1.0/" class="hover:text-primary-500 transition-colors underline" target="_blank" rel="noopener">public domain</a></p>
			<span class="text-surface-400">|</span>
			<a href="/feed.xml" class="hover:text-primary-500 transition-colors">RSS</a>
			<span class="text-surface-400">|</span>
			<a href="/feed.json" class="hover:text-primary-500 transition-colors">JSON</a>
			<span class="text-surface-400">|</span>
			<a href="/THIRD-PARTY-LICENSES" class="hover:text-primary-500 transition-colors">Licenses</a>
		</div>
	</footer>
</div>
