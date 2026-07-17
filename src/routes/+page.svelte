<script lang="ts">
	import { onMount } from 'svelte';
	import type { PageData } from './$types';
	import { buildConstellationGroups, partitionLedger } from '$lib/reader/ledger';
	import {
		TINYLAND_PULSE_PUBLIC_SNAPSHOT_URL,
		loadPulsePublicBrokerSnapshot,
	} from '$lib/pulse/load';
	import type { PublicPulseItem } from '@blog/pulse-core/schema';
	import ObservatoryMasthead from '$lib/components/reader/ObservatoryMasthead.svelte';
	import NoteworthySpread from '$lib/components/reader/NoteworthySpread.svelte';
	import LedgerRegister from '$lib/components/reader/LedgerRegister.svelte';
	import PulseRail from '$lib/components/reader/PulseRail.svelte';
	import ConstellationSection from '$lib/components/reader/ConstellationSection.svelte';

	let { data }: { data: PageData } = $props();

	// The checked-in pulse snapshot ages between deploys (it has sat at 3 items
	// while the live broker carries 6 — TIN-2641), so the rail self-heals after
	// hydration exactly like /pulse does: live broker snapshot when reachable,
	// the static build-time items otherwise. Failure is silent by design —
	// stale-not-broken is the ruled fail-soft posture.
	let brokerItems = $state<PublicPulseItem[] | null>(null);

	onMount(() => {
		let cancelled = false;
		const controller = new AbortController();
		const timer = window.setTimeout(() => controller.abort(), 10_000);

		loadPulsePublicBrokerSnapshot(fetch, {
			endpoint: TINYLAND_PULSE_PUBLIC_SNAPSHOT_URL,
			signal: controller.signal,
		})
			.then((snapshot) => {
				if (!cancelled) brokerItems = snapshot.items;
			})
			.catch(() => {
				// static items stand
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

	const pulseItems = $derived(brokerItems ?? data.pulseItems);

	// The tier partition is the single source of truth for what is "noteworthy".
	// Register 02 carries everything that is not headlined (less-noteworthy first,
	// then the untiered remainder) — which, with today's zero-tier data, is the
	// whole log, so the front page is never empty.
	const partition = $derived(partitionLedger(data.posts));
	const ledgerRows = $derived([...partition.lessNoteworthy, ...partition.unclassified]);
	const groups = $derived(buildConstellationGroups(data.posts, pulseItems));
</script>

<svelte:head>
	<title>transscendsurvival.org — Jess Sullivan</title>
	<meta
		name="description"
		content="A naturalist-technologist's log by Jess Sullivan — long-form entries and a live field pulse, in one system and two registers."
	/>
	<meta property="og:title" content="transscendsurvival.org" />
	<meta
		property="og:description"
		content="A naturalist-technologist's log by Jess Sullivan — long-form entries and a live field pulse."
	/>
	<meta property="og:type" content="website" />
	<meta property="og:url" content="https://transscendsurvival.org/" />
	<meta name="twitter:card" content="summary" />
	<link rel="canonical" href="https://transscendsurvival.org/" />
</svelte:head>

<ObservatoryMasthead posts={data.posts} {pulseItems} />

<div class="container mx-auto px-4 py-10 max-w-6xl">
	<div class="grid gap-10 lg:grid-cols-[minmax(0,1fr)_300px]">
		<div class="min-w-0 space-y-8">
			{#if partition.noteworthy.length > 0}
				<NoteworthySpread posts={partition.noteworthy} />
				<hr class="border-surface-300-700" />
			{/if}

			{#if ledgerRows.length > 0}
				<LedgerRegister
					rows={ledgerRows}
					index={partition.noteworthy.length > 0 ? '02' : '01'}
					archiveTotal={data.posts.length}
				/>
			{:else if partition.noteworthy.length === 0}
				<p class="text-surface-500">No entries yet.</p>
			{/if}
		</div>

		<PulseRail items={pulseItems} />
	</div>

	<hr class="border-surface-300-700 my-10" />

	<ConstellationSection {groups} />
</div>
