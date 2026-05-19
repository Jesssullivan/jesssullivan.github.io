<script lang="ts">
	import PulseFeed from '$lib/components/pulse/PulseFeed.svelte';
	import {
		TINYLAND_PULSE_PUBLIC_SNAPSHOT_URL,
		loadPulsePublicBrokerSnapshot,
		summarizePulseSnapshotError,
	} from '$lib/pulse/load';
	import type { PublicPulseSnapshot } from '@blog/pulse-core/schema';
	import { onMount } from 'svelte';

	let { data }: { data: { snapshot: PublicPulseSnapshot } } = $props();

	let brokerSnapshot = $state<PublicPulseSnapshot | null>(null);
	let brokerStatus = $state<'loading' | 'ready' | 'stale'>('loading');
	let brokerUnavailableReason = $state('');

	const endpoint = TINYLAND_PULSE_PUBLIC_SNAPSHOT_URL;
	const snapshot = $derived(brokerSnapshot ?? data.snapshot);
	const updatedAt = $derived(snapshot.manifest.generatedAt);
	const statusLabel = $derived(
		brokerStatus === 'ready'
			? `Updated ${formatTimestamp(updatedAt)}`
			: brokerStatus === 'stale'
				? `Updated ${formatTimestamp(updatedAt)} - may be stale`
				: `Updated ${formatTimestamp(updatedAt)} - checking broker`,
	);

	function formatTimestamp(value: string): string {
		return new Date(value).toLocaleString(undefined, {
			dateStyle: 'medium',
			timeStyle: 'short',
		});
	}

	onMount(() => {
		let cancelled = false;
		const controller = new AbortController();
		const timer = window.setTimeout(() => controller.abort(), 10_000);

		loadPulsePublicBrokerSnapshot(fetch, {
			endpoint,
			signal: controller.signal,
		})
			.then((nextSnapshot) => {
				if (!cancelled) {
					brokerSnapshot = nextSnapshot;
					brokerStatus = 'ready';
				}
			})
			.catch((error: unknown) => {
				if (!cancelled) {
					brokerStatus = 'stale';
					brokerUnavailableReason = summarizePulseSnapshotError(error);
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
	<title>Pulse — jesssullivan.github.io</title>
	<meta name="description" content="Notes and bird sightings published from the tinyland pulse broker." />
</svelte:head>

<div class="max-w-2xl mx-auto py-8 px-4">
	<div class="sr-only" aria-live="polite" data-testid="tinyland-pulse-broker-state">
		{#if brokerStatus === 'ready'}
			Tinyland broker pulse snapshot loaded.
		{:else if brokerStatus === 'stale'}
			Tinyland broker pulse snapshot unavailable: {brokerUnavailableReason}
		{:else}
			Tinyland broker pulse snapshot loading.
		{/if}
	</div>

	<header class="mb-8 space-y-2">
		<div class="flex flex-wrap items-baseline justify-between gap-3">
			<h1 class="font-heading text-3xl font-bold">Pulse</h1>
			<p
				class="text-xs text-surface-600-400"
				title={brokerStatus === 'stale' ? brokerUnavailableReason : endpoint}
			>
				{statusLabel}
			</p>
		</div>
		<p class="text-surface-600-400 leading-relaxed">
			A small public-safe stream of notes and bird sightings, projected from the tinyland broker under the M1
			public-data policy.
		</p>
	</header>

	<PulseFeed {snapshot} />
</div>
