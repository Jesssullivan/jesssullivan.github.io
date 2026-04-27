import type { PulseEvent } from '../schema/event.js';
import type { PublicPulseItem } from '../schema/snapshot.js';

// Reasons a PulseEvent can be denied from a PublicPulseSnapshot. The string
// shape is part of the broker's lifecycle observability surface, so it is
// stable across patch releases of pulse-core.
export const POLICY_DENY_REASONS = [
	'visibility_not_public',
	'kind_not_in_m1_allowlist',
	'private_object_key_present',
	'exact_location_not_allowlisted',
	'invalid_payload',
] as const;

export type PolicyDenyReason = (typeof POLICY_DENY_REASONS)[number];

export type PolicyDecision =
	| { readonly allowed: true; readonly item: PublicPulseItem }
	| { readonly allowed: false; readonly reason: PolicyDenyReason; readonly detail: string };

export interface PolicyOptions {
	// Allows location precision LOCATION_PRECISION_EXACT through the policy.
	// M1 default is false. There is no current code path that flips this on;
	// it exists so the test suite can prove the gate is what blocks exact
	// coordinates (rather than some incidental code path).
	readonly allowExactLocation?: boolean;
}

const DEFAULT_OPTIONS: Required<PolicyOptions> = {
	allowExactLocation: false,
};

const deny = (reason: PolicyDenyReason, detail: string): PolicyDecision => ({
	allowed: false,
	reason,
	detail,
});

const truncate = (s: string, n: number): string =>
	s.length <= n ? s : `${s.slice(0, Math.max(0, n - 1)).trimEnd()}\u2026`;

export const applyPolicyToEvent = (
	event: PulseEvent,
	options: PolicyOptions = {},
): PolicyDecision => {
	const opts = { ...DEFAULT_OPTIONS, ...options };

	if (event.visibility !== 'VISIBILITY_PUBLIC') {
		return deny('visibility_not_public', `visibility=${event.visibility}`);
	}

	const payload = event.payload;
	if (payload.kind !== 'note' && payload.kind !== 'bird_sighting') {
		return deny('kind_not_in_m1_allowlist', `kind=${payload.kind}`);
	}

	for (const m of event.media) {
		if (m.privateObjectKey.length > 0) {
			return deny('private_object_key_present', `media=${m.id}`);
		}
	}

	switch (payload.kind) {
		case 'note':
			return {
				allowed: true,
				item: {
					id: event.id,
					kind: 'note',
					occurredAt: event.occurredAt,
					summary: truncate(payload.text, 140),
					content: payload.text,
					tags: [...event.tags],
				},
			};
		case 'bird_sighting': {
			const place = payload.place;
			if (
				place &&
				place.precision === 'LOCATION_PRECISION_EXACT' &&
				!opts.allowExactLocation
			) {
				return deny('exact_location_not_allowlisted', `bird=${payload.observationId}`);
			}
			const display =
				payload.commonName.trim() || payload.scientificName.trim() || 'unknown bird';
			const summary = truncate(
				payload.count > 1 ? `${payload.count}× ${display}` : display,
				140,
			);
			return {
				allowed: true,
				item: {
					id: event.id,
					kind: 'bird_sighting',
					occurredAt: event.occurredAt,
					summary,
					content: '',
					tags: [...event.tags],
					birdSighting: {
						commonName: payload.commonName,
						scientificName: payload.scientificName,
						count: payload.count,
						placeLabel: place ? place.label : '',
					},
				},
			};
		}
	}
};

