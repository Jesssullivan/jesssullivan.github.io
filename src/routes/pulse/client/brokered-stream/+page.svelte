<script lang="ts">
	import PulseApStreamDemoPanel from '$lib/components/pulse/PulseApStreamDemoPanel.svelte';
	import {
		TINYLAND_PULSE_AP_STREAM_DEMO_URL,
		loadPulseApStreamDemo,
		summarizePulseApStreamError,
		type PulseApStreamDemoPanelState,
	} from '$lib/pulse/apStreamDemo';
	import { onMount } from 'svelte';

	const endpoint = TINYLAND_PULSE_AP_STREAM_DEMO_URL;
	let state = $state<PulseApStreamDemoPanelState>({ status: 'loading', endpoint });

	onMount(() => {
		let cancelled = false;
		const controller = new AbortController();
		const timer = window.setTimeout(() => controller.abort(), 10_000);

		loadPulseApStreamDemo(fetch, { endpoint, signal: controller.signal })
			.then((demo) => {
				if (!cancelled) {
					state = { status: 'ready', endpoint, demo };
				}
			})
			.catch((error: unknown) => {
				if (!cancelled) {
					state = { status: 'unavailable', endpoint, reason: summarizePulseApStreamError(error) };
				}
			})
			.finally(() => {
				window.clearTimeout(timer);
			});

		return () => {
			cancelled = true;
			window.clearTimeout(timer);
			controller.abort();
		};
	});
</script>

<svelte:head>
	<title>Pulse AP Stream Lab — jesssullivan.github.io</title>
	<meta name="robots" content="noindex,nofollow" />
	<meta name="description" content="Hidden live Tinyland Pulse AP stream lab for transscendsurvival.org." />
</svelte:head>

<PulseApStreamDemoPanel {state} />
