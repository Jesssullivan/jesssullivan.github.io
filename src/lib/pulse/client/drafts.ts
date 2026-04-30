import { applyPolicyToEvent, type PolicyDecision } from '@blog/pulse-core/policy';
import type { IngestInput } from '@blog/pulse-core/broker';
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
	| 'broker_accepted'
	| 'broker_duplicate'
	| 'broker_invalid';

export interface PulseClientOutboxItem {
	readonly id: string;
	readonly draftId: string;
	readonly state: PulseClientOutboxState;
	readonly idempotencyKey: string;
	readonly label: string;
	readonly detail: string;
	readonly eventId?: string;
	readonly decision?: PolicyDecision;
}

export interface PulseClientDraftDefaults {
	readonly nowIso: string;
	readonly sequence: number;
	readonly kind?: PulseClientDraftKind;
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
