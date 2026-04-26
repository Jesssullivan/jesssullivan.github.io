<script lang="ts">
	import type { ResolvedActivity, ActivityKind } from '$lib/activitypub/types';
	import ActivityCard from './ActivityCard.svelte';
	import { AP_CONFIG } from '$lib/activitypub/config';
	import { loadFreshActivities } from '$lib/activitypub/fetch';
	import { browser } from '$app/environment';
	import { onMount } from 'svelte';

	let { activities: serverActivities }: { activities: ResolvedActivity[] } = $props();

	let liveActivities = $state<ResolvedActivity[] | null>(null);
	let activities = $derived(liveActivities ?? serverActivities);
	let filterKind = $state<ActivityKind | null>(null);

	let filtered = $derived(
		(filterKind ? activities.filter((a) => a.kind === filterKind) : activities).slice(
			0,
			AP_CONFIG.displayLimit,
		),
	);

	let kindCounts = $derived(
		activities.reduce(
			(acc, a) => {
				acc[a.kind] = (acc[a.kind] || 0) + 1;
				return acc;
			},
			{} as Record<ActivityKind, number>,
		),
	);

	const KIND_LABELS: Record<ActivityKind, { label: string; icon: string; preset: string }> = {
		bird: { label: 'Birds', icon: '🐦', preset: 'preset-outlined-success-500' },
		bike: { label: 'Rides', icon: '🚲', preset: 'preset-outlined-tertiary-500' },
		code: { label: 'Code', icon: '💻', preset: 'preset-outlined-primary-500' },
		sensor: { label: 'Sensors', icon: '📡', preset: 'preset-outlined-warning-500' },
		note: { label: 'Notes', icon: '💬', preset: 'preset-outlined-surface-500' },
	};

	onMount(async () => {
		if (browser && AP_CONFIG.enableLiveFetch) {
			const fresh = await loadFreshActivities();
			if (fresh.length > 0) liveActivities = fresh;
		}
	});
</script>

<div class="space-y-6">
	<!-- Filter bar -->
	<div class="flex flex-wrap gap-2">
		<button
			class="badge text-sm transition-colors {filterKind === null
				? 'preset-filled-primary-500'
				: 'preset-outlined-surface-500 hover:preset-outlined-primary-500'}"
			onclick={() => (filterKind = null)}
		>
			All ({activities.length})
		</button>
		{#each Object.entries(KIND_LABELS) as [kind, meta] (kind)}
			{@const count = kindCounts[kind as ActivityKind] ?? 0}
			{#if count > 0}
				<button
					class="badge text-sm transition-colors {filterKind === kind
						? 'preset-filled-primary-500'
						: `${meta.preset} hover:preset-outlined-primary-500`}"
					onclick={() => (filterKind = filterKind === kind ? null : (kind as ActivityKind))}
				>
					<span aria-hidden="true">{meta.icon}</span>
					{meta.label} ({count})
				</button>
			{/if}
		{/each}
	</div>

	<!-- Activity feed -->
	<div class="space-y-3">
		{#each filtered as activity (activity.id)}
			<ActivityCard {activity} />
		{/each}
	</div>

	{#if filtered.length === 0}
		<p class="text-center text-surface-500 py-8">No activities to show.</p>
	{/if}
</div>
