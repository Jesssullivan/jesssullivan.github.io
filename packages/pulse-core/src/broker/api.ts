import type { PulseEvent } from '../schema/event.js';
import { PulseEventSchema } from '../schema/event.js';
import type { LifecycleState } from '../fsm/states.js';
import type { Clock } from './clock.js';
import { systemClock } from './clock.js';
import type { IdGenerator } from './id.js';
import { seededIdGenerator } from './id.js';
import { inMemoryEventStore, type EventStore, type StoredEvent } from './event-store.js';
import { projectAcceptedEvents, type ProjectionResult, type ProjectionOptions } from './projection.js';
import {
	publishProjectionToActivityPubDemo,
	type ActivityPubDemoPublishResult,
	type ActivityPubDemoPublisherOptions,
} from '../publisher/index.js';

// IngestInput is the shape a client submits. The broker assigns id and accepts
// the event into the lifecycle if it validates and the idempotency key is new.
// `id` is omitted because the broker owns it; `revision` is optional and
// defaults to 1.
export type IngestInput = Omit<PulseEvent, 'id' | 'revision'> & { revision?: number };

export type IngestOutcome =
	| { readonly status: 'accepted'; readonly stored: StoredEvent }
	| { readonly status: 'duplicate'; readonly stored: StoredEvent }
	| { readonly status: 'invalid'; readonly errors: readonly string[] };

export interface BrokerApi {
	ingest(input: IngestInput): IngestOutcome;
	getEvent(id: string): StoredEvent | undefined;
	allEvents(): readonly StoredEvent[];
	markHidden(id: string): StoredEvent;
	deletePublic(id: string): StoredEvent;
	tombstone(id: string): StoredEvent;
	deriveSnapshot(options?: { sourceSnapshotId?: string; allowExactLocation?: boolean }): ProjectionResult;
	deriveActivityPubDemo(
		options?: { sourceSnapshotId?: string; allowExactLocation?: boolean } & ActivityPubDemoPublisherOptions,
	): ActivityPubDemoPublishResult;
}

export interface BrokerOptions {
	clock?: Clock;
	idGenerator?: IdGenerator;
	eventStore?: EventStore;
}

export const createBroker = (options: BrokerOptions = {}): BrokerApi => {
	const clock = options.clock ?? systemClock();
	const ids = options.idGenerator ?? seededIdGenerator();
	const store = options.eventStore ?? inMemoryEventStore();

	const ingest = (input: IngestInput): IngestOutcome => {
		const dup = store.getByIdempotencyKey(input.source.idempotencyKey);
		if (dup) return { status: 'duplicate', stored: dup };

		const candidate: PulseEvent = {
			...input,
			id: ids.next('evt'),
			revision: input.revision ?? 1,
		};

		const result = PulseEventSchema.safeParse(candidate);
		if (!result.success) {
			return {
				status: 'invalid',
				errors: result.error.issues.map(
					(i) => `${i.path.join('.') || '<root>'}: ${i.message}`,
				),
			};
		}

		const now = clock.nowIso();
		const acceptedState: LifecycleState = 'accepted';
		const stored: StoredEvent = {
			event: result.data,
			state: acceptedState,
			history: [{ at: now, event: 'submit', to: acceptedState }],
		};
		store.append(stored);
		return { status: 'accepted', stored };
	};

	const transition = (id: string, le: 'mark_hidden' | 'delete_public' | 'tombstone'): StoredEvent =>
		store.transition(id, le, clock.nowIso());

	const deriveSnapshot: BrokerApi['deriveSnapshot'] = (opts = {}) => {
		const projectable = store
			.all()
			.filter((s) => s.state === 'accepted' || s.state === 'enriched' || s.state === 'public_projected')
			.map((s) => s.event);
		const projOpts: ProjectionOptions = {
			generatedAt: clock.nowIso(),
			sourceSnapshotId: opts.sourceSnapshotId ?? 'in-memory-broker',
			...(opts.allowExactLocation === undefined ? {} : { allowExactLocation: opts.allowExactLocation }),
		};
		return projectAcceptedEvents(projectable, projOpts);
	};

	const deriveActivityPubDemo: BrokerApi['deriveActivityPubDemo'] = (opts = {}) => {
		const projection = deriveSnapshot(opts);
		return publishProjectionToActivityPubDemo(projection, opts);
	};

	return {
		ingest,
		getEvent: (id) => store.getById(id),
		allEvents: () => store.all(),
		markHidden: (id) => transition(id, 'mark_hidden'),
		deletePublic: (id) => transition(id, 'delete_public'),
		tombstone: (id) => transition(id, 'tombstone'),
		deriveSnapshot,
		deriveActivityPubDemo,
	};
};
