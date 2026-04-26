<script lang="ts">
	import type { ResolvedActivity } from '$lib/activitypub/types';

	let { activity }: { activity: ResolvedActivity } = $props();

	function formatDate(d: Date): string {
		return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
	}
</script>

<article class="card glass p-4 space-y-2">
	<div class="flex items-start gap-3">
		<span class="text-2xl shrink-0" aria-hidden="true">🐦</span>
		<div class="min-w-0">
			<div class="flex items-center gap-2 text-xs text-surface-500">
				<time class="font-mono">{formatDate(activity.published)}</time>
				<span class="badge preset-outlined-success-500 text-xs">birding</span>
			</div>
			{#if activity.bird}
				<h3 class="font-heading font-semibold text-lg leading-snug mt-1">
					{#if activity.bird.count && activity.bird.count > 1}
						<span class="text-surface-400">{activity.bird.count}x</span>
					{/if}
					{activity.bird.species}
				</h3>
				{#if activity.bird.scientificName}
					<p class="text-sm italic text-surface-500">{activity.bird.scientificName}</p>
				{/if}
				{#if activity.bird.location}
					<p class="text-sm text-surface-600-400 mt-1">
						<span class="text-surface-400">at</span> {activity.bird.location.name}
					</p>
				{/if}
			{/if}
		</div>
	</div>
	{#if activity.tags.length > 0}
		<div class="flex flex-wrap gap-1 pl-11">
			{#each activity.tags as tag (tag)}
				<span class="badge preset-outlined-surface-500 text-xs">{tag}</span>
			{/each}
		</div>
	{/if}
</article>
