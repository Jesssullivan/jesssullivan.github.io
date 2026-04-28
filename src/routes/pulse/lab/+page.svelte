<script lang="ts">
	import { composeEvent, summarizeReadiness, type LabComposeForm, type LabFormKind } from '$lib/pulse/lab/compose';
	import { applyPolicyToEvent, type PolicyDecision } from '@blog/pulse-core/policy';
	import type { PulseEvent, Visibility, LocationPrecision } from '@blog/pulse-core/schema';

	interface SubmittedRow {
		event: PulseEvent;
		decision: PolicyDecision;
	}

	let counter = $state(0);

	let kind = $state<LabFormKind>('note');
	let visibility = $state<Visibility>('VISIBILITY_PUBLIC');
	let occurredAt = $state(new Date().toISOString());
	let tagsInput = $state('lab');

	let noteText = $state('');

	let birdCommonName = $state('');
	let birdScientificName = $state('');
	let birdCount = $state(1);
	let birdPlaceLabel = $state('');
	let birdPlacePrecision = $state<LocationPrecision>('LOCATION_PRECISION_REGION');
	let birdLatitude = $state<number | null>(null);
	let birdLongitude = $state<number | null>(null);
	let birdObservationId = $state('obs-1');

	let submitted = $state<SubmittedRow[]>([]);
	let lastError = $state<readonly string[]>([]);

	const tags = $derived(
		tagsInput
			.split(',')
			.map((t) => t.trim())
			.filter((t) => t.length > 0),
	);

	const form = $derived<LabComposeForm>({
		payload:
			kind === 'note'
				? { kind: 'note', text: noteText }
				: {
						kind: 'bird_sighting',
						commonName: birdCommonName,
						scientificName: birdScientificName,
						count: birdCount,
						placeLabel: birdPlaceLabel,
						placePrecision: birdPlacePrecision,
						latitude: birdLatitude,
						longitude: birdLongitude,
						observationId: birdObservationId,
					},
		visibility,
		occurredAt,
		tags,
		idempotencyKey: `lab_${counter}`,
	});

	const readiness = $derived(summarizeReadiness(form));
	const canSubmit = $derived(readiness.length === 0);

	const idGenerator = {
		next: (prefix: string) => `${prefix}_${++counter}`,
	};

	function submit() {
		const next = composeEvent(form, { idGenerator });
		if (!next.ok) {
			lastError = next.errors;
			return;
		}
		const decision = applyPolicyToEvent(next.event);
		submitted = [{ event: next.event, decision }, ...submitted];
		lastError = [];
		if (kind === 'note') noteText = '';
		else birdObservationId = `obs-${counter + 1}`;
	}

	function reset() {
		submitted = [];
		lastError = [];
	}

	function decisionLabel(decision: PolicyDecision): string {
		return decision.allowed ? 'public_projected' : `denied: ${decision.reason}`;
	}
</script>

<svelte:head>
	<title>Pulse Lab — jesssullivan.github.io</title>
	<meta name="robots" content="noindex" />
	<meta
		name="description"
		content="In-process composer for the tinyland pulse lifecycle. Mock client, no live broker."
	/>
</svelte:head>

<div class="lab-shell mx-auto py-8 px-4">
	<div class="phone-frame mx-auto">
		<header class="space-y-1 mb-4">
			<p class="text-xs uppercase tracking-wider text-surface-600-400">Pulse Lab</p>
			<h1 class="font-heading text-2xl font-bold">Compose</h1>
			<p class="text-sm text-surface-600-400">In-memory broker. Nothing leaves your browser.</p>
		</header>

		<form
			class="space-y-3"
			onsubmit={(e: SubmitEvent) => {
				e.preventDefault();
				submit();
			}}
		>
			<fieldset class="grid grid-cols-2 gap-2" aria-label="Event kind">
				<button
					type="button"
					class="btn {kind === 'note' ? 'preset-filled-primary-500' : 'preset-outlined-surface-500'}"
					onclick={() => (kind = 'note')}>💬 note</button
				>
				<button
					type="button"
					class="btn {kind === 'bird_sighting' ? 'preset-filled-success-500' : 'preset-outlined-surface-500'}"
					onclick={() => (kind = 'bird_sighting')}>🐦 bird</button
				>
			</fieldset>

			{#if kind === 'note'}
				<label class="label">
					<span>Note</span>
					<textarea class="textarea" rows="3" placeholder="What did you see?" bind:value={noteText}></textarea>
				</label>
			{:else}
				<label class="label">
					<span>Common name</span>
					<input class="input" type="text" bind:value={birdCommonName} />
				</label>
				<label class="label">
					<span>Scientific name</span>
					<input class="input" type="text" bind:value={birdScientificName} />
				</label>
				<label class="label">
					<span>Count</span>
					<input class="input" type="number" min="1" bind:value={birdCount} />
				</label>
				<label class="label">
					<span>Place label</span>
					<input class="input" type="text" bind:value={birdPlaceLabel} placeholder="region or feeder" />
				</label>
				<label class="label">
					<span>Precision</span>
					<select class="select" bind:value={birdPlacePrecision}>
						<option value="LOCATION_PRECISION_HIDDEN">hidden</option>
						<option value="LOCATION_PRECISION_REGION">region</option>
						<option value="LOCATION_PRECISION_EXACT">exact (will be denied)</option>
					</select>
				</label>
				<label class="label">
					<span>Observation id</span>
					<input class="input" type="text" bind:value={birdObservationId} />
				</label>
			{/if}

			<label class="label">
				<span>Visibility</span>
				<select class="select" bind:value={visibility}>
					<option value="VISIBILITY_PUBLIC">public</option>
					<option value="VISIBILITY_UNLISTED">unlisted</option>
					<option value="VISIBILITY_PRIVATE">private</option>
				</select>
			</label>
			<label class="label">
				<span>Occurred at</span>
				<input class="input" type="text" bind:value={occurredAt} />
			</label>
			<label class="label">
				<span>Tags (comma separated)</span>
				<input class="input" type="text" bind:value={tagsInput} />
			</label>

			{#if readiness.length > 0}
				<ul class="text-xs text-warning-500 space-y-0.5">
					{#each readiness as msg (msg)}
						<li>· {msg}</li>
					{/each}
				</ul>
			{/if}

			{#if lastError.length > 0}
				<ul class="text-xs text-error-500 space-y-0.5">
					{#each lastError as msg (msg)}
						<li>! {msg}</li>
					{/each}
				</ul>
			{/if}

			<button type="submit" class="btn preset-filled-primary-500 w-full" disabled={!canSubmit} data-testid="lab-submit">
				Submit to broker mock
			</button>
		</form>

		<section class="mt-6 space-y-2" aria-label="Submitted events">
			<header class="flex items-center justify-between">
				<h2 class="font-heading text-lg">Lifecycle</h2>
				{#if submitted.length > 0}
					<button type="button" class="btn btn-sm preset-outlined-surface-500" onclick={reset}> clear </button>
				{/if}
			</header>
			{#if submitted.length === 0}
				<p class="text-sm text-surface-600-400">
					Nothing submitted yet. Try a public note, then a private one, then a bird sighting with exact location to see
					the policy gate fire.
				</p>
			{:else}
				<ol class="space-y-2">
					{#each submitted as row (row.event.id)}
						<li class="card p-3 preset-outlined-surface-500 text-sm space-y-1">
							<div class="flex items-center justify-between">
								<span class="font-mono text-xs">{row.event.id}</span>
								<span class="badge {row.decision.allowed ? 'preset-filled-success-500' : 'preset-filled-error-500'}">
									{decisionLabel(row.decision)}
								</span>
							</div>
							<div class="text-xs text-surface-600-400">
								{row.event.payload.kind} · {row.event.visibility}
							</div>
							{#if !row.decision.allowed}
								<p class="text-xs">{row.decision.detail}</p>
							{/if}
						</li>
					{/each}
				</ol>
			{/if}
		</section>
	</div>
</div>

<style>
	.lab-shell {
		max-width: 100%;
	}
	.phone-frame {
		max-width: 22rem;
		border: 1px solid var(--color-surface-300);
		border-radius: 1.75rem;
		padding: 1.25rem;
		background: var(--color-surface-50);
	}
	@media (prefers-color-scheme: dark) {
		.phone-frame {
			background: var(--color-surface-950);
			border-color: var(--color-surface-700);
		}
	}
</style>
