<script lang="ts">
	import type { ResolvedActivity } from '$lib/activitypub/types';

	let { activity }: { activity: ResolvedActivity } = $props();

	function formatDate(d: Date): string {
		return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
	}
</script>

<article class="card glass p-4 space-y-2">
	<div class="flex items-start gap-3">
		<span class="text-2xl shrink-0" aria-hidden="true">💬</span>
		<div class="min-w-0">
			<div class="flex items-center gap-2 text-xs text-surface-500">
				<time class="font-mono">{formatDate(activity.published)}</time>
				<span class="badge preset-outlined-surface-500 text-xs">note</span>
			</div>
			<div class="prose prose-sm mt-1 text-surface-700-300 leading-relaxed">
				{activity.content}
			</div>
			{#if activity.tags.length > 0}
				<div class="flex flex-wrap gap-1 mt-2">
					{#each activity.tags as tag (tag)}
						<span class="badge preset-outlined-surface-500 text-xs">{tag}</span>
					{/each}
				</div>
			{/if}
		</div>
	</div>
</article>
