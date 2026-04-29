<script lang="ts">
	import type { PolicyDecision } from '@blog/pulse-core/policy';
	import type { PulseEvent } from '@blog/pulse-core/schema';

	let { event, decision }: { event: PulseEvent; decision: PolicyDecision } = $props();

	const decisionLabel = $derived(decision.allowed ? 'public_projected' : `denied: ${decision.reason}`);
</script>

<div class="card p-3 preset-outlined-surface-500 text-sm space-y-1" data-testid="pulse-lab-decision-row">
	<div class="flex items-center justify-between">
		<span class="font-mono text-xs">{event.id}</span>
		<span class="badge {decision.allowed ? 'preset-filled-success-500' : 'preset-filled-error-500'}">
			{decisionLabel}
		</span>
	</div>
	<div class="text-xs text-surface-600-400">
		{event.payload.kind} · {event.visibility}
	</div>
	{#if !decision.allowed}
		<p class="text-xs">{decision.detail}</p>
	{/if}
</div>
