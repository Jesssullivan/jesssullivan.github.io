<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	let container: HTMLDivElement;
	let observer: MutationObserver | undefined;

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

	onMount(() => {
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

		observer = new MutationObserver((mutations) => {
			for (const m of mutations) {
				if (m.attributeName === 'data-mode') {
					sendGiscusMessage(getGiscusTheme());
				}
			}
		});
		observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-mode'] });
	});

	onDestroy(() => {
		observer?.disconnect();
	});
</script>

<section class="mt-12 pt-8 border-t border-surface-300-700">
	<h2 class="text-xl font-semibold mb-4">Comments</h2>
	<div bind:this={container}></div>
</section>
