import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { HomeLoaded } from './home-state.svelte';

// The module keeps what it loaded for the whole visit, so each test takes a fresh copy of it.
async function fresh() {
	vi.resetModules();
	return import('./home-state.svelte');
}

// The first read of the module compiles it, which a busy machine can take seconds over.
// It is paid here once, so no test's own time limit has to cover it.
beforeAll(async () => {
	await fresh();
}, 120_000);

const view = { Home: (() => {}) as unknown as HomeLoaded['Home'], stream: { version: 1, items: [], heading: [] } as unknown as HomeLoaded['stream'] };
const settle = async () => {
	for (let i = 0; i < 4; i += 1) await Promise.resolve();
};

describe('the home page changes places in one step (TIN-8657)', () => {
	beforeEach(() => vi.resetModules());

	it('is not ready in a production build until its code and stream have both arrived', async () => {
		const { askHome, homeFlag, homeLoaded } = await fresh();
		expect(homeFlag.on).toBe(false);
		expect(homeFlag.ready).toBe(false);
		// Nothing has read the flag in a browser yet.
		expect(homeFlag.known).toBe(false);
		expect(homeLoaded()).toBeNull();
		let release: (loaded: HomeLoaded) => void = () => {};
		askHome(() => new Promise<HomeLoaded>((resolve) => (release = resolve)));
		await settle();
		expect(homeFlag.ready).toBe(false);
		expect(homeLoaded()).toBeNull();
		release(view);
		await settle();
		expect(homeFlag.ready).toBe(true);
		expect(homeLoaded()).toBe(view);
	});

	it('asks once, however often the page asks', async () => {
		const { askHome } = await fresh();
		const load = vi.fn(() => Promise.resolve(view));
		askHome(load);
		askHome(load);
		await settle();
		askHome(load);
		expect(load).toHaveBeenCalledTimes(1);
	});

	it('leaves the ordinary page in place when the load fails', async () => {
		const { askHome, homeFlag, homeLoaded } = await fresh();
		askHome(() => Promise.reject(new Error('offline')));
		await settle();
		expect(homeFlag.ready).toBe(false);
		expect(homeFlag.failed).toBe(true);
		expect(homeLoaded()).toBeNull();
	});

	it('hands the layout one object to put in its context, so the home page imports no file for the flag', async () => {
		const { HOME_CONTEXT, askHome, homeContext, homeFlag, homeLoaded } = await fresh();
		// The page reads the key as this same text.
		expect(HOME_CONTEXT).toBe('tss:home');
		expect(homeContext).toEqual({ flag: homeFlag, ask: askHome, loaded: homeLoaded });
		expect(homeContext.flag).toBe(homeFlag);
	});
});
