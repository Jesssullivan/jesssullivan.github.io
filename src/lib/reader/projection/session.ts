/**
 * What the constellation remembers for one browser session (TIN-8628): the
 * view, the selected post, the filter, the Map or List choice and whether the
 * sky has assembled once. Back from a post returns to the same spot. Nothing
 * here leaves the browser, and a blocked store only means nothing is kept.
 */
const KEY = 'tss:constellation';

export interface ConstellationSession {
	/** [zoom, centre x, centre y] as fractions of the panel. */
	view?: [number, number, number];
	slug?: string | null;
	category?: string | null;
	list?: boolean;
	seen?: boolean;
}

export function readSession(): ConstellationSession {
	try {
		const value: unknown = JSON.parse(sessionStorage.getItem(KEY) ?? '{}');
		return value && typeof value === 'object' ? (value as ConstellationSession) : {};
	} catch {
		return {};
	}
}

export function writeSession(patch: ConstellationSession): void {
	try {
		sessionStorage.setItem(KEY, JSON.stringify({ ...readSession(), ...patch }));
	} catch {
		// Private mode or a full store: the map still works, it just starts fresh.
	}
}
