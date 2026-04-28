// Pure form-to-event composer used by /pulse/lab. Kept separate from the
// Svelte component so the lifecycle is unit-testable without a DOM.

import {
	PulseEventSchema,
	type PulseEvent,
	type Visibility,
	type LocationPrecision,
	type PayloadKind,
} from '@blog/pulse-core/schema';

export type LabFormKind = Extract<PayloadKind, 'note' | 'bird_sighting'>;

export interface LabNoteForm {
	readonly kind: 'note';
	readonly text: string;
}

export interface LabBirdForm {
	readonly kind: 'bird_sighting';
	readonly commonName: string;
	readonly scientificName: string;
	readonly count: number;
	readonly placeLabel: string;
	readonly placePrecision: LocationPrecision;
	readonly latitude: number | null;
	readonly longitude: number | null;
	readonly observationId: string;
}

export type LabPayloadForm = LabNoteForm | LabBirdForm;

export interface LabComposeForm {
	readonly payload: LabPayloadForm;
	readonly visibility: Visibility;
	readonly occurredAt: string;
	readonly tags: readonly string[];
	readonly idempotencyKey: string;
}

export interface LabComposeContext {
	readonly idGenerator: { next(prefix: string): string };
}

export type LabComposeResult =
	| { readonly ok: true; readonly event: PulseEvent }
	| { readonly ok: false; readonly errors: readonly string[] };

const buildPayload = (form: LabPayloadForm): PulseEvent['payload'] | { error: string } => {
	if (form.kind === 'note') {
		if (form.text.trim().length === 0) {
			return { error: 'note text must not be empty' };
		}
		return { kind: 'note', text: form.text };
	}
	// Build place whenever the user provides a label. Lat/long default to 0
	// when missing — they aren't load-bearing for the policy decision (the
	// policy only reads `precision`), and the schema accepts 0 as valid for
	// both. This matches the lab UX: the user can pick a label + precision
	// without entering coordinates and still see the policy gate fire.
	const place =
		form.placeLabel.trim().length === 0
			? undefined
			: {
					label: form.placeLabel,
					latitude: form.latitude ?? 0,
					longitude: form.longitude ?? 0,
					precision: form.placePrecision,
				};
	const payload: PulseEvent['payload'] = {
		kind: 'bird_sighting',
		commonName: form.commonName,
		scientificName: form.scientificName,
		count: form.count,
		observationId: form.observationId,
		...(place ? { place } : {}),
	};
	return payload;
};

export const composeEvent = (form: LabComposeForm, ctx: LabComposeContext): LabComposeResult => {
	if (form.visibility === 'VISIBILITY_UNSPECIFIED') {
		return { ok: false, errors: ['visibility must be explicit'] };
	}
	const payloadOrError = buildPayload(form.payload);
	if ('error' in payloadOrError) {
		return { ok: false, errors: [payloadOrError.error] };
	}
	const candidate: PulseEvent = {
		id: ctx.idGenerator.next('lab'),
		actor: 'jess',
		occurredAt: form.occurredAt,
		visibility: form.visibility,
		source: {
			client: 'pulse-lab',
			deviceId: 'browser',
			idempotencyKey: form.idempotencyKey,
		},
		tags: [...form.tags],
		media: [],
		revision: 1,
		payload: payloadOrError,
	};
	const result = PulseEventSchema.safeParse(candidate);
	if (!result.success) {
		return {
			ok: false,
			errors: result.error.issues.map((i) => `${i.path.join('.') || '<root>'}: ${i.message}`),
		};
	}
	return { ok: true, event: result.data };
};

// Form readiness summary used by the UI to decide whether to enable submit.
export const summarizeReadiness = (form: LabComposeForm): readonly string[] => {
	const errors: string[] = [];
	if (form.visibility === 'VISIBILITY_UNSPECIFIED') {
		errors.push('choose a visibility');
	}
	if (form.payload.kind === 'note') {
		if (form.payload.text.trim().length === 0) errors.push('write something');
	} else {
		if (form.payload.commonName.trim().length === 0 && form.payload.scientificName.trim().length === 0) {
			errors.push('add a common or scientific name');
		}
		if (form.payload.count < 1) errors.push('count must be at least 1');
		if (form.payload.observationId.trim().length === 0) errors.push('add an observation id');
	}
	if (form.idempotencyKey.trim().length === 0) errors.push('idempotencyKey missing');
	return errors;
};
