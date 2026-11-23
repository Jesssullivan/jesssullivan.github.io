/**
 * The home page flag (TIN-8657): the heading stage and the one mixed stream.
 * A public visual preference, never authentication or private-content authority.
 * It follows src/lib/flags/constellation.ts: `?flags=home` turns it on and
 * remembers it, `?flags=none` turns it off and forgets it, and a repeated
 * `flags` parameter is off. The stage shows the constellation as its first
 * scene, so this flag needs no second one.
 */
export const HOME_STORAGE_KEY = 'tss:flags:home';

/**
 * True only in a build made with BLOG_HOME_STAGE=on, which prerenders the new
 * home page for a preview address. Production builds leave it false.
 */
export const HOME_BUILD_DEFAULT: boolean = typeof __BLOG_HOME_STAGE__ === 'boolean' ? __BLOG_HOME_STAGE__ : false;

export interface HomeFlagStorage {
	getItem(key: string): string | null;
	setItem(key: string, value: string): void;
	removeItem(key: string): void;
}

export interface HomeFlagInputs {
	search?: string;
	getStorage?: () => HomeFlagStorage | null;
	/** What the build chose. Off unless the build was made for a preview. */
	fallback?: boolean;
}

/**
 * Call only after browser mount. Before that the answer is the build default.
 * No probe, fetch or background work happens here.
 */
export function resolveHomeFlag({ search = '', getStorage = () => null, fallback = false }: HomeFlagInputs = {}): boolean {
	try {
		const values = new URLSearchParams(search).getAll('flags');
		// Ambiguous input cannot opt in or revive a remembered preference.
		if (values.length > 1) return false;
		const requested = values[0];
		if (requested === 'none') {
			try {
				getStorage()?.removeItem(HOME_STORAGE_KEY);
			} catch {
				// Explicit off wins even when this browser blocks storage.
			}
			return false;
		}
		const storage = getStorage();
		if (requested === 'home') {
			storage?.setItem(HOME_STORAGE_KEY, 'on');
			return true;
		}
		return storage?.getItem(HOME_STORAGE_KEY) === 'on' || fallback;
	} catch {
		return false;
	}
}
