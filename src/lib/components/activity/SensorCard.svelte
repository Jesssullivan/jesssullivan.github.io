<script lang="ts">
	import type { ResolvedActivity } from '$lib/activitypub/types';

	let { activity }: { activity: ResolvedActivity } = $props();

	function formatDate(d: Date): string {
		return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
	}
</script>

<article class="card glass p-4 space-y-2">
	<div class="flex items-start gap-3">
		<span class="text-2xl shrink-0" aria-hidden="true">📡</span>
		<div class="min-w-0">
			<div class="flex items-center gap-2 text-xs text-surface-500">
				<time class="font-mono">{formatDate(activity.published)}</time>
				<span class="badge preset-outlined-warning-500 text-xs">sensor</span>
			</div>
			{#if activity.sensor}
				<p class="text-sm text-surface-500 mt-1">{activity.sensor.sensorId}</p>
				<div class="grid grid-cols-3 gap-2 mt-2">
					{#each activity.sensor.measurements as m (m.name)}
						<div class="text-center p-2 rounded-lg bg-surface-100-900">
							<div class="text-lg font-semibold font-mono">{m.value}<span class="text-xs text-surface-500">{m.unit}</span></div>
							<div class="text-xs text-surface-500">{m.name}</div>
						</div>
					{/each}
				</div>
			{/if}
		</div>
	</div>
</article>
