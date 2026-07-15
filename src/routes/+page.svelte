<script lang="ts">
	import type { PageData } from './$types';
	import { buildConstellationGroups, partitionLedger } from '$lib/reader/ledger';
	import ObservatoryMasthead from '$lib/components/reader/ObservatoryMasthead.svelte';
	import NoteworthySpread from '$lib/components/reader/NoteworthySpread.svelte';
	import LedgerRegister from '$lib/components/reader/LedgerRegister.svelte';
	import PulseRail from '$lib/components/reader/PulseRail.svelte';
	import ConstellationSection from '$lib/components/reader/ConstellationSection.svelte';

	let { data }: { data: PageData } = $props();

	// The tier partition is the single source of truth for what is "noteworthy".
	// Register 02 carries everything that is not headlined (less-noteworthy first,
	// then the untiered remainder) — which, with today's zero-tier data, is the
	// whole log, so the front page is never empty.
	const partition = $derived(partitionLedger(data.posts));
	const ledgerRows = $derived([...partition.lessNoteworthy, ...partition.unclassified]);
	const groups = $derived(buildConstellationGroups(data.posts, data.pulseItems));
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

<ObservatoryMasthead posts={data.posts} pulseItems={data.pulseItems} />

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

		<PulseRail items={data.pulseItems} />
	</div>

	<hr class="border-surface-300-700 my-10" />

	<ConstellationSection {groups} />
</div>
