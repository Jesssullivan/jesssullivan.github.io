<script lang="ts">
	import type { PulseApStreamDemoPanelState } from '$lib/pulse/apStreamDemo';

	let { state }: { state: PulseApStreamDemoPanelState } = $props();
</script>

<section class="stream-panel" aria-label="Tinyland AP stream lab" data-testid="pulse-ap-stream-panel">
	<header class="stream-header">
		<p class="text-xs uppercase tracking-wider text-surface-600-400">Tinyland Pulse</p>
		<h1 class="font-heading text-2xl font-bold">AP stream</h1>
		<p class="text-sm text-surface-600-400 break-words">{state.endpoint}</p>
	</header>

	{#if state.status === 'loading'}
		<div class="status-row" role="status" data-testid="pulse-ap-stream-loading">
			<p class="font-medium">Connecting to Tinyland broker</p>
			<p class="text-sm text-surface-600-400">Live read pending.</p>
		</div>
	{:else if state.status === 'unavailable'}
		<div class="status-row unavailable" role="status" data-testid="pulse-ap-stream-unavailable">
			<p class="font-medium">Broker stream unavailable</p>
			<p class="text-sm text-surface-600-400">{state.reason}</p>
		</div>
	{:else}
		{@const demo = state.demo}
		<div class="status-grid" data-testid="pulse-ap-stream-ready">
			<div>
				<p class="label">Status</p>
				<p class="value">AP-shaped projection only</p>
			</div>
			<div>
				<p class="label">Fediverse delivery</p>
				<p class="value">off</p>
			</div>
			<div>
				<p class="label">Policy</p>
				<p class="value">{demo.policyVersion}</p>
			</div>
			<div>
				<p class="label">Items</p>
				<p class="value">{demo.itemCount}</p>
			</div>
		</div>

		<ol class="stream-list">
			{#each demo.orderedItems as item (item.id)}
				<li class="stream-item">
					<header class="space-y-1">
						<p class="text-xs uppercase tracking-wider text-primary-500">{item.type}</p>
						<h2 class="font-heading text-lg font-semibold">{item.summary}</h2>
						<time class="text-xs text-surface-600-400" datetime={item.published}>{item.published}</time>
					</header>
					<p class="text-sm leading-relaxed whitespace-pre-line">{item.content}</p>
					{#if item.tag.length > 0}
						<ul class="flex flex-wrap gap-2" aria-label="Tags">
							{#each item.tag as tag (tag.name)}
								<li class="badge preset-outlined-surface-500 text-xs">{tag.name}</li>
							{/each}
						</ul>
					{/if}
					<code class="block text-[0.65rem] text-surface-600-400">{item.id}</code>
				</li>
			{/each}
		</ol>

		<footer class="stream-footer">
			<p>Generated {demo.generatedAt}</p>
			<p>Content {demo.contentHash}</p>
			<p>{demo.activityPubStatus}</p>
		</footer>
	{/if}
</section>

<style>
	.stream-panel {
		max-width: 48rem;
		margin: 0 auto;
		padding: 2rem 1rem;
	}

	.stream-header {
		margin-bottom: 1.5rem;
		display: grid;
		gap: 0.25rem;
	}

	.status-row,
	.status-grid,
	.stream-item {
		border: 1px solid var(--color-surface-200);
		border-radius: 0.5rem;
		background: color-mix(in oklab, var(--color-surface-50) 88%, transparent);
	}

	.status-row {
		padding: 1rem;
	}

	.unavailable {
		border-color: var(--color-warning-500);
	}

	.status-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(10rem, 1fr));
		gap: 0.75rem;
		padding: 1rem;
	}

	.label {
		font-size: 0.7rem;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: var(--color-surface-600);
	}

	.value {
		font-size: 0.95rem;
		font-weight: 600;
	}

	.stream-list {
		margin-top: 1rem;
		display: grid;
		gap: 1rem;
	}

	.stream-item {
		display: grid;
		gap: 0.75rem;
		padding: 1rem;
		overflow-wrap: anywhere;
	}

	.stream-footer {
		margin-top: 1rem;
		display: grid;
		gap: 0.25rem;
		font-size: 0.75rem;
		color: var(--color-surface-600);
		overflow-wrap: anywhere;
	}

	@media (prefers-color-scheme: dark) {
		.status-row,
		.status-grid,
		.stream-item {
			border-color: var(--color-surface-800);
			background: color-mix(in oklab, var(--color-surface-950) 80%, transparent);
		}

		.unavailable {
			border-color: var(--color-warning-500);
		}

		.label,
		.stream-footer {
			color: var(--color-surface-400);
		}
	}
</style>
