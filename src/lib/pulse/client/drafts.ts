import { applyPolicyToEvent, type PolicyDecision } from '@blog/pulse-core/policy';
import type { BrokerApi, IngestInput, IngestOutcome } from '@blog/pulse-core/broker';
import type { ActivityPubDemoPublisherOptions, ActivityPubDemoPublishResult } from '@blog/pulse-core/publisher';
import { PulseEventSchema, type LocationPrecision, type PulseEvent, type Visibility } from '@blog/pulse-core/schema';

export type PulseClientDraftKind = 'note' | 'bird_sighting';

interface PulseClientDraftBase {
	readonly id: string;
	readonly visibility: Visibility;
	readonly occurredAt: string;
	readonly tagsInput: string;
	readonly idempotencyKey: string;
}

export interface PulseClientNoteDraft extends PulseClientDraftBase {
	readonly kind: 'note';
	readonly text: string;
}

export interface PulseClientBirdDraft extends PulseClientDraftBase {
	readonly kind: 'bird_sighting';
	readonly commonName: string;
	readonly scientificName: string;
	readonly count: number;
	readonly placeLabel: string;
	readonly placePrecision: LocationPrecision;
	readonly observationId: string;
}

export type PulseClientDraft = PulseClientNoteDraft | PulseClientBirdDraft;

export type PulseClientDraftResult =
	| {
			readonly ok: true;
			readonly input: IngestInput;
			readonly previewEvent: PulseEvent;
			readonly decision: PolicyDecision;
	  }
	| { readonly ok: false; readonly errors: readonly string[] };

export type PulseClientOutboxState =
	| 'draft_ready'
	| 'draft_blocked'
	| 'local_queued'
	| 'retry_pending'
	| 'broker_accepted'
	| 'broker_duplicate'
	| 'broker_invalid'
	| 'ap_published'
	| 'ap_blocked';

export interface PulseClientOutboxItem {
	readonly id: string;
	readonly draftId: string;
	readonly state: PulseClientOutboxState;
	readonly idempotencyKey: string;
	readonly label: string;
	readonly detail: string;
	readonly eventId?: string;
	readonly activityId?: string;
	readonly decision?: PolicyDecision;
}

export interface PulseClientDraftDefaults {
	readonly nowIso: string;
	readonly sequence: number;
	readonly kind?: PulseClientDraftKind;
}

export interface PulseClientPublicationOptions extends ActivityPubDemoPublisherOptions {
	readonly sourceSnapshotId: string;
}

export interface PulseClientSubmitResult {
	readonly outboxItem: PulseClientOutboxItem;
	readonly publication: ActivityPubDemoPublishResult;
	readonly errors: readonly string[];
}

export const createPulseClientDraft = ({
	nowIso,
	sequence,
	kind = 'note',
}: PulseClientDraftDefaults): PulseClientDraft => {
	const base = {
		id: `draft_${sequence}`,
		visibility: 'VISIBILITY_PUBLIC' as const,
		occurredAt: nowIso,
		tagsInput: kind === 'note' ? 'client, pulse' : 'client, birds',
		idempotencyKey: `pulse-client-${sequence}`,
	};

	if (kind === 'note') {
		return {
			...base,
			kind,
			text: '',
		};
	}

	return {
		...base,
		kind,
		commonName: '',
		scientificName: '',
		count: 1,
		placeLabel: '',
		placePrecision: 'LOCATION_PRECISION_REGION',
		observationId: `client-obs-${sequence}`,
	};
};

export const parseClientTags = (input: string): readonly string[] =>
	input
		.split(',')
		.map((tag) => tag.trim())
		.filter((tag) => tag.length > 0);

export const summarizeClientDraftReadiness = (draft: PulseClientDraft): readonly string[] => {
	const errors: string[] = [];
	if (draft.visibility === 'VISIBILITY_UNSPECIFIED') errors.push('choose a visibility');
	if (draft.idempotencyKey.trim().length === 0) errors.push('idempotency key missing');

	if (draft.kind === 'note') {
		if (draft.text.trim().length === 0) errors.push('write a note');
	} else {
		if (draft.commonName.trim().length === 0 && draft.scientificName.trim().length === 0) {
			errors.push('add a common or scientific name');
		}
		if (draft.count < 1) errors.push('count must be at least 1');
		if (draft.observationId.trim().length === 0) errors.push('add an observation id');
	}

	return errors;
};

const buildPayload = (draft: PulseClientDraft): IngestInput['payload'] | { readonly error: string } => {
	if (draft.kind === 'note') {
		if (draft.text.trim().length === 0) return { error: 'note text must not be empty' };
		return { kind: 'note', text: draft.text };
	}

	if (draft.commonName.trim().length === 0 && draft.scientificName.trim().length === 0) {
		return { error: 'bird sighting must have at least one of commonName or scientificName' };
	}

	const place =
		draft.placeLabel.trim().length === 0
			? undefined
			: {
					label: draft.placeLabel,
					// TODO: replace scaffold coordinates with explicit client lat/lng input before real broker writes.
					latitude: 0,
					longitude: 0,
					precision: draft.placePrecision,
				};

	return {
		kind: 'bird_sighting',
		commonName: draft.commonName,
		scientificName: draft.scientificName,
		count: draft.count,
		observationId: draft.observationId,
		...(place ? { place } : {}),
	};
};

export const evaluatePulseClientDraft = (draft: PulseClientDraft): PulseClientDraftResult => {
	if (draft.visibility === 'VISIBILITY_UNSPECIFIED') {
		return { ok: false, errors: ['visibility must be explicit'] };
	}

	const payload = buildPayload(draft);
	if ('error' in payload) return { ok: false, errors: [payload.error] };

	const input: IngestInput = {
		actor: 'jess',
		occurredAt: draft.occurredAt,
		visibility: draft.visibility,
		source: {
			client: 'pulse-client-scaffold',
			deviceId: 'browser-local',
			idempotencyKey: draft.idempotencyKey,
		},
		tags: [...parseClientTags(draft.tagsInput)],
		media: [],
		payload,
	};

	const preview = PulseEventSchema.safeParse({
		...input,
		id: `preview_${draft.id}`,
		revision: 1,
	});

	if (!preview.success) {
		return {
			ok: false,
			errors: preview.error.issues.map((issue) => `${issue.path.join('.') || '<root>'}: ${issue.message}`),
		};
	}

	return {
		ok: true,
		input,
		previewEvent: preview.data,
		decision: applyPolicyToEvent(preview.data),
	};
};

export const draftPreviewToOutboxItem = (
	draft: PulseClientDraft,
	result: PulseClientDraftResult,
): PulseClientOutboxItem => {
	if (!result.ok) {
		return {
			id: `${draft.id}_invalid`,
			draftId: draft.id,
			state: 'broker_invalid',
			idempotencyKey: draft.idempotencyKey,
			label: draft.kind === 'note' ? 'Note draft' : 'Bird sighting draft',
			detail: result.errors.join('; '),
		};
	}

	return {
		id: `${draft.id}_preview`,
		draftId: draft.id,
		state: result.decision.allowed ? 'draft_ready' : 'draft_blocked',
		idempotencyKey: draft.idempotencyKey,
		label: result.previewEvent.payload.kind === 'note' ? 'Note draft' : 'Bird sighting draft',
		detail: result.decision.allowed ? 'policy preview allows public projection' : result.decision.detail,
		eventId: result.previewEvent.id,
		decision: result.decision,
	};
};

export const queuePulseClientOutboxItem = (item: PulseClientOutboxItem): PulseClientOutboxItem => {
	if (item.state !== 'draft_ready') return item;
	return {
		...item,
		id: `${item.id}_queued`,
		state: 'local_queued',
		detail: 'queued locally; policy preview allows public projection',
	};
};

export const queuePulseClientOutboxItemForRetry = (item: PulseClientOutboxItem): PulseClientOutboxItem => ({
	...item,
	id: `${item.id}_retry`,
	state: 'retry_pending',
	detail: `retry queued from ${item.state}: ${item.detail}`,
});

const draftLabel = (draft: PulseClientDraft): string => (draft.kind === 'note' ? 'Note draft' : 'Bird sighting draft');

export const brokerOutcomeToOutboxItem = (
	draft: PulseClientDraft,
	result: Exclude<PulseClientDraftResult, { ok: false }>,
	outcome: IngestOutcome,
	publication: ActivityPubDemoPublishResult,
): PulseClientOutboxItem => {
	if (outcome.status === 'invalid') {
		return {
			id: `${draft.id}_broker_invalid`,
			draftId: draft.id,
			state: 'broker_invalid',
			idempotencyKey: draft.idempotencyKey,
			label: draftLabel(draft),
			detail: outcome.errors.join('; '),
		};
	}

	const eventId = outcome.stored.event.id;
	const queueItem = publication.queue.find((item) => item.sourceEventId === eventId);
	const duplicatePrefix =
		outcome.status === 'duplicate' ? 'duplicate idempotency key; existing event' : 'broker accepted';

	if (queueItem?.state === 'published') {
		return {
			id: `${draft.id}_${outcome.status}_${eventId}_ap_published`,
			draftId: draft.id,
			state: outcome.status === 'duplicate' ? 'broker_duplicate' : 'ap_published',
			idempotencyKey: draft.idempotencyKey,
			label: outcome.stored.event.payload.kind === 'note' ? 'Note draft' : 'Bird sighting draft',
			detail:
				outcome.status === 'duplicate'
					? `${duplicatePrefix}; AP demo Create activity already exists`
					: `${duplicatePrefix}; AP demo Create activity published`,
			eventId,
			activityId: queueItem.activity.id,
			decision: result.decision,
		};
	}

	if (queueItem?.state === 'blocked') {
		return {
			id: `${draft.id}_${outcome.status}_${eventId}_ap_blocked`,
			draftId: draft.id,
			state: outcome.status === 'duplicate' ? 'broker_duplicate' : 'ap_blocked',
			idempotencyKey: draft.idempotencyKey,
			label: outcome.stored.event.payload.kind === 'note' ? 'Note draft' : 'Bird sighting draft',
			detail:
				outcome.status === 'duplicate'
					? `${duplicatePrefix}; AP demo remains blocked: ${queueItem.detail}`
					: `${duplicatePrefix}; AP demo blocked: ${queueItem.detail}`,
			eventId,
			decision: result.decision,
		};
	}

	return {
		id: `${draft.id}_${outcome.status}_${eventId}`,
		draftId: draft.id,
		state: outcome.status === 'accepted' ? 'broker_accepted' : 'broker_duplicate',
		idempotencyKey: draft.idempotencyKey,
		label: outcome.stored.event.payload.kind === 'note' ? 'Note draft' : 'Bird sighting draft',
		detail: result.decision.allowed
			? `${duplicatePrefix}; public projection ready`
			: `${duplicatePrefix}; projection blocked: ${result.decision.detail}`,
		eventId,
		decision: result.decision,
	};
};

export const submitPulseClientDraftToBroker = (
	broker: BrokerApi,
	draft: PulseClientDraft,
	options: PulseClientPublicationOptions,
): PulseClientSubmitResult => {
	const result = evaluatePulseClientDraft(draft);
	if (!result.ok) {
		return {
			outboxItem: draftPreviewToOutboxItem(draft, result),
			publication: broker.deriveActivityPubDemo(options),
			errors: result.errors,
		};
	}

	const outcome = broker.ingest(result.input);
	const publication = broker.deriveActivityPubDemo(options);
	return {
		outboxItem: brokerOutcomeToOutboxItem(draft, result, outcome, publication),
		publication,
		errors: outcome.status === 'invalid' ? outcome.errors : [],
	};
};
