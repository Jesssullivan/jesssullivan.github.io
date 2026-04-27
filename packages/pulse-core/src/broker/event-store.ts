import type { PulseEvent } from '../schema/event.js';
import type { LifecycleState } from '../fsm/states.js';
import type { LifecycleEvent } from '../fsm/transitions.js';
import { nextState } from '../fsm/transitions.js';

export interface LifecycleHistoryEntry {
	readonly at: string;
	readonly event: LifecycleEvent;
	readonly to: LifecycleState;
}

export interface StoredEvent {
	readonly event: PulseEvent;
	readonly state: LifecycleState;
	readonly history: readonly LifecycleHistoryEntry[];
}

export interface EventStore {
	getById(id: string): StoredEvent | undefined;
	getByIdempotencyKey(key: string): StoredEvent | undefined;
	append(stored: StoredEvent): void;
	transition(id: string, lifecycleEvent: LifecycleEvent, atIso: string): StoredEvent;
	all(): readonly StoredEvent[];
}

export const inMemoryEventStore = (): EventStore => {
	const byId = new Map<string, StoredEvent>();
	const byIdempotencyKey = new Map<string, StoredEvent>();
	const insertionOrder: string[] = [];

	return {
		getById: (id) => byId.get(id),
		getByIdempotencyKey: (key) => byIdempotencyKey.get(key),
		append: (stored) => {
			if (byId.has(stored.event.id)) {
				throw new Error(`event id already exists: ${stored.event.id}`);
			}
			const key = stored.event.source.idempotencyKey;
			if (byIdempotencyKey.has(key)) {
				throw new Error(`idempotency key already exists: ${key}`);
			}
			byId.set(stored.event.id, stored);
			byIdempotencyKey.set(key, stored);
			insertionOrder.push(stored.event.id);
		},
		transition: (id, lifecycleEvent, atIso) => {
			const current = byId.get(id);
			if (!current) {
				throw new Error(`unknown event: ${id}`);
			}
			const to = nextState(current.state, lifecycleEvent);
			const updated: StoredEvent = {
				event: current.event,
				state: to,
				history: [...current.history, { at: atIso, event: lifecycleEvent, to }],
			};
			byId.set(id, updated);
			byIdempotencyKey.set(current.event.source.idempotencyKey, updated);
			return updated;
		},
		all: () => insertionOrder.map((id) => byId.get(id)!),
	};
};
