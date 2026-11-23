/**
 * Timing for the heading stage (TIN-8657, ruling RM47). The stage plays itself:
 * each scene holds long enough to read, then the next one comes. This file holds
 * the rules and no DOM, so every one of them is tested with a fake clock.
 *
 * - A pause the visitor made holds until the visitor resumes.
 * - A pause a hidden tab or an off-screen stage caused resumes by itself.
 * - Input on the stage stops the play for the visit.
 * - With reduced motion the stage never plays. The scenes step by the controls.
 */

export const HOLD_MIN = 9_000;
export const HOLD_MAX = 18_000;

/** How long a scene holds: longer with more words, between 9 and 18 seconds. */
export function holdFor(words: number): number {
	return Math.round(Math.min(HOLD_MAX, Math.max(HOLD_MIN, 7_000 + words * 200)));
}

export type Halt = 'visitor' | 'hidden';

export interface ClockDeps {
	now: () => number;
	setTimer: (run: () => void, ms: number) => unknown;
	clearTimer: (id: unknown) => void;
}

export interface ClockState {
	index: number;
	playing: boolean;
	/** Who paused it, when it is paused. */
	halt: Halt | null;
	/** True once input on the stage stopped the play for the visit. */
	stopped: boolean;
	/** The hold of the scene on show, in milliseconds. */
	hold: number;
}

export interface ClockOptions {
	/** The visitor asked for reduced motion. */
	reduced?: boolean;
	/** The play was stopped earlier in this visit. */
	stopped?: boolean;
	onchange?: (state: ClockState) => void;
}

export class StageClock {
	index = 0;
	halt: Halt | null = null;
	stopped: boolean;
	readonly reduced: boolean;
	#holds: number[];
	#deps: ClockDeps;
	#onchange: (state: ClockState) => void;
	#timer: unknown = null;
	#dueAt = 0;
	#remaining = 0;
	#started = false;

	constructor(holds: readonly number[], deps: ClockDeps, options: ClockOptions = {}) {
		this.#holds = [...holds];
		this.#deps = deps;
		this.reduced = options.reduced ?? false;
		this.stopped = options.stopped ?? false;
		this.#onchange = options.onchange ?? (() => {});
		this.#remaining = this.#holds[0] ?? 0;
	}

	get playing(): boolean {
		return this.#timer !== null;
	}

	get state(): ClockState {
		return { index: this.index, playing: this.playing, halt: this.halt, stopped: this.stopped, hold: this.#holds[this.index] ?? 0 };
	}

	/** Milliseconds left on the scene on show. */
	get remaining(): number {
		return this.playing ? Math.max(0, this.#dueAt - this.#deps.now()) : this.#remaining;
	}

	/** Begin. With reduced motion, with one scene, or after a stop earlier in the visit, the first scene just shows. */
	start() {
		this.#started = true;
		if (this.stopped) this.halt = 'visitor';
		if (this.#canPlay()) this.#arm(this.#holds[this.index]);
		this.#emit();
	}

	/** A scene was added or its hold changed. The scene on show keeps its own time. */
	setHolds(holds: readonly number[]) {
		this.#holds = [...holds];
		if (this.index >= this.#holds.length) this.index = 0;
		if (this.#started && !this.playing && this.#canPlay()) this.#arm(this.#remaining || this.#holds[this.index]);
		this.#emit();
	}

	pause(by: Halt) {
		// A visitor's pause is never weakened into one that resumes by itself.
		if (this.halt === 'visitor' && by === 'hidden') return;
		if (this.playing) this.#remaining = this.remaining;
		this.#disarm();
		this.halt = by;
		this.#emit();
	}

	/**
	 * Resume. `resume('hidden')` is the tab or the stage coming back into view:
	 * it lifts only a pause that hiding caused. `resume()` is the visitor's own act
	 * and also lifts a stop.
	 */
	resume(by: Halt = 'visitor') {
		if (this.halt === null || this.playing) return;
		if (by === 'hidden' && this.halt !== 'hidden') return;
		this.halt = null;
		if (by === 'visitor') this.stopped = false;
		if (this.#canPlay()) this.#arm(this.#remaining || this.#holds[this.index]);
		this.#emit();
	}

	toggle() {
		if (this.playing) this.pause('visitor');
		else this.resume();
	}

	/** Input on the stage: the play stops for the visit. Only the visitor starts it again. */
	stop() {
		if (this.stopped && this.halt === 'visitor') return;
		this.stopped = true;
		this.pause('visitor');
	}

	/** Step to another scene. A playing stage gives the new scene its whole hold. A paused one stays paused. */
	step(delta: number) {
		const count = this.#holds.length;
		if (count < 2) return;
		this.go((((this.index + delta) % count) + count) % count);
	}

	go(index: number) {
		if (index < 0 || index >= this.#holds.length || index === this.index) return;
		const wasPlaying = this.playing;
		this.#disarm();
		this.index = index;
		this.#remaining = this.#holds[index];
		if (wasPlaying) this.#arm(this.#remaining);
		this.#emit();
	}

	destroy() {
		this.#disarm();
		this.#started = false;
	}

	#canPlay(): boolean {
		return this.#started && !this.reduced && this.halt === null && this.#holds.length > 1;
	}

	#arm(ms: number) {
		this.#disarm();
		this.#dueAt = this.#deps.now() + ms;
		this.#timer = this.#deps.setTimer(() => {
			this.#timer = null;
			this.index = (this.index + 1) % this.#holds.length;
			this.#remaining = this.#holds[this.index];
			this.#arm(this.#remaining);
			this.#emit();
		}, ms);
	}

	#disarm() {
		if (this.#timer !== null) this.#deps.clearTimer(this.#timer);
		this.#timer = null;
	}

	#emit() {
		this.#onchange(this.state);
	}
}

/**
 * The frame budget for the slow drift on photographs. A device that cannot
 * keep up shows it as a run of slow frames: after ten in a row the drift
 * gives itself up and the photograph stays still.
 */
export class FrameBudget {
	#slow = 0;
	gaveUp = false;
	constructor(
		readonly limit = 10,
		readonly slowMs = 120,
	) {}

	/** Feed the time between two frames. Returns true once the drift should stop. */
	frame(ms: number): boolean {
		if (this.gaveUp) return true;
		this.#slow = ms > this.slowMs ? this.#slow + 1 : 0;
		if (this.#slow >= this.limit) this.gaveUp = true;
		return this.gaveUp;
	}
}
