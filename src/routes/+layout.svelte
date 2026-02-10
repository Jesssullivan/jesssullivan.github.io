<script lang="ts">
	import '../app.css';
	import { AppBar, Switch } from '@skeletonlabs/skeleton-svelte';
	import { page } from '$app/stores';

	let { children } = $props();
	let mobileOpen = $state(false);
	let darkMode = $state(true);

	const navLinks = [
		{ href: '/blog', label: 'Blog' },
		{ href: '/cv', label: 'CV' },
		{ href: '/about', label: 'About' },
	];

	function toggleTheme() {
		darkMode = !darkMode;
		if (darkMode) {
			document.documentElement.classList.add('dark');
		} else {
			document.documentElement.classList.remove('dark');
		}
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
			<a href="/" class="text-lg font-bold hover:text-primary-500 transition-colors whitespace-nowrap">
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
			<p>&copy; {new Date().getFullYear()} Jess Sullivan</p>
			<span class="text-surface-400">|</span>
			<a href="/feed.xml" class="hover:text-primary-500 transition-colors">RSS</a>
		</div>
	</footer>
</div>
