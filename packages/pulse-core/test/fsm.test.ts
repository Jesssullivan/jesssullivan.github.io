import { describe, it, expect } from 'vitest';
import {
	LIFECYCLE_STATES,
	LIFECYCLE_EVENTS,
	TRANSITIONS,
	nextState,
	canTransition,
	IllegalTransitionError,
	reachableStates,
	legalEventsFrom,
	isTerminalState,
	type LifecycleState,
	type LifecycleEvent,
} from '../src/fsm/index.js';

describe('fsm/transitions', () => {
	it('every transition references a known state and event', () => {
		const states = new Set<LifecycleState>(LIFECYCLE_STATES);
		const events = new Set<LifecycleEvent>(LIFECYCLE_EVENTS);
		for (const t of TRANSITIONS) {
			expect(states.has(t.from)).toBe(true);
			expect(states.has(t.to)).toBe(true);
			expect(events.has(t.event)).toBe(true);
		}
	});

	it('the table is deterministic: no (from, event) appears twice', () => {
		const seen = new Set<string>();
		for (const t of TRANSITIONS) {
			const key = `${t.from}::${t.event}`;
			expect(seen.has(key)).toBe(false);
			seen.add(key);
		}
	});

	it('all declared states are reachable from draft', () => {
		const reached = reachableStates();
		for (const s of LIFECYCLE_STATES) {
			expect(reached.has(s)).toBe(true);
		}
	});

	it('terminal states have no outgoing transitions', () => {
		for (const s of LIFECYCLE_STATES) {
			if (isTerminalState(s)) {
				expect(legalEventsFrom(s)).toEqual([]);
			}
		}
	});

	it('exhaustive (state, event) cross-product matches the table', () => {
		const tableKey = (from: LifecycleState, ev: LifecycleEvent) => `${from}::${ev}`;
		const inTable = new Set(TRANSITIONS.map((t) => tableKey(t.from, t.event)));
		for (const from of LIFECYCLE_STATES) {
			for (const ev of LIFECYCLE_EVENTS) {
				const expected = inTable.has(tableKey(from, ev));
				expect(canTransition(from, ev)).toBe(expected);
			}
		}
	});

	it('nextState throws IllegalTransitionError on illegal pairs', () => {
		expect(() => nextState('tombstoned', 'submit')).toThrow(IllegalTransitionError);
		expect(() => nextState('failed', 'project_public')).toThrow(IllegalTransitionError);
		expect(() => nextState('public_projected', 'submit')).toThrow(IllegalTransitionError);
	});

	it('the happy path draft -> public_projected is reachable in 4 steps', () => {
		let s: LifecycleState = 'draft';
		s = nextState(s, 'submit');
		expect(s).toBe('accepted');
		s = nextState(s, 'queue');
		expect(s).toBe('queued');
		s = nextState(s, 'enrich');
		expect(s).toBe('enriched');
		s = nextState(s, 'project_public');
		expect(s).toBe('public_projected');
	});

	it('public_projected can be deleted then tombstoned', () => {
		let s: LifecycleState = 'public_projected';
		s = nextState(s, 'delete_public');
		expect(s).toBe('deleted');
		s = nextState(s, 'tombstone');
		expect(s).toBe('tombstoned');
	});
});
