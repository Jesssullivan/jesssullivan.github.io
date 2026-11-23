import { describe, expect, it } from 'vitest';
import { FrameBudget, HOLD_MAX, HOLD_MIN, StageClock, holdFor, type ClockState } from './stageClock';
import { HERON, buildScenes } from './scenes';

/** A clock the test moves by hand: one pending timer, as the stage has. */
function fakeTime() {
	let now = 0;
	let pending: { at: number; run: () => void; id: number } | null = null;
	let ids = 0;
	return {
		deps: {
			now: () => now,
			setTimer: (run: () => void, ms: number) => {
				pending = { at: now + ms, run, id: ++ids };
				return pending.id;
			},
			clearTimer: (id: unknown) => {
				if (pending?.id === id) pending = null;
			},
		},
		advance(ms: number) {
			const end = now + ms;
			while (pending && pending.at <= end) {
				const due = pending;
				pending = null;
				now = due.at;
				due.run();
			}
			now = end;
		},
		armed: () => pending !== null,
	};
}

const HOLDS = [10_000, 16_000, 12_000];

function stage(options: { reduced?: boolean; stopped?: boolean } = {}) {
	const time = fakeTime();
	const seen: ClockState[] = [];
	const clock = new StageClock(HOLDS, time.deps, { ...options, onchange: (state) => seen.push(state) });
	return { time, clock, seen };
}

describe('scene holds', () => {
	it('holds between 9 and 18 seconds, longer with more words', () => {
		expect(holdFor(0)).toBe(HOLD_MIN);
		expect(holdFor(5)).toBe(HOLD_MIN);
		expect(holdFor(1000)).toBe(HOLD_MAX);
		expect(holdFor(40)).toBeGreaterThan(holdFor(20));
		for (const words of [0, 12, 25, 47, 90]) {
			expect(holdFor(words)).toBeGreaterThanOrEqual(9_000);
			expect(holdFor(words)).toBeLessThanOrEqual(18_000);
		}
	});

	it('gives the heron heading, which has the most words, a longer hold than the sky', () => {
		const [sky, heron] = buildScenes(null);
		expect(sky.type).toBe('sky');
		expect(heron.type).toBe('heron');
		expect(heron.hold).toBeGreaterThan(sky.hold);
		expect(HERON.definitions).toHaveLength(3);
	});
});

describe('the stage plays itself', () => {
	it('starts with no input and moves on after each hold, round to the first scene', () => {
		const { time, clock } = stage();
		clock.start();
		expect(clock.playing).toBe(true);
		expect(clock.index).toBe(0);
		time.advance(9_999);
		expect(clock.index).toBe(0);
		time.advance(1);
		expect(clock.index).toBe(1);
		time.advance(16_000);
		expect(clock.index).toBe(2);
		time.advance(12_000);
		expect(clock.index).toBe(0);
		expect(clock.playing).toBe(true);
	});

	it('reports every change to the stage', () => {
		const { time, clock, seen } = stage();
		clock.start();
		time.advance(10_000);
		expect(seen.at(-1)).toMatchObject({ index: 1, playing: true, hold: 16_000, halt: null, stopped: false });
	});

	it('does not play a stage with one scene', () => {
		const time = fakeTime();
		const clock = new StageClock([12_000], time.deps);
		clock.start();
		expect(clock.playing).toBe(false);
		expect(time.armed()).toBe(false);
	});
});

describe('a pause that holds', () => {
	it('keeps the time left and picks it up on resume', () => {
		const { time, clock } = stage();
		clock.start();
		time.advance(4_000);
		clock.pause('visitor');
		expect(clock.playing).toBe(false);
		expect(clock.remaining).toBe(6_000);
		time.advance(60_000);
		expect(clock.index).toBe(0);
		expect(clock.remaining).toBe(6_000);
		clock.resume();
		time.advance(5_999);
		expect(clock.index).toBe(0);
		time.advance(1);
		expect(clock.index).toBe(1);
	});

	it('resumes by itself after a hidden tab, with the time it had left', () => {
		const { time, clock } = stage();
		clock.start();
		time.advance(7_000);
		clock.pause('hidden');
		time.advance(30_000);
		expect(clock.index).toBe(0);
		clock.resume('hidden');
		expect(clock.playing).toBe(true);
		time.advance(3_000);
		expect(clock.index).toBe(1);
	});

	it('does not resume a pause the visitor made when the tab comes back', () => {
		const { time, clock } = stage();
		clock.start();
		clock.pause('visitor');
		clock.pause('hidden');
		expect(clock.halt).toBe('visitor');
		clock.resume('hidden');
		expect(clock.playing).toBe(false);
		time.advance(120_000);
		expect(clock.index).toBe(0);
		clock.resume();
		expect(clock.playing).toBe(true);
	});

	it('lets the visitor pause a stage that hiding had already paused', () => {
		const { clock } = stage();
		clock.start();
		clock.pause('hidden');
		clock.pause('visitor');
		clock.resume('hidden');
		expect(clock.playing).toBe(false);
		expect(clock.halt).toBe('visitor');
	});

	it('toggles between pause and play', () => {
		const { clock } = stage();
		clock.start();
		clock.toggle();
		expect(clock.playing).toBe(false);
		clock.toggle();
		expect(clock.playing).toBe(true);
	});
});

describe('input stops it', () => {
	it('stops for the visit: no hidden-tab resume starts it again', () => {
		const { time, clock } = stage();
		clock.start();
		time.advance(2_000);
		clock.stop();
		expect(clock.playing).toBe(false);
		expect(clock.stopped).toBe(true);
		clock.pause('hidden');
		clock.resume('hidden');
		time.advance(120_000);
		expect(clock.index).toBe(0);
		expect(clock.playing).toBe(false);
	});

	it('stays stopped when the stage is made again later in the visit', () => {
		const { time, clock } = stage({ stopped: true });
		clock.start();
		expect(clock.playing).toBe(false);
		time.advance(60_000);
		expect(clock.index).toBe(0);
	});

	it('plays again only when the visitor says so', () => {
		const { time, clock } = stage();
		clock.start();
		clock.stop();
		clock.resume();
		expect(clock.stopped).toBe(false);
		expect(clock.playing).toBe(true);
		time.advance(10_000);
		expect(clock.index).toBe(1);
	});

	it('still steps by the controls while stopped, and stays stopped', () => {
		const { time, clock } = stage();
		clock.start();
		clock.stop();
		clock.step(1);
		expect(clock.index).toBe(1);
		clock.step(-1);
		clock.step(-1);
		expect(clock.index).toBe(2);
		time.advance(60_000);
		expect(clock.index).toBe(2);
		expect(clock.playing).toBe(false);
	});
});

describe('stepping', () => {
	it('gives a scene the visitor stepped to its whole hold while playing', () => {
		const { time, clock } = stage();
		clock.start();
		time.advance(9_000);
		clock.step(1);
		expect(clock.index).toBe(1);
		expect(clock.playing).toBe(true);
		time.advance(15_999);
		expect(clock.index).toBe(1);
		time.advance(1);
		expect(clock.index).toBe(2);
	});

	it('goes straight to a scene, as the link back to the sky does', () => {
		const { clock } = stage();
		clock.start();
		clock.go(2);
		expect(clock.index).toBe(2);
		clock.go(0);
		expect(clock.index).toBe(0);
		clock.go(7);
		expect(clock.index).toBe(0);
	});

	it('takes a scene added later without restarting the one on show', () => {
		const { time, clock } = stage();
		clock.start();
		time.advance(4_000);
		clock.setHolds([...HOLDS, 9_000]);
		time.advance(6_000);
		expect(clock.index).toBe(1);
		time.advance(16_000 + 12_000);
		expect(clock.index).toBe(3);
	});
});

describe('reduced motion', () => {
	it('never plays: the first scene shows still and the controls step', () => {
		const { time, clock } = stage({ reduced: true });
		clock.start();
		expect(clock.playing).toBe(false);
		time.advance(120_000);
		expect(clock.index).toBe(0);
		clock.resume();
		clock.toggle();
		clock.resume('hidden');
		expect(clock.playing).toBe(false);
		clock.step(1);
		expect(clock.index).toBe(1);
		time.advance(120_000);
		expect(clock.index).toBe(1);
		expect(time.armed()).toBe(false);
	});
});

describe('the drift gives itself up on a slow device', () => {
	it('stops after ten slow frames in a row', () => {
		const budget = new FrameBudget();
		for (let i = 0; i < 9; i += 1) expect(budget.frame(130)).toBe(false);
		expect(budget.frame(130)).toBe(true);
		expect(budget.frame(16)).toBe(true);
	});

	it('forgives slow frames that a fast one interrupts', () => {
		const budget = new FrameBudget();
		for (let round = 0; round < 5; round += 1) {
			for (let i = 0; i < 9; i += 1) budget.frame(200);
			budget.frame(16);
		}
		expect(budget.gaveUp).toBe(false);
		expect(budget.frame(120)).toBe(false);
	});
});
