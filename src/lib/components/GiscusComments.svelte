<script lang="ts">
	import { onMount, onDestroy } from 'svelte';

	let container: HTMLDivElement;
	let observer: MutationObserver | undefined;
	let loading = $state(true);
	let error = $state(false);
	let loadTimeout: ReturnType<typeof setTimeout> | undefined;
	let messageHandler: ((event: MessageEvent) => void) | undefined;
	let intersectionObserver: IntersectionObserver | undefined;

	function getGiscusTheme(): string {
		const mode = document.documentElement.getAttribute('data-mode') || 'light';
		return mode === 'dark' ? 'dark' : 'light';
	}

	function sendGiscusMessage(theme: string) {
		const iframe = document.querySelector<HTMLIFrameElement>('iframe.giscus-frame');
		if (iframe?.contentWindow) {
			iframe.contentWindow.postMessage(
				{ giscus: { setConfig: { theme } } },
				'https://giscus.app'
			);
		}
	}

	function injectGiscusScript() {
		const theme = getGiscusTheme();
		const script = document.createElement('script');
		script.src = 'https://giscus.app/client.js';
		script.setAttribute('data-repo', 'Jesssullivan/jesssullivan.github.io');
		script.setAttribute('data-repo-id', 'R_kgDORMp11w');
		script.setAttribute('data-category', 'Announcements');
		script.setAttribute('data-category-id', 'DIC_kwDORMp1184C2H4B');
		script.setAttribute('data-mapping', 'pathname');
		script.setAttribute('data-strict', '1');
		script.setAttribute('data-reactions-enabled', '1');
		script.setAttribute('data-emit-metadata', '0');
		script.setAttribute('data-input-position', 'top');
		script.setAttribute('data-theme', theme);
		script.setAttribute('data-lang', 'en');
		script.setAttribute('crossorigin', 'anonymous');
		script.async = true;
		container.appendChild(script);

		// Detect when giscus iframe finishes loading via postMessage
		messageHandler = (event: MessageEvent) => {
			if (event.origin !== 'https://giscus.app') return;
			if (event.data?.giscus) {
				loading = false;
				clearTimeout(loadTimeout);
			}
		};
		window.addEventListener('message', messageHandler);

		// Timeout: show error if giscus doesn't load within 10 seconds
		loadTimeout = setTimeout(() => {
			if (loading) {
				loading = false;
				error = true;
			}
		}, 10_000);

		// Watch for theme changes
		observer = new MutationObserver((mutations) => {
			for (const m of mutations) {
				if (m.attributeName === 'data-mode') {
					sendGiscusMessage(getGiscusTheme());
				}
			}
		});
		observer.observe(document.documentElement, {
			attributes: true,
			attributeFilter: ['data-mode']
		});
	}

	onMount(() => {
		intersectionObserver = new IntersectionObserver(
			(entries) => {
				if (entries[0].isIntersecting) {
					intersectionObserver?.disconnect();
					injectGiscusScript();
				}
			},
			{ rootMargin: '200px' }
		);
		intersectionObserver.observe(container);
	});

	onDestroy(() => {
		intersectionObserver?.disconnect();
		observer?.disconnect();
		clearTimeout(loadTimeout);
		if (messageHandler) {
			window.removeEventListener('message', messageHandler);
		}
	});
</script>

<section
	class="mt-12 pt-8 border-t border-surface-300-700"
	aria-label="Comments"
	data-testid="comments-section"
>
	<h2 class="text-xl font-semibold mb-4">Comments</h2>

	{#if loading && !error}
		<div
			class="card p-6 space-y-3 animate-pulse"
			role="status"
			aria-busy="true"
			aria-label="Loading comments"
			data-testid="comments-loading"
		>
			<div class="h-4 bg-surface-300-700 rounded w-3/4"></div>
			<div class="h-4 bg-surface-300-700 rounded w-1/2"></div>
			<div class="h-10 bg-surface-300-700 rounded w-full mt-4"></div>
			<span class="sr-only">Loading comments...</span>
		</div>
	{/if}

	{#if error}
		<div class="card p-6 text-center text-surface-500" data-testid="comments-error">
			<p class="text-sm">Comments could not be loaded.</p>
			<p class="text-xs mt-1">
				Try refreshing the page or visit the
				<a
					href="https://github.com/Jesssullivan/jesssullivan.github.io/discussions"
					class="text-primary-500 hover:underline"
					target="_blank"
					rel="noopener"
				>
					GitHub discussion
				</a>
				directly.
			</p>
		</div>
	{/if}

	<div bind:this={container} class="min-h-[200px]" class:hidden={error}></div>
</section>
