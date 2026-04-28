// Pulse lifecycle states. The order of declaration is informational only;
// transitions are governed by the explicit table in `transitions.ts`.

export const LIFECYCLE_STATES = [
	'draft',
	'accepted',
	'queued',
	'enriched',
	'public_projected',
	'hidden',
	'updated',
	'deleted',
	'tombstoned',
	'failed',
] as const;

export type LifecycleState = (typeof LIFECYCLE_STATES)[number];

export const isTerminalState = (s: LifecycleState): boolean =>
	s === 'tombstoned' || s === 'failed';
