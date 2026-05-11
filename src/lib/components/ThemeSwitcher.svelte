<script lang="ts">
	import { onMount } from 'svelte';
	import { cubicOut } from 'svelte/easing';
	import { fly } from 'svelte/transition';
	import { Popover, Portal } from '@skeletonlabs/skeleton-svelte';
	import { theme, THEMES } from '$lib/theme.svelte';

	const NUDGE_STORAGE_KEY = 'theme-switcher-nudge-last-shown';
	const NUDGE_DELAY_MS = 3000;
	const NUDGE_IDLE_TIMEOUT_MS = 1000;
	const DESKTOP_QUERY = '(min-width: 768px)';
	const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';
	type IdleCapableWindow = {
		requestIdleCallback?: (callback: IdleRequestCallback, options?: IdleRequestOptions) => number;
		cancelIdleCallback?: (handle: number) => void;
		setTimeout: typeof window.setTimeout;
		clearTimeout: typeof window.clearTimeout;
	};

	let isOpen = $state(false);
	let showNudgeContent = $state(false);
	let pendingNudgeClose = $state(false);
	let prefersReducedMotion = $state(false);
	let userInteracted = false;
	const nudgeActive = $derived(isOpen && showNudgeContent);
	const nudgeTransition = $derived(
		prefersReducedMotion
			? { y: 0, duration: 1, opacity: 1 }
			: { y: -6, duration: 180, opacity: 0.85, easing: cubicOut },
	);

	function todayKey(): string {
		const now = new Date();
		const year = now.getFullYear();
		const month = String(now.getMonth() + 1).padStart(2, '0');
		const day = String(now.getDate()).padStart(2, '0');
		return `${year}-${month}-${day}`;
	}

	function getLastShownDate(): string | null {
		try {
			return localStorage.getItem(NUDGE_STORAGE_KEY);
		} catch {
			return null;
		}
	}

	function storeNudgeShown() {
		try {
			localStorage.setItem(NUDGE_STORAGE_KEY, todayKey());
		} catch {
			// localStorage can be unavailable in strict privacy contexts.
		}
	}

	function markNudgeShown() {
		showNudgeContent = false;
		storeNudgeShown();
	}

	function shouldAutoShowNudge(): boolean {
		return window.matchMedia(DESKTOP_QUERY).matches && getLastShownDate() !== todayKey();
	}

	function revealNudge() {
		if (userInteracted || !shouldAutoShowNudge()) return;
		showNudgeContent = true;
		window.requestAnimationFrame(() => {
			isOpen = true;
		});
	}

	function handleTriggerClick() {
		userInteracted = true;
		markNudgeShown();
	}

	function handleOpenChange(details: { open: boolean }) {
		const wasNudgeActive = nudgeActive;
		isOpen = details.open;
		if (!details.open && wasNudgeActive) markNudgeShown();
	}

	function closeAfterSelection() {
		userInteracted = true;
		markNudgeShown();
		isOpen = false;
	}

	function dismissNudge() {
		userInteracted = true;
		storeNudgeShown();
		if (!showNudgeContent) {
			isOpen = false;
			return;
		}
		pendingNudgeClose = true;
		showNudgeContent = false;
	}

	function handleNudgeOutroEnd() {
		if (!pendingNudgeClose) return;
		pendingNudgeClose = false;
		isOpen = false;
	}

	onMount(() => {
		const idleWindow = window as unknown as IdleCapableWindow;
		const reducedMotion = window.matchMedia(REDUCED_MOTION_QUERY);
		prefersReducedMotion = reducedMotion.matches;
		const handleReducedMotionChange = (event: MediaQueryListEvent) => {
			prefersReducedMotion = event.matches;
		};
		reducedMotion.addEventListener('change', handleReducedMotionChange);

		let idleCallback: number | undefined;
		const timer = window.setTimeout(() => {
			if (userInteracted || !shouldAutoShowNudge()) return;
			if (idleWindow.requestIdleCallback) {
				idleCallback = idleWindow.requestIdleCallback(revealNudge, { timeout: NUDGE_IDLE_TIMEOUT_MS });
			} else {
				idleCallback = idleWindow.setTimeout(revealNudge, 0);
			}
		}, NUDGE_DELAY_MS);

		return () => {
			window.clearTimeout(timer);
			reducedMotion.removeEventListener('change', handleReducedMotionChange);
			if (idleCallback === undefined) return;
			if (idleWindow.cancelIdleCallback) {
				idleWindow.cancelIdleCallback(idleCallback);
			} else {
				idleWindow.clearTimeout(idleCallback);
			}
		};
	});
</script>

<Popover
	open={isOpen}
	onOpenChange={handleOpenChange}
	positioning={{ placement: 'bottom-end', gutter: 8 }}
	closeOnInteractOutside
	closeOnEscape
	autoFocus={false}
>
	<Popover.Trigger
		class="p-1.5 hover:bg-surface-200-800 rounded transition-colors {nudgeActive
			? 'ring-2 ring-primary-500 ring-offset-2 ring-offset-surface-50 dark:ring-offset-surface-900'
			: ''}"
		aria-label="Theme settings"
		onclick={handleTriggerClick}
		data-testid="theme-switcher-trigger"
	>
		<svg
			xmlns="http://www.w3.org/2000/svg"
			class="h-4 w-4"
			fill="none"
			viewBox="0 0 24 24"
			stroke="currentColor"
			aria-hidden="true"
		>
			<path
				stroke-linecap="round"
				stroke-linejoin="round"
				stroke-width="2"
				d="M7 21a4 4 0 01-4-4c0-1.305.835-2.416 2-2.828V11a7 7 0 1114 0v3.172A3.001 3.001 0 0121 17a4 4 0 01-4 4H7z"
			/>
		</svg>
	</Popover.Trigger>
	<Portal>
		<Popover.Positioner class="z-50">
			{#if showNudgeContent}
				<Popover.Arrow class="[--arrow-size:0.625rem]">
					<Popover.ArrowTip class="bg-surface-50 dark:bg-surface-900 border-t border-l border-surface-300-700" />
				</Popover.Arrow>
			{/if}
			<Popover.Content
				class="bg-surface-50 dark:bg-surface-900 border border-surface-300-700 rounded-lg shadow-lg py-2 min-w-[200px] max-w-[20rem] max-h-[calc(100vh-5rem)] overflow-y-auto overscroll-contain origin-top-right transform-gpu opacity-0 scale-95 transition-[opacity,transform] duration-150 ease-out data-[state=open]:opacity-100 data-[state=open]:scale-100 motion-reduce:transition-none"
				data-testid="theme-switcher-content"
			>
				{#if showNudgeContent}
					<div
						class="px-3 pb-3 mb-2 border-b border-surface-300-700"
						data-testid="theme-welcome-nudge"
						transition:fly={nudgeTransition}
						onoutroend={handleNudgeOutroEnd}
					>
						<div class="flex items-start justify-between gap-3">
							<div>
								<Popover.Title class="text-sm font-semibold text-surface-950 dark:text-surface-50">
									Hey there!
								</Popover.Title>
								<Popover.Description class="mt-1 text-sm leading-relaxed text-surface-600 dark:text-surface-300">
									Welcome to Jess&rsquo;s static blog. Set your preferred theme and mode here ^w^, or explore this
									static site&rsquo;s
									<a
										href="https://github.com/Jesssullivan/jesssullivan.github.io"
										target="_blank"
										rel="noopener"
										class="text-primary-500 hover:underline"
										onclick={markNudgeShown}>codebase</a
									>
									and
									<a
										href="https://github.com/Jesssullivan/jesssullivan.github.io/actions/workflows/deploy-pages.yml"
										target="_blank"
										rel="noopener"
										class="text-primary-500 hover:underline"
										onclick={markNudgeShown}>build pipeline</a
									>. This site is dedicated to the
									<a
										href="https://creativecommons.org/publicdomain/zero/1.0/"
										target="_blank"
										rel="noopener"
										class="text-primary-500 hover:underline"
										onclick={markNudgeShown}>public domain</a
									>. -Jess
								</Popover.Description>
							</div>
							<button
								type="button"
								class="shrink-0 rounded p-1 text-surface-500 hover:bg-surface-200-800 hover:text-surface-950 dark:hover:text-surface-50 transition-colors"
								aria-label="Dismiss theme welcome nudge"
								onclick={dismissNudge}
							>
								<svg
									xmlns="http://www.w3.org/2000/svg"
									class="h-4 w-4"
									fill="none"
									viewBox="0 0 24 24"
									stroke="currentColor"
									aria-hidden="true"
								>
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
								</svg>
							</button>
						</div>
					</div>
				{/if}
				<p class="px-3 py-1 text-xs text-surface-400 uppercase tracking-wide font-semibold">Mode</p>
				{#each ['light', 'dark', 'system'] as const as mode (mode)}
					<button
						onclick={() => {
							theme.setMode(mode);
							closeAfterSelection();
						}}
						aria-label={`Set color mode to ${mode}`}
						class="w-full px-3 py-1.5 text-left text-sm hover:bg-surface-200-800 transition-colors capitalize flex items-center justify-between {theme.mode ===
						mode
							? 'text-primary-500 font-semibold'
							: ''}"
					>
						{mode}
						{#if theme.mode === mode}
							<svg
								xmlns="http://www.w3.org/2000/svg"
								class="h-3.5 w-3.5"
								fill="none"
								viewBox="0 0 24 24"
								stroke="currentColor"
								aria-hidden="true"
								><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" /></svg
							>
						{/if}
					</button>
				{/each}
				<div class="border-t border-surface-300-700 my-1.5"></div>
				<p class="px-3 py-1 text-xs text-surface-400 uppercase tracking-wide font-semibold">Theme</p>
				{#each THEMES as t (t.id)}
					<button
						onclick={() => {
							theme.setTheme(t.id);
							closeAfterSelection();
						}}
						aria-label={`Set color theme to ${t.label}`}
						class="w-full px-3 py-1.5 text-left text-sm hover:bg-surface-200-800 transition-colors flex items-center gap-2 {theme.currentTheme ===
						t.id
							? 'text-primary-500 font-semibold'
							: ''}"
					>
						<span class="flex gap-0.5">
							{#each t.colors as color, index (`${t.id}-${index}`)}
								<span class="w-2.5 h-2.5 rounded-full border border-surface-300-700" style="background: {color}"></span>
							{/each}
						</span>
						{t.label}
						{#if theme.currentTheme === t.id}
							<svg
								xmlns="http://www.w3.org/2000/svg"
								class="h-3.5 w-3.5 ml-auto"
								fill="none"
								viewBox="0 0 24 24"
								stroke="currentColor"
								aria-hidden="true"
								><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" /></svg
							>
						{/if}
					</button>
				{/each}
			</Popover.Content>
		</Popover.Positioner>
	</Portal>
</Popover>
