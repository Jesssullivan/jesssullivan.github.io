import { LIFECYCLE_STATES, type LifecycleState } from './states.js';

// Lifecycle events drive transitions. Names mirror what the broker emits.
export const LIFECYCLE_EVENTS = [
	'submit', // draft -> accepted
	'queue', // accepted -> queued
	'enrich', // queued -> enriched
	'project_public', // enriched|accepted -> public_projected
	'mark_hidden', // accepted|enriched -> hidden
	'supersede', // accepted|enriched|public_projected|hidden -> updated
	'delete_public', // public_projected -> deleted
	'tombstone', // deleted -> tombstoned
	'fail', // any non-terminal -> failed
] as const;

export type LifecycleEvent = (typeof LIFECYCLE_EVENTS)[number];

export interface Transition {
	readonly from: LifecycleState;
	readonly event: LifecycleEvent;
	readonly to: LifecycleState;
}

// Explicit transition table. Adding a row here is the only legal way to
// extend the state machine. Rejecting unknown transitions is what makes the
// projection-time invariants tractable.
export const TRANSITIONS: readonly Transition[] = [
	{ from: 'draft', event: 'submit', to: 'accepted' },
	{ from: 'accepted', event: 'queue', to: 'queued' },
	{ from: 'queued', event: 'enrich', to: 'enriched' },
	{ from: 'enriched', event: 'project_public', to: 'public_projected' },
	{ from: 'accepted', event: 'project_public', to: 'public_projected' },
	{ from: 'accepted', event: 'mark_hidden', to: 'hidden' },
	{ from: 'enriched', event: 'mark_hidden', to: 'hidden' },
	{ from: 'accepted', event: 'supersede', to: 'updated' },
	{ from: 'enriched', event: 'supersede', to: 'updated' },
	{ from: 'public_projected', event: 'supersede', to: 'updated' },
	{ from: 'hidden', event: 'supersede', to: 'updated' },
	{ from: 'public_projected', event: 'delete_public', to: 'deleted' },
	{ from: 'deleted', event: 'tombstone', to: 'tombstoned' },
	{ from: 'draft', event: 'fail', to: 'failed' },
	{ from: 'accepted', event: 'fail', to: 'failed' },
	{ from: 'queued', event: 'fail', to: 'failed' },
	{ from: 'enriched', event: 'fail', to: 'failed' },
	{ from: 'public_projected', event: 'fail', to: 'failed' },
	{ from: 'hidden', event: 'fail', to: 'failed' },
	{ from: 'updated', event: 'fail', to: 'failed' },
	{ from: 'deleted', event: 'fail', to: 'failed' },
];

// Indexed view: from -> event -> to. Built once and reused.
const TRANSITION_INDEX: ReadonlyMap<LifecycleState, ReadonlyMap<LifecycleEvent, LifecycleState>> =
	(() => {
		const outer = new Map<LifecycleState, Map<LifecycleEvent, LifecycleState>>();
		for (const t of TRANSITIONS) {
			const inner = outer.get(t.from) ?? new Map<LifecycleEvent, LifecycleState>();
			if (inner.has(t.event)) {
				throw new Error(
					`duplicate transition from ${t.from} on ${t.event}; the table must be deterministic`,
				);
			}
			inner.set(t.event, t.to);
			outer.set(t.from, inner);
		}
		return outer;
	})();

export class IllegalTransitionError extends Error {
	readonly from: LifecycleState;
	readonly event: LifecycleEvent;
	constructor(from: LifecycleState, event: LifecycleEvent) {
		super(`illegal transition: ${from} --${event}-->`);
		this.name = 'IllegalTransitionError';
		this.from = from;
		this.event = event;
	}
}

export const nextState = (
	from: LifecycleState,
	event: LifecycleEvent,
): LifecycleState => {
	const to = TRANSITION_INDEX.get(from)?.get(event);
	if (to === undefined) {
		throw new IllegalTransitionError(from, event);
	}
	return to;
};

export const canTransition = (from: LifecycleState, event: LifecycleEvent): boolean =>
	TRANSITION_INDEX.get(from)?.has(event) ?? false;

// Useful for tests and tooling: which events are legal from a given state?
export const legalEventsFrom = (from: LifecycleState): readonly LifecycleEvent[] => {
	const inner = TRANSITION_INDEX.get(from);
	return inner ? Array.from(inner.keys()) : [];
};

// All states are reachable in M1. We assert this in tests so a future edit
// that accidentally orphans a state fails CI.
export const reachableStates = (): ReadonlySet<LifecycleState> => {
	const reached = new Set<LifecycleState>(['draft']);
	let changed = true;
	while (changed) {
		changed = false;
		for (const t of TRANSITIONS) {
			if (reached.has(t.from) && !reached.has(t.to)) {
				reached.add(t.to);
				changed = true;
			}
		}
	}
	return reached;
};

// Sanity check that the LIFECYCLE_STATES tuple stays in sync with the table.
export const ALL_STATES_KNOWN: ReadonlySet<LifecycleState> = new Set(LIFECYCLE_STATES);
