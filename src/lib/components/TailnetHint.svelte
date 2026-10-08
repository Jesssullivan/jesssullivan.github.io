<script lang="ts">
	// Hint-tier tailnet affordance (row TS18). Default off: with no
	// VITE_TAILNET_HINT_MANIFEST_URL at build time it never probes or renders.
	// Prerendered HTML and every failure path render nothing. Decoration only;
	// never put private content behind it.
	import { onMount } from 'svelte';
	import { probeTailnetHint, resolveTailnetHintManifest, TAILNET_HINT_FLAG } from '$lib/flags/tailnet-hint';

	let { flag = TAILNET_HINT_FLAG }: { flag?: string } = $props();

	const manifestUrl = resolveTailnetHintManifest(import.meta.env.VITE_TAILNET_HINT_MANIFEST_URL);
	let open = $state(false);

	onMount(() => {
		if (manifestUrl === null) return;
		const teardown = new AbortController();
		void probeTailnetHint(manifestUrl, flag, { signal: teardown.signal }).then((granted) => {
			if (!teardown.signal.aborted) open = granted;
		});
		return () => teardown.abort();
	});
</script>

{#if open}
	<span class="text-surface-400">|</span>
	<span data-hint="tailnet" title="A browser-side hint, not a login">tailnet visitor</span>
{/if}
