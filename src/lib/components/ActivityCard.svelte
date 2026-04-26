<script lang="ts">
	import type { ResolvedActivity } from '$lib/activitypub/types';
	import BirdCard from './activity/BirdCard.svelte';
	import BikeCard from './activity/BikeCard.svelte';
	import CodeCard from './activity/CodeCard.svelte';
	import SensorCard from './activity/SensorCard.svelte';
	import NoteCard from './activity/NoteCard.svelte';

	let { activity }: { activity: ResolvedActivity } = $props();
</script>

{#if activity.kind === 'bird'}
	<BirdCard {activity} />
{:else if activity.kind === 'bike'}
	<BikeCard {activity} />
{:else if activity.kind === 'code'}
	<CodeCard {activity} />
{:else if activity.kind === 'sensor'}
	<SensorCard {activity} />
{:else}
	<NoteCard {activity} />
{/if}
