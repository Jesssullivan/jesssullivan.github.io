<script lang="ts">
	import type { ActivityPubDemoPublishResult } from '@blog/pulse-core/publisher';

	let { publication }: { publication: ActivityPubDemoPublishResult } = $props();

	const publishedCount = $derived(publication.queue.filter((item) => item.state === 'published').length);
	const blockedCount = $derived(publication.queue.filter((item) => item.state === 'blocked').length);
</script>

<section class="mt-6 space-y-2" aria-label="ActivityPub demo publisher" data-testid="pulse-ap-demo-queue">
	<header class="space-y-1">
		<p class="text-xs uppercase tracking-wider text-surface-600-400">AP demo</p>
		<h2 class="font-heading text-lg">Publisher queue</h2>
		<p class="text-xs text-surface-600-400">
			{publishedCount} published · {blockedCount} blocked · {publication.outbox.totalItems} outbox items
		</p>
	</header>
	{#if publication.queue.length === 0}
		<p class="text-sm text-surface-600-400">
			Public submissions become ActivityStreams Create activities. Policy denials stay blocked in the queue.
		</p>
	{:else}
		<ol class="space-y-2">
			{#each publication.queue as item (item.id)}
				<li class="queue-row">
					{#if item.state === 'published'}
						<p class="text-xs uppercase tracking-wider text-success-500">published</p>
						<p class="text-sm font-medium">{item.activity.object.summary}</p>
						<code class="block text-[0.65rem] text-surface-600-400">{item.activity.id}</code>
					{:else}
						<p class="text-xs uppercase tracking-wider text-error-500">blocked</p>
						<p class="text-sm font-medium">policy blocked</p>
						<p class="text-xs text-surface-600-400">{item.detail}</p>
						<code class="block text-[0.65rem] text-surface-600-400">{item.sourceEventId}</code>
					{/if}
				</li>
			{/each}
		</ol>
		<details class="outbox-json">
			<summary class="text-sm font-medium">Outbox JSON</summary>
			<pre>{JSON.stringify(publication.outbox, null, 2)}</pre>
		</details>
	{/if}
</section>

<style>
	.queue-row {
		border: 1px solid var(--color-surface-200);
		border-radius: 0.5rem;
		padding: 0.75rem;
		overflow-wrap: anywhere;
	}
	.outbox-json {
		border: 1px solid var(--color-surface-200);
		border-radius: 0.5rem;
		padding: 0.75rem;
	}
	.outbox-json pre {
		margin-top: 0.5rem;
		max-height: 14rem;
		overflow: auto;
		font-size: 0.7rem;
		line-height: 1.35;
		white-space: pre-wrap;
		overflow-wrap: anywhere;
	}
	@media (prefers-color-scheme: dark) {
		.queue-row,
		.outbox-json {
			border-color: var(--color-surface-800);
		}
	}
</style>
