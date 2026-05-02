<script lang="ts">
	import PulseActivityPubQueue from '$lib/components/pulse/PulseActivityPubQueue.svelte';
	import PulseClientOutbox from '$lib/components/pulse/PulseClientOutbox.svelte';
	import {
		draftPreviewToOutboxItem,
		evaluatePulseClientDraft,
		summarizeClientDraftReadiness,
		submitPulseClientDraftToBroker,
		type PulseClientBirdDraft,
		type PulseClientDraft,
		type PulseClientDraftKind,
		type PulseClientNoteDraft,
		type PulseClientOutboxItem,
	} from '$lib/pulse/client/drafts';
	import { createBroker, seededIdGenerator, tickingClock } from '@blog/pulse-core/broker';
	import type { ActivityPubDemoPublishResult } from '@blog/pulse-core/publisher';
	import type { LocationPrecision, Visibility } from '@blog/pulse-core/schema';
	import { onMount } from 'svelte';

	const initialNowIso = '2026-04-30T20:00:00.000Z';
	const publicationOptions = {
		sourceSnapshotId: 'pulse-client-browser',
		baseUrl: 'https://jesssullivan.github.io/pulse/ap-demo',
		actorId: 'https://jesssullivan.github.io/pulse/actors/jess',
	} as const;

	const broker = createBroker({
		clock: tickingClock('2026-04-30T20:00:00.000Z', 1000),
		idGenerator: seededIdGenerator(0),
	});

	const initialPublication = (): ActivityPubDemoPublishResult => broker.deriveActivityPubDemo(publicationOptions);

	const demoTimestamp = (value: number): string => new Date(Date.parse(initialNowIso) + value * 60_000).toISOString();

	let sequence = $state(1);
	let kind = $state<PulseClientDraftKind>('note');
	let visibility = $state<Visibility>('VISIBILITY_PUBLIC');
	let occurredAt = $state(initialNowIso);
	let tagsInput = $state('client, pulse');
	let idempotencyKey = $state('pulse-client-1');

	let noteText = $state('Testing the Pulse client draft/outbox lane from the static demo.');

	let birdCommonName = $state('Northern Cardinal');
	let birdScientificName = $state('Cardinalis cardinalis');
	let birdCount = $state(1);
	let birdPlaceLabel = $state('Cayuga Lake basin');
	let birdPlacePrecision = $state<LocationPrecision>('LOCATION_PRECISION_REGION');
	let birdObservationId = $state('client-obs-1');

	let outbox = $state<PulseClientOutboxItem[]>([]);
	let publication = $state(initialPublication());
	let lastErrors = $state<readonly string[]>([]);
	let hydrated = $state(false);

	onMount(() => {
		hydrated = true;
	});

	const draft = $derived<PulseClientDraft>(
		kind === 'note'
			? ({
					id: `draft_${sequence}`,
					kind: 'note',
					visibility,
					occurredAt,
					tagsInput,
					idempotencyKey,
					text: noteText,
				} satisfies PulseClientNoteDraft)
			: ({
					id: `draft_${sequence}`,
					kind: 'bird_sighting',
					visibility,
					occurredAt,
					tagsInput,
					idempotencyKey,
					commonName: birdCommonName,
					scientificName: birdScientificName,
					count: birdCount,
					placeLabel: birdPlaceLabel,
					placePrecision: birdPlacePrecision,
					observationId: birdObservationId,
				} satisfies PulseClientBirdDraft),
	);

	const readiness = $derived(summarizeClientDraftReadiness(draft));
	const preview = $derived(evaluatePulseClientDraft(draft));

	function resetDraft(nextKind = kind) {
		const nextSequence = sequence + 1;
		sequence = nextSequence;
		kind = nextKind;
		visibility = 'VISIBILITY_PUBLIC';
		occurredAt = demoTimestamp(nextSequence);
		tagsInput = nextKind === 'note' ? 'client, pulse' : 'client, birds';
		idempotencyKey = `pulse-client-${nextSequence}`;
		noteText = '';
		birdCommonName = '';
		birdScientificName = '';
		birdCount = 1;
		birdPlaceLabel = '';
		birdPlacePrecision = 'LOCATION_PRECISION_REGION';
		birdObservationId = `client-obs-${nextSequence}`;
		lastErrors = [];
	}

	function setKind(nextKind: PulseClientDraftKind) {
		resetDraft(nextKind);
	}

	function loadDemoPreset(preset: 'note' | 'bird' | 'blocked_bird') {
		const nextSequence = sequence + 1;
		sequence = nextSequence;
		occurredAt = demoTimestamp(nextSequence);
		visibility = 'VISIBILITY_PUBLIC';
		idempotencyKey = `pulse-client-${preset}-${nextSequence}`;
		lastErrors = [];

		if (preset === 'note') {
			kind = 'note';
			tagsInput = 'client, pulse';
			noteText = 'A local Pulse client draft moving through broker preview and AP demo publish.';
			return;
		}

		kind = 'bird_sighting';
		tagsInput = 'client, birds';
		noteText = '';
		birdCommonName = preset === 'blocked_bird' ? 'Great Blue Heron' : 'Northern Cardinal';
		birdScientificName = preset === 'blocked_bird' ? 'Ardea herodias' : 'Cardinalis cardinalis';
		birdCount = preset === 'blocked_bird' ? 1 : 2;
		birdPlaceLabel = preset === 'blocked_bird' ? 'Backyard snag' : 'Cayuga Lake basin';
		birdPlacePrecision = preset === 'blocked_bird' ? 'LOCATION_PRECISION_EXACT' : 'LOCATION_PRECISION_REGION';
		birdObservationId = `client-obs-${preset}-${nextSequence}`;
	}

	function addPreview() {
		const result = evaluatePulseClientDraft(draft);
		outbox = [draftPreviewToOutboxItem(draft, result), ...outbox];
		lastErrors = result.ok ? [] : result.errors;
		if (result.ok) resetDraft();
	}

	function submitToBroker() {
		const submission = submitPulseClientDraftToBroker(broker, draft, publicationOptions);
		outbox = [submission.outboxItem, ...outbox];
		publication = submission.publication;
		lastErrors = submission.errors;
		if (submission.errors.length === 0) resetDraft();
	}

	function clearOutbox() {
		outbox = [];
		lastErrors = [];
	}
</script>

<svelte:head>
	<title>Pulse Client - jesssullivan.github.io</title>
	<meta name="robots" content="noindex" />
	<meta name="description" content="Temporary Pulse M2 client scaffold for local draft and broker-preview work." />
</svelte:head>

<div class="client-shell mx-auto py-8 px-4" data-testid="pulse-client-shell" data-hydrated={hydrated}>
	<header class="mb-6 space-y-2">
		<p class="text-xs uppercase tracking-wider text-surface-600-400">Pulse Client</p>
		<h1 class="font-heading text-3xl font-bold">Draft outbox</h1>
		<p class="max-w-2xl text-sm text-surface-600-400">
			Local draft intent, idempotency keys, broker-preview submit, policy state, and AP-shaped demo publish.
		</p>
	</header>

	<div class="client-grid">
		<section class="compose-panel" aria-label="Pulse client draft composer">
			<form
				class="space-y-3"
				onsubmit={(e: SubmitEvent) => {
					e.preventDefault();
					submitToBroker();
				}}
			>
				<fieldset class="grid grid-cols-2 gap-2">
					<legend class="sr-only">Event kind</legend>
					<button
						type="button"
						class="btn {kind === 'note' ? 'preset-filled-primary-500' : 'preset-outlined-surface-500'}"
						onclick={() => setKind('note')}>note</button
					>
					<button
						type="button"
						class="btn {kind === 'bird_sighting' ? 'preset-filled-success-500' : 'preset-outlined-surface-500'}"
						onclick={() => setKind('bird_sighting')}>bird</button
					>
				</fieldset>

				<div class="demo-row" aria-label="Demo draft presets">
					<button type="button" class="btn btn-sm preset-outlined-surface-500" onclick={() => loadDemoPreset('note')}
						>demo note</button
					>
					<button type="button" class="btn btn-sm preset-outlined-surface-500" onclick={() => loadDemoPreset('bird')}
						>demo bird</button
					>
					<button
						type="button"
						class="btn btn-sm preset-outlined-surface-500"
						onclick={() => loadDemoPreset('blocked_bird')}>blocked bird</button
					>
				</div>

				{#if kind === 'note'}
					<label class="label">
						<span>Note</span>
						<textarea class="textarea" rows="4" aria-label="Note" bind:value={noteText}></textarea>
					</label>
				{:else}
					<div class="grid gap-3 sm:grid-cols-2">
						<label class="label">
							<span>Common name</span>
							<input class="input" type="text" aria-label="Common name" bind:value={birdCommonName} />
						</label>
						<label class="label">
							<span>Scientific name</span>
							<input class="input" type="text" aria-label="Scientific name" bind:value={birdScientificName} />
						</label>
					</div>
					<div class="grid gap-3 sm:grid-cols-2">
						<label class="label">
							<span>Count</span>
							<input class="input" type="number" min="1" aria-label="Count" bind:value={birdCount} />
						</label>
						<label class="label">
							<span>Observation id</span>
							<input class="input" type="text" aria-label="Observation id" bind:value={birdObservationId} />
						</label>
					</div>
					<label class="label">
						<span>Place label</span>
						<input class="input" type="text" aria-label="Place label" bind:value={birdPlaceLabel} />
					</label>
					<label class="label">
						<span>Precision</span>
						<select class="select" aria-label="Precision" bind:value={birdPlacePrecision}>
							<option value="LOCATION_PRECISION_HIDDEN">hidden</option>
							<option value="LOCATION_PRECISION_REGION">region</option>
							<option value="LOCATION_PRECISION_EXACT">exact</option>
						</select>
					</label>
				{/if}

				<div class="grid gap-3 sm:grid-cols-2">
					<label class="label">
						<span>Visibility</span>
						<select class="select" aria-label="Visibility" bind:value={visibility}>
							<option value="VISIBILITY_PUBLIC">public</option>
							<option value="VISIBILITY_UNLISTED">unlisted</option>
							<option value="VISIBILITY_PRIVATE">private</option>
						</select>
					</label>
					<label class="label">
						<span>Occurred at</span>
						<input class="input" type="text" aria-label="Occurred at" bind:value={occurredAt} />
					</label>
				</div>

				<label class="label">
					<span>Tags</span>
					<input class="input" type="text" aria-label="Tags" bind:value={tagsInput} />
				</label>
				<label class="label">
					<span>Idempotency key</span>
					<input class="input font-mono" type="text" aria-label="Idempotency key" bind:value={idempotencyKey} />
				</label>

				{#if readiness.length > 0}
					<ul class="text-xs text-warning-500 space-y-0.5">
						{#each readiness as msg (msg)}
							<li>- {msg}</li>
						{/each}
					</ul>
				{/if}

				{#if lastErrors.length > 0}
					<ul class="text-xs text-error-500 space-y-0.5">
						{#each lastErrors as msg (msg)}
							<li>! {msg}</li>
						{/each}
					</ul>
				{/if}

				<div class="preview-row">
					<div>
						<p class="text-xs uppercase tracking-wider text-surface-600-400">Policy preview</p>
						<p class="text-sm">
							{#if preview.ok}
								{preview.decision.allowed ? 'public projection allowed' : preview.decision.detail}
							{:else}
								{preview.errors[0] ?? 'not ready'}
							{/if}
						</p>
					</div>
					<span
						class="badge {preview.ok && preview.decision.allowed
							? 'preset-filled-success-500'
							: 'preset-filled-warning-500'}"
					>
						{preview.ok && preview.decision.allowed ? 'allowed' : 'held'}
					</span>
				</div>

				<div class="grid gap-2 sm:grid-cols-2">
					<button type="button" class="btn preset-outlined-surface-500" onclick={addPreview}>Queue locally</button>
					<button type="submit" class="btn preset-filled-primary-500">Submit to broker mock</button>
				</div>
			</form>
		</section>

		<div class="space-y-6">
			<div class="flex justify-end">
				{#if outbox.length > 0}
					<button type="button" class="btn btn-sm preset-outlined-surface-500" onclick={clearOutbox}>clear</button>
				{/if}
			</div>
			<PulseClientOutbox items={outbox} />
			<PulseActivityPubQueue {publication} />
		</div>
	</div>
</div>

<style>
	.client-shell {
		max-width: 68rem;
	}
	.client-grid {
		display: grid;
		gap: 1.5rem;
	}
	.compose-panel,
	.preview-row {
		border: 1px solid var(--color-surface-200);
		border-radius: 0.5rem;
	}
	.compose-panel {
		padding: 1rem;
	}
	.preview-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		padding: 0.75rem;
	}
	.demo-row {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		gap: 0.5rem;
	}
	@media (min-width: 900px) {
		.client-grid {
			grid-template-columns: minmax(20rem, 25rem) minmax(0, 1fr);
			align-items: start;
		}
	}
	@media (prefers-color-scheme: dark) {
		.compose-panel,
		.preview-row {
			border-color: var(--color-surface-800);
		}
	}
</style>
