<script lang="ts">
	import type { PulseClientOutboxItem } from '$lib/pulse/client/drafts';
	import { mediaLifecycleLabel } from '$lib/pulse/client/media';

	let { items }: { items: readonly PulseClientOutboxItem[] } = $props();

	const stateLabel = (state: PulseClientOutboxItem['state']) => {
		switch (state) {
			case 'draft_ready':
				return 'ready';
			case 'draft_blocked':
				return 'blocked';
			case 'local_queued':
				return 'queued';
			case 'retry_pending':
				return 'retry';
			case 'broker_accepted':
				return 'accepted';
			case 'broker_duplicate':
				return 'duplicate';
			case 'broker_invalid':
				return 'invalid';
			case 'ap_published':
				return 'published';
			case 'ap_blocked':
				return 'AP blocked';
		}
	};

	const badgeClass = (state: PulseClientOutboxItem['state']) => {
		switch (state) {
			case 'draft_blocked':
			case 'broker_invalid':
			case 'ap_blocked':
				return 'preset-filled-error-500';
			case 'broker_duplicate':
			case 'retry_pending':
				return 'preset-filled-warning-500';
			case 'draft_ready':
			case 'local_queued':
			case 'broker_accepted':
			case 'ap_published':
				return 'preset-filled-success-500';
		}
	};
</script>

<section class="space-y-3" aria-label="Client outbox" data-testid="pulse-client-outbox">
	<header class="flex items-end justify-between gap-3">
		<div>
			<p class="text-xs uppercase tracking-wider text-surface-600-400">Client outbox</p>
			<h2 class="font-heading text-xl font-bold">Draft queue</h2>
		</div>
		<p class="text-xs text-surface-600-400">{items.length} local</p>
	</header>

	{#if items.length === 0}
		<p class="text-sm text-surface-600-400">No local drafts queued yet.</p>
	{:else}
		<ol class="space-y-2">
			{#each items as item (item.id)}
				<li class="outbox-row">
					<div class="flex items-start justify-between gap-3">
						<div>
							<p class="text-sm font-medium">{item.label}</p>
							<p class="text-xs text-surface-600-400">{item.detail}</p>
						</div>
						<span class="badge {badgeClass(item.state)}">
							{stateLabel(item.state)}
						</span>
					</div>
					<dl class="mt-2 grid gap-1 text-[0.7rem] text-surface-600-400">
						<div>
							<dt>idempotency</dt>
							<dd>{item.idempotencyKey}</dd>
						</div>
						{#if item.identity}
							<div>
								<dt>actor</dt>
								<dd>{item.identity.displayName} ({item.identity.actor})</dd>
							</div>
							<div>
								<dt>device</dt>
								<dd>{item.identity.deviceLabel} ({item.identity.deviceId})</dd>
							</div>
							<div>
								<dt>session</dt>
								<dd>{item.identity.sessionId}</dd>
							</div>
						{/if}
						{#if item.mediaIntents}
							{#each item.mediaIntents as mediaIntent (mediaIntent.id)}
								<div>
									<dt>media</dt>
									<dd>{mediaIntent.filename} - {mediaLifecycleLabel(mediaIntent.lifecycle)}</dd>
								</div>
							{/each}
						{/if}
						{#if item.eventId}
							<div>
								<dt>event</dt>
								<dd>{item.eventId}</dd>
							</div>
						{/if}
						{#if item.activityId}
							<div>
								<dt>activity</dt>
								<dd>{item.activityId}</dd>
							</div>
						{/if}
					</dl>
				</li>
			{/each}
		</ol>
	{/if}
</section>

<style>
	.outbox-row {
		border: 1px solid var(--color-surface-200);
		border-radius: 0.5rem;
		padding: 0.75rem;
		overflow-wrap: anywhere;
	}
	dt {
		float: left;
		min-width: 5.25rem;
		font-weight: 600;
	}
	dd {
		margin-left: 5.5rem;
	}
	@media (prefers-color-scheme: dark) {
		.outbox-row {
			border-color: var(--color-surface-800);
		}
	}
</style>
