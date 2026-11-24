import type { Component } from 'svelte';
import type { StreamFile } from '$lib/home/stream';
import type { ReaderCollection } from '$lib/reader/collection';
import { HOME_BUILD_DEFAULT } from './home';

/**
 * The home flag as the layout and the home page share it (TIN-8657).
 * It starts at the build default, which is off in production, and the layout
 * sets it after mount from the address and the remembered preference.
 *
 * `ready` is true once the new home page's code and its stream are here to show.
 * A production build paints the ordinary page first. That page stays whole until
 * then, and the two change places in one step, with nothing half shown between.
 */
export const homeFlag = $state({ on: HOME_BUILD_DEFAULT, ready: HOME_BUILD_DEFAULT });

export type HomeView = Component<{ stream: StreamFile | null; archive: ReaderCollection['archive']; arrives?: boolean }>;
export interface HomeLoaded {
	Home: HomeView;
	stream: StreamFile;
}

// Kept outside the page, because the layout moves the page to another column when the two change places.
let loaded: HomeLoaded | null = null;
let asked = false;

export const homeLoaded = (): HomeLoaded | null => loaded;

/** Ask once for the home page's code and stream. A failure leaves the ordinary page in place. */
export function askHome(load: () => Promise<HomeLoaded>): void {
	if (asked) return;
	asked = true;
	void load()
		.then((view) => {
			loaded = view;
			homeFlag.ready = true;
		})
		.catch(() => {});
}
