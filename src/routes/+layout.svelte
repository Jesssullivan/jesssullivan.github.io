<script lang="ts">
	import '../app.css';
	import { AppBar } from '@skeletonlabs/skeleton-svelte';
	import { page } from '$app/stores';
	import { onMount } from 'svelte';
	import { browser } from '$app/environment';
	import BlobBackground from '$lib/components/vectors/BlobBackground.svelte';

	let { children } = $props();
	let mobileOpen = $state(false);
	let themeMode = $state<'light' | 'dark' | 'system'>('system');
	let themeMenuOpen = $state(false);
	let bannerRef: HTMLElement | undefined = $state();
	let bannerOpacity = $state(1);
	let bannerNaturalHeight = 0;

	const navLinks = [
		{ href: '/blog', label: 'Blog' },
		{ href: '/music', label: 'Music' },
		{ href: '/cv', label: 'CV' },
		{ href: '/about', label: 'About' },
	];

	onMount(() => {
		const stored = localStorage.getItem('color-mode');
		if (stored === 'dark' || stored === 'light') {
			themeMode = stored;
		} else {
			themeMode = 'system';
		}

		// Close theme menu on click outside
		const handleClickOutside = (e: MouseEvent) => {
			const target = e.target as HTMLElement;
			if (!target.closest('.theme-switcher')) {
				themeMenuOpen = false;
			}
		};
		document.addEventListener('click', handleClickOutside);

		// Scroll-fade for hero banner (always enabled — scroll-driven, not time-driven)
		if (bannerRef) bannerNaturalHeight = bannerRef.offsetHeight;
		const onScroll = () => {
			if (!bannerRef || !bannerNaturalHeight) return;
			bannerOpacity = Math.max(0, 1 - window.scrollY / bannerNaturalHeight);
		};
		window.addEventListener('scroll', onScroll, { passive: true });

		return () => {
			document.removeEventListener('click', handleClickOutside);
			window.removeEventListener('scroll', onScroll);
		};
	});

	function setTheme(mode: 'light' | 'dark' | 'system') {
		themeMode = mode;
		themeMenuOpen = false;

		if (mode === 'system') {
			localStorage.removeItem('color-mode');
			const systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
			const resolved = systemDark ? 'dark' : 'light';
			document.documentElement.setAttribute('data-mode', resolved);
			document.documentElement.style.colorScheme = resolved;
		} else {
			localStorage.setItem('color-mode', mode);
			document.documentElement.setAttribute('data-mode', mode);
			document.documentElement.style.colorScheme = mode;
		}
	}

	function resolvedDark(): boolean {
		if (!browser) return false;
		return document.documentElement.getAttribute('data-mode') === 'dark';
	}

	function isActive(href: string): boolean {
		const path = $page.url.pathname;
		if (href === '/blog') return path.startsWith('/blog');
		return path === href;
	}
</script>

<svelte:head>
	{@html `<script type="application/ld+json">${JSON.stringify({
		"@context": "https://schema.org",
		"@type": "WebSite",
		"name": "transscendsurvival.org",
		"url": "https://transscendsurvival.org",
		"author": { "@type": "Person", "name": "Jess Sullivan", "url": "https://github.com/Jesssullivan" },
		"description": "Blog and portfolio by Jess Sullivan — full stack engineer, musician, and birdwatcher."
	})}</script>`}
</svelte:head>

<BlobBackground />

<div class="min-h-screen flex flex-col relative">
	<a
		href="#main-content"
		class="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:top-2 focus:left-2 focus:px-4 focus:py-2 focus:bg-primary-500 focus:text-white focus:rounded focus:text-sm focus:font-semibold"
	>Skip to content</a>
	<AppBar
		border="border-b border-surface-300-700"
		padding="px-4 py-2"
		shadow="shadow-sm"
	>
		{#snippet lead()}
			<a href="/blog" class="text-lg font-bold font-heading-hero hover:text-primary-500 transition-colors whitespace-nowrap tracking-wide">
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
				<!-- 3-way theme switcher -->
				<div class="theme-switcher relative">
					<button
						onclick={() => themeMenuOpen = !themeMenuOpen}
						class="p-1.5 hover:bg-surface-200-800 rounded transition-colors"
						aria-label="Theme settings"
						aria-expanded={themeMenuOpen}
						aria-haspopup="true"
					>
						{#if themeMode === 'dark' || (themeMode === 'system' && resolvedDark())}
							<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
						{:else}
							<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" /></svg>
						{/if}
					</button>
					{#if themeMenuOpen}
						<div class="absolute right-0 top-full mt-1 bg-surface-100-900 border border-surface-300-700 rounded-lg shadow-lg py-1 min-w-[120px] z-50" role="menu" aria-label="Theme options">
							<button
								onclick={() => setTheme('light')}
								class="w-full px-3 py-1.5 text-left text-sm hover:bg-surface-200-800 transition-colors flex items-center gap-2 {themeMode === 'light' ? 'text-primary-500 font-semibold' : ''}"
								role="menuitem"
							>
								<svg xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
								Light
							</button>
							<button
								onclick={() => setTheme('dark')}
								class="w-full px-3 py-1.5 text-left text-sm hover:bg-surface-200-800 transition-colors flex items-center gap-2 {themeMode === 'dark' ? 'text-primary-500 font-semibold' : ''}"
								role="menuitem"
							>
								<svg xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" /></svg>
								Dark
							</button>
							<button
								onclick={() => setTheme('system')}
								class="w-full px-3 py-1.5 text-left text-sm hover:bg-surface-200-800 transition-colors flex items-center gap-2 {themeMode === 'system' ? 'text-primary-500 font-semibold' : ''}"
								role="menuitem"
							>
								<svg xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
								System
							</button>
						</div>
					{/if}
				</div>
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

	<!-- Hero banner — visible on all pages, scroll-fades -->
	<section
		class="hero-banner"
		bind:this={bannerRef}
		style:opacity={bannerOpacity}
	>
		<picture>
			<source srcset="/images/header.webp" type="image/webp" />
			<img
				src="/images/header.png"
				alt="Great Blue Heron"
				class="hero-banner-img"
				width="672"
				height="219"
				fetchpriority="high"
				decoding="sync"
			/>
		</picture>
		<div class="hero-banner-overlay">
			<p class="hero-banner-title text-3xl sm:text-4xl lg:text-5xl xl:text-6xl" role="banner">
				Trans Scend Survival
			</p>
			<div class="hero-banner-separator" aria-hidden="true"></div>
			<p class="hero-banner-description">
				<span class="hero-banner-description-word"><strong>Trans:</strong> Latin prefix implying &ldquo;across&rdquo; or &ldquo;Beyond&rdquo;, often used in gender nonconforming situations</span>
				<span class="hero-banner-description-dash" aria-hidden="true">&mdash;</span>
				<span class="hero-banner-description-word"><strong>Scend:</strong> Archaic word describing a strong &ldquo;surge&rdquo; or &ldquo;wave&rdquo;, originating with 15th century english sailors</span>
				<span class="hero-banner-description-dash" aria-hidden="true">&mdash;</span>
				<span class="hero-banner-description-word"><strong>Survival:</strong> 15th century english compound word describing an existence only worth transcending</span>
			</p>
			<p class="hero-banner-subtitle text-base sm:text-lg lg:text-xl">
				Jess Sullivan
			</p>
		</div>
	</section>

	<main id="main-content" class="flex-1">
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
