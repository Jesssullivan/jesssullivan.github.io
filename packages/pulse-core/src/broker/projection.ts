import {
	PUBLIC_SNAPSHOT_SCHEMA_VERSION,
	PUBLIC_SNAPSHOT_POLICY_VERSION,
	type PublicPulseSnapshot,
	type PublicPulseItem,
} from '../schema/snapshot.js';
import type { PulseEvent } from '../schema/event.js';
import { applyPolicyToEvent, type PolicyDecision, type PolicyOptions } from '../policy/index.js';
import { sha256Digest } from './sha256.js';

export interface ProjectionDenial {
	readonly eventId: string;
	readonly reason: Exclude<PolicyDecision, { allowed: true }>['reason'];
	readonly detail: string;
}

export interface ProjectionResult {
	readonly snapshot: PublicPulseSnapshot;
	readonly denied: readonly ProjectionDenial[];
}

export interface ProjectionOptions extends PolicyOptions {
	readonly generatedAt: string;
	readonly sourceSnapshotId: string;
	readonly policyVersion?: string;
}

// Canonical JSON serialization for hashing. Keys are sorted at every level so
// the contentHash is stable across implementations and across insertion order
// in the event store.
const canonicalJson = (value: unknown): string => {
	if (value === null || typeof value !== 'object') return JSON.stringify(value);
	if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
	const obj = value as Record<string, unknown>;
	const keys = Object.keys(obj).sort();
	return `{${keys.map((k) => `${JSON.stringify(k)}:${canonicalJson(obj[k])}`).join(',')}}`;
};

export const projectAcceptedEvents = (events: readonly PulseEvent[], options: ProjectionOptions): ProjectionResult => {
	const items: PublicPulseItem[] = [];
	const denied: ProjectionDenial[] = [];

	for (const event of events) {
		const decision = applyPolicyToEvent(event, options);
		if (decision.allowed) {
			items.push(decision.item);
		} else {
			denied.push({
				eventId: event.id,
				reason: decision.reason,
				detail: decision.detail,
			});
		}
	}

	// Stable, deterministic ordering: occurredAt descending, then id ascending.
	items.sort((a, b) => {
		if (a.occurredAt !== b.occurredAt) {
			return a.occurredAt < b.occurredAt ? 1 : -1;
		}
		return a.id < b.id ? -1 : 1;
	});

	const policyVersion = options.policyVersion ?? PUBLIC_SNAPSHOT_POLICY_VERSION;
	const contentHash = sha256Digest(canonicalJson(items));

	const snapshot: PublicPulseSnapshot = {
		schemaVersion: PUBLIC_SNAPSHOT_SCHEMA_VERSION,
		generatedAt: options.generatedAt,
		items,
		manifest: {
			schemaVersion: PUBLIC_SNAPSHOT_SCHEMA_VERSION,
			generatedAt: options.generatedAt,
			sourceSnapshotId: options.sourceSnapshotId,
			contentHash,
			itemCount: items.length,
			policyVersion,
		},
	};

	return { snapshot, denied };
};
