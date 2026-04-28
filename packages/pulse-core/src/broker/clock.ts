// A pluggable clock keeps the broker's projection output deterministic in
// tests. The system clock is the only impure implementation.

export interface Clock {
	nowIso(): string;
}

export const systemClock = (): Clock => ({
	nowIso: () => new Date().toISOString(),
});

export const fixedClock = (iso: string): Clock => ({
	nowIso: () => iso,
});

// Useful for tests where each `nowIso()` should advance by a known step.
export const tickingClock = (startIso: string, stepMs: number): Clock => {
	let t = Date.parse(startIso);
	if (Number.isNaN(t)) {
		throw new Error(`tickingClock: invalid ISO start: ${startIso}`);
	}
	return {
		nowIso: () => {
			const out = new Date(t).toISOString();
			t += stepMs;
			return out;
		},
	};
};
