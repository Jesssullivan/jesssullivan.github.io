/** Public-data visual preference, never authentication or private-content authority. */
export const CONSTELLATION_STORAGE_KEY = 'tss:flags:constellation';

export interface ConstellationStorage {
	getItem(key: string): string | null;
	setItem(key: string, value: string): void;
	removeItem(key: string): void;
}

export interface ConstellationFlagInputs {
	search?: string;
	getStorage?: () => ConstellationStorage | null;
}

/**
 * Call only after browser mount; the SSR/no-input default is closed.
 * Query overrides are local visual preferences, not trusted identity signals.
 * No probe, fetch, endpoint discovery or background work happens here.
 */
export function resolveConstellationFlag({
	search = '',
	getStorage = () => null,
}: ConstellationFlagInputs = {}): boolean {
	try {
		const values = new URLSearchParams(search).getAll('flags');
		// Ambiguous input cannot opt in or revive a remembered preference.
		if (values.length > 1) return false;
		const requested = values[0];
		if (requested === 'none') {
			try {
				getStorage()?.removeItem(CONSTELLATION_STORAGE_KEY);
			} catch {
				// Explicit off wins even when this browser blocks storage.
			}
			return false;
		}
		const storage = getStorage();
		if (requested === 'constellation') {
			storage?.setItem(CONSTELLATION_STORAGE_KEY, 'on');
			return true;
		}
		return storage?.getItem(CONSTELLATION_STORAGE_KEY) === 'on';
	} catch {
		return false;
	}
}
