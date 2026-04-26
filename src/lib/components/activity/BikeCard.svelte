<script lang="ts">
	import type { ResolvedActivity } from '$lib/activitypub/types';

	let { activity }: { activity: ResolvedActivity } = $props();

	function formatDate(d: Date): string {
		return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
	}

	function formatDuration(mins: number): string {
		const h = Math.floor(mins / 60);
		const m = mins % 60;
		return h > 0 ? `${h}h ${m}m` : `${m}m`;
	}
</script>

<article class="card glass p-4 space-y-2">
	<div class="flex items-start gap-3">
		<span class="text-2xl shrink-0" aria-hidden="true">🚲</span>
		<div class="min-w-0">
			<div class="flex items-center gap-2 text-xs text-surface-500">
				<time class="font-mono">{formatDate(activity.published)}</time>
				<span class="badge preset-outlined-tertiary-500 text-xs">cycling</span>
			</div>
			{#if activity.bike}
				<h3 class="font-heading font-semibold text-lg leading-snug mt-1">
					{activity.bike.distanceMiles.toFixed(1)} mi
				</h3>
				<div class="flex flex-wrap items-center gap-3 text-sm text-surface-600-400 mt-1">
					<span>{formatDuration(activity.bike.durationMinutes)}</span>
					{#if activity.bike.elevationGainFeet}
						<span class="text-surface-400">|</span>
						<span>{activity.bike.elevationGainFeet} ft gain</span>
					{/if}
				</div>
				{#if activity.bike.route}
					<p class="text-sm text-surface-500 mt-1">{activity.bike.route}</p>
				{/if}
			{/if}
		</div>
	</div>
</article>
