<script lang="ts">
	import type { ResolvedActivity } from '$lib/activitypub/types';

	let { activity }: { activity: ResolvedActivity } = $props();

	function formatDate(d: Date): string {
		return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
	}
</script>

<article class="card glass p-4 space-y-2">
	<div class="flex items-start gap-3">
		<span class="text-2xl shrink-0" aria-hidden="true">💻</span>
		<div class="min-w-0">
			<div class="flex items-center gap-2 text-xs text-surface-500">
				<time class="font-mono">{formatDate(activity.published)}</time>
				<span class="badge preset-outlined-primary-500 text-xs">code</span>
			</div>
			{#if activity.code}
				<h3 class="font-heading font-semibold text-base leading-snug mt-1">
					{activity.code.repository}
				</h3>
				<div class="flex items-center gap-3 text-sm font-mono mt-1">
					<span class="text-success-500">+{activity.code.linesAdded}</span>
					<span class="text-error-500">-{activity.code.linesRemoved}</span>
					<span class="text-surface-400">|</span>
					<span class="text-surface-600-400">
						{activity.code.commits} commit{activity.code.commits === 1 ? '' : 's'}
					</span>
				</div>
				{#if activity.code.languages && activity.code.languages.length > 0}
					<div class="flex flex-wrap gap-1 mt-2">
						{#each activity.code.languages as lang (lang)}
							<span class="badge preset-outlined-secondary-500 text-xs">{lang}</span>
						{/each}
					</div>
				{/if}
			{/if}
		</div>
	</div>
</article>
