import { parsePublicPulseSnapshot, type PublicPulseSnapshotAny } from './snapshot';

export const PUBLIC_SNAPSHOT_PATH = '/data/pulse/public-snapshot.v2.json';
export const TINYLAND_PULSE_PUBLIC_SNAPSHOT_URL =
	'https://hub.tinyland.dev/projections/jesssullivan-github-io/pulse/public-snapshot.v2.json';

export type PulseSnapshotFetch = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

export interface PulseSnapshotFetchOptions {
	readonly endpoint?: string;
	readonly signal?: AbortSignal;
}

function parsePulseSnapshot(data: unknown, source: string): PublicPulseSnapshotAny {
	try {
		return parsePublicPulseSnapshot(data);
	} catch (error) {
		const detail = error instanceof Error ? error.message : String(error);
		throw new Error(`pulse snapshot failed schema validation from ${source}: ${detail}`);
	}
}

export async function loadPulseSnapshot(fetchFn: PulseSnapshotFetch): Promise<PublicPulseSnapshotAny> {
	const res = await fetchFn(PUBLIC_SNAPSHOT_PATH);
	if (!res.ok) {
		throw new Error(`pulse snapshot fetch failed: ${res.status} ${res.statusText} (${PUBLIC_SNAPSHOT_PATH})`);
	}

	return parsePulseSnapshot(await res.json(), PUBLIC_SNAPSHOT_PATH);
}

export async function loadPulsePublicBrokerSnapshot(
	fetchFn: PulseSnapshotFetch,
	options: PulseSnapshotFetchOptions = {},
): Promise<PublicPulseSnapshotAny> {
	const endpoint = options.endpoint ?? TINYLAND_PULSE_PUBLIC_SNAPSHOT_URL;
	const init: RequestInit = {
		headers: { Accept: 'application/json' },
		cache: 'no-store',
	};

	if (options.signal) {
		init.signal = options.signal;
	}

	const res = await fetchFn(endpoint, init);
	if (!res.ok) {
		throw new Error(`pulse broker snapshot fetch failed: ${res.status} ${res.statusText} (${endpoint})`);
	}

	return parsePulseSnapshot(await res.json(), endpoint);
}

export function summarizePulseSnapshotError(error: unknown): string {
	if (error instanceof Error) {
		if (error.name === 'AbortError') {
			return 'broker request timed out';
		}

		return error.message;
	}

	return 'broker request failed';
}
