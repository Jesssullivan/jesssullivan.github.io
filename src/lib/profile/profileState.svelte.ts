import { loadProfile, type ProfileFetch, type ProfileSource } from './load';
import { toProfileView, type ProfileView } from './view';

export type ProfileStatus = 'idle' | 'loading' | 'ready' | 'failed';

/**
 * Page-level profile state. The server-rendered view (the static copy) paints
 * first; load() then tries the live host and falls back to the static copy.
 * Interactive layers switch on only when status is "ready"; when both fetches
 * fail the page keeps the server-rendered SVG and table.
 */
export class ProfileState {
	view = $state<ProfileView>() as ProfileView;
	status = $state<ProfileStatus>('idle');
	source = $state<ProfileSource | 'prerender'>('prerender');
	liveError = $state<string | undefined>(undefined);

	constructor(initial: ProfileView) {
		this.view = initial;
	}

	async load(fetchFn: ProfileFetch = fetch): Promise<void> {
		if (this.status === 'loading' || this.status === 'ready') return;
		this.status = 'loading';
		try {
			const result = await loadProfile(fetchFn);
			this.view = toProfileView(result.data);
			this.source = result.source;
			this.liveError = result.liveError;
			this.status = 'ready';
		} catch (error) {
			this.liveError = error instanceof Error ? error.message : String(error);
			this.status = 'failed';
		}
	}
}
