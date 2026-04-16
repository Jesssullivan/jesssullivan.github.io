<script lang="ts">
	import '../app.css';
	import 'virtual:skeleton-colors';
	import { AppBar, Dialog, Navigation } from '@skeletonlabs/skeleton-svelte';
	import { page } from '$app/stores';
	import { onMount } from 'svelte';
	import { browser } from '$app/environment';
	import { TinyVectors } from '@tummycrypt/tinyvectors';
	import { theme, THEMES } from '$lib/theme.svelte';
	import ThemeSwitcher from '$lib/components/ThemeSwitcher.svelte';

	let { children } = $props();

	function hexToRgba(hex: string, alpha: number): string {
		const r = parseInt(hex.slice(1, 3), 16);
		const g = parseInt(hex.slice(3, 5), 16);
		const b = parseInt(hex.slice(5, 7), 16);
		return `rgba(${r}, ${g}, ${b}, ${alpha})`;
	}

	const blobColors = $derived.by(() => {
		const t = THEMES.find((t) => t.id === theme.currentTheme);
		if (!t)
			return [
				'rgba(26,188,156,0.35)',
				'rgba(22,160,133,0.3)',
				'rgba(39,174,96,0.25)',
				'rgba(52,152,219,0.2)',
				'rgba(236,240,241,0.25)',
			];
		return [
			hexToRgba(t.colors[0], 0.35),
			hexToRgba(t.colors[1], 0.3),
			hexToRgba(t.colors[2], 0.25),
			hexToRgba(t.colors[0], 0.2),
			hexToRgba(t.colors[1], 0.25),
		];
	});
	let mobileOpen = $state(false);
	let bannerRef: HTMLElement | undefined = $state();
	let bannerOpacity = $state(1);
	let bannerNaturalHeight = 0;
	let scrolledPastBanner = $state(false);

	const navLinks = [
		{ href: '/blog', label: 'Blog' },
		{ href: '/photography', label: 'Photography' },
		{ href: '/music', label: 'Music' },
		{ href: '/making', label: 'Making' },
		{ href: '/signal-boosts', label: 'Signal Boosts' },
		{ href: '/cv', label: 'CV' },
		{ href: '/about', label: 'About' },
	];

	onMount(() => {
		theme.init();

		// Scroll-fade for hero banner
		if (bannerRef) bannerNaturalHeight = bannerRef.offsetHeight;
		const onScroll = () => {
			if (!bannerRef || !bannerNaturalHeight) return;
			bannerOpacity = Math.max(0, 1 - window.scrollY / bannerNaturalHeight);
			scrolledPastBanner = window.scrollY > 50;
		};
		window.addEventListener('scroll', onScroll, { passive: true });

		return () => {
			window.removeEventListener('scroll', onScroll);
		};
	});

	function isActive(href: string): boolean {
		const path = $page.url.pathname;
		if (href === '/blog') return path.startsWith('/blog');
		if (href === '/photography') return path.startsWith('/photography');
		return path === href;
	}
</script>

<svelte:head>
	{@html `<script type="application/ld+json">${JSON.stringify({
		'@context': 'https://schema.org',
		'@type': 'WebSite',
		name: 'transscendsurvival.org',
		url: 'https://transscendsurvival.org',
		author: { '@type': 'Person', name: 'Jess Sullivan', url: 'https://github.com/Jesssullivan' },
		description: 'Blog and portfolio by Jess Sullivan — full stack engineer, musician, and birdwatcher.',
	})}</script>`}
</svelte:head>

{#if browser}
	<div class="fixed inset-0 -z-10 pointer-events-none" aria-hidden="true" data-testid="blob-background">
		<TinyVectors
			theme="custom"
			colors={blobColors}
			opacity={0.4}
			blobCount={5}
			enableScrollPhysics={true}
			enableDeviceMotion={false}
		/>
	</div>
{/if}

<div class="min-h-screen flex flex-col relative">
	<a
		href="#main-content"
		class="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:top-2 focus:left-2 focus:px-4 focus:py-2 focus:bg-primary-500 focus:text-white focus:rounded focus:text-sm focus:font-semibold"
		>Skip to content</a
	>
	<AppBar class="{scrolledPastBanner ? 'glass-nav' : ''} shadow-sm">
		<AppBar.Toolbar class="grid-cols-[auto_1fr_auto] px-4 py-2">
			<AppBar.Lead>
				<a
					href="/blog"
					class="text-lg font-bold font-heading-hero hover:text-primary-500 transition-colors whitespace-nowrap tracking-wide"
				>
					transscendsurvival.org
				</a>
			</AppBar.Lead>
			<AppBar.Headline></AppBar.Headline>
			<AppBar.Trail>
				<nav class="hidden md:flex items-center gap-3 text-sm">
					{#each navLinks as { href, label } (href)}
						<a
							{href}
							class="hover:text-primary-500 transition-colors {isActive(href) ? 'text-primary-500 font-semibold' : ''}"
							>{label}</a
						>
					{/each}
					<a
						href="https://github.com/Jesssullivan"
						class="hover:text-primary-500 transition-colors"
						target="_blank"
						rel="noopener">GitHub</a
					>
					<ThemeSwitcher />
				</nav>
				<!-- Mobile drawer trigger -->
				<Dialog
					open={mobileOpen}
					onOpenChange={(d) => {
						mobileOpen = d.open;
					}}
					closeOnInteractOutside
					closeOnEscape
					preventScroll
				>
					<Dialog.Trigger class="md:hidden p-2 hover:bg-surface-200-800 rounded" aria-label="Open navigation">
						<svg
							xmlns="http://www.w3.org/2000/svg"
							class="h-5 w-5"
							fill="none"
							viewBox="0 0 24 24"
							stroke="currentColor"
						>
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16" />
						</svg>
					</Dialog.Trigger>
					<Dialog.Backdrop class="drawer-backdrop" />
					<Dialog.Positioner class="drawer-positioner">
						<Dialog.Content class="drawer-content">
							<div class="flex items-center justify-end px-4 py-3 border-b border-surface-300-700">
								<Dialog.CloseTrigger class="p-2 hover:bg-surface-200-800 rounded" aria-label="Close navigation">
									<svg
										xmlns="http://www.w3.org/2000/svg"
										class="h-5 w-5"
										fill="none"
										viewBox="0 0 24 24"
										stroke="currentColor"
									>
										<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
									</svg>
								</Dialog.CloseTrigger>
							</div>
							<Navigation layout="sidebar">
								<Navigation.Content>
									<Navigation.Menu>
										{#each navLinks as { href, label } (href)}
											<Navigation.TriggerAnchor
												{href}
												onclick={() => {
													mobileOpen = false;
												}}
												class={isActive(href) ? 'preset-tonal-primary' : ''}
											>
												<Navigation.TriggerText>{label}</Navigation.TriggerText>
											</Navigation.TriggerAnchor>
										{/each}
										<Navigation.TriggerAnchor
											href="https://github.com/Jesssullivan"
											target="_blank"
											rel="noopener"
											onclick={() => {
												mobileOpen = false;
											}}
										>
											<Navigation.TriggerText>GitHub</Navigation.TriggerText>
										</Navigation.TriggerAnchor>
									</Navigation.Menu>
								</Navigation.Content>
								<Navigation.Footer>
									<div class="w-full space-y-3">
										<div class="flex gap-2">
											{#each ['light', 'dark', 'system'] as const as mode (mode)}
												<button
													onclick={() => {
														theme.setMode(mode);
													}}
													aria-label={`Set color mode to ${mode}`}
													class="flex-1 py-1.5 text-center rounded text-sm hover:bg-surface-200-800 transition-colors capitalize {theme.mode ===
													mode
														? 'text-primary-500 font-semibold'
														: ''}">{mode}</button
												>
											{/each}
										</div>
										<div class="flex flex-wrap gap-1.5">
											{#each THEMES as t (t.id)}
												<button
													onclick={() => {
														theme.setTheme(t.id);
													}}
													aria-label={`Set color theme to ${t.label}`}
													class="px-2 py-1 rounded text-xs hover:bg-surface-200-800 transition-colors flex items-center gap-1 {theme.currentTheme ===
													t.id
														? 'text-primary-500 font-semibold ring-1 ring-primary-500'
														: ''}"
												>
													<span class="flex gap-0.5">
														{#each t.colors as color, index (`${t.id}-${index}`)}
															<span class="w-2 h-2 rounded-full" style="background: {color}"></span>
														{/each}
													</span>
													{t.label}
												</button>
											{/each}
										</div>
									</div>
								</Navigation.Footer>
							</Navigation>
						</Dialog.Content>
					</Dialog.Positioner>
				</Dialog>
			</AppBar.Trail>
		</AppBar.Toolbar>
	</AppBar>

	<!-- Hero banner — visible on all pages, scroll-fades -->
	<section class="hero-banner" bind:this={bannerRef} style:opacity={bannerOpacity}>
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
			<p class="hero-banner-title text-3xl sm:text-4xl lg:text-5xl xl:text-6xl" role="banner">Trans Scend Survival</p>
			<div class="hero-banner-separator" aria-hidden="true"></div>
			<p class="hero-banner-description">
				<span class="hero-banner-description-word"
					><strong>Trans:</strong> Latin prefix implying &ldquo;across&rdquo; or &ldquo;Beyond&rdquo;, often used in gender
					nonconforming situations</span
				>
				<span class="hero-banner-description-dash" aria-hidden="true">&mdash;</span>
				<span class="hero-banner-description-word"
					><strong>Scend:</strong> Archaic word describing a strong &ldquo;surge&rdquo; or &ldquo;wave&rdquo;, originating
					with 15th century english sailors</span
				>
				<span class="hero-banner-description-dash" aria-hidden="true">&mdash;</span>
				<span class="hero-banner-description-word"
					><strong>Survival:</strong> 15th century english compound word describing an existence only worth transcending</span
				>
			</p>
			<p class="hero-banner-subtitle text-base sm:text-lg lg:text-xl">Jess Sullivan</p>
		</div>
	</section>

	<main id="main-content" class="flex-1">
		{@render children()}
	</main>

	<footer class="bg-surface-100-900 border-t border-surface-300-700 py-6 text-center text-sm text-surface-500">
		<div class="container mx-auto px-4 flex flex-wrap items-center justify-center gap-x-4 gap-y-2">
			<p>
				Dedicated to the <a
					href="https://creativecommons.org/publicdomain/zero/1.0/"
					class="hover:text-primary-500 transition-colors underline"
					target="_blank"
					rel="noopener">public domain</a
				>
			</p>
			<span class="text-surface-400">|</span>
			<a href="/feed.xml" class="hover:text-primary-500 transition-colors">RSS</a>
			<span class="text-surface-400">|</span>
			<a href="/feed.json" class="hover:text-primary-500 transition-colors">JSON</a>
			<span class="text-surface-400">|</span>
			<a href="/THIRD-PARTY-LICENSES" class="hover:text-primary-500 transition-colors">Licenses</a>
		</div>
		<p class="mt-2 text-xs text-surface-400">
			Static site built with <a
				href="https://svelte.dev/docs/kit"
				class="hover:text-primary-500 transition-colors underline"
				target="_blank"
				rel="noopener">SvelteKit</a
			>
			&amp;
			<a
				href="https://www.skeleton.dev"
				class="hover:text-primary-500 transition-colors underline"
				target="_blank"
				rel="noopener">Skeleton</a
			>, hosted for free on
			<a
				href="https://pages.github.com"
				class="hover:text-primary-500 transition-colors underline"
				target="_blank"
				rel="noopener">GitHub Pages</a
			>
			&mdash;
			<a
				href="https://github.com/Jesssullivan/jesssullivan.github.io"
				class="hover:text-primary-500 transition-colors underline"
				target="_blank"
				rel="noopener">source</a
			>
		</p>
	</footer>
</div>
