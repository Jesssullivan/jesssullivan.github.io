import { PublicPulseSnapshotSchema, type PublicPulseSnapshot } from '@blog/pulse-core/schema';

export const PUBLIC_SNAPSHOT_PATH = '/data/pulse/public-snapshot.v1.json';
export const TINYLAND_PULSE_PUBLIC_SNAPSHOT_URL =
	'https://hub.tinyland.dev/projections/jesssullivan-github-io/pulse/public-snapshot.v1.json';

export type PulseSnapshotFetch = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

export interface PulseSnapshotFetchOptions {
	readonly endpoint?: string;
	readonly signal?: AbortSignal;
}

function parsePulseSnapshot(data: unknown, source: string): PublicPulseSnapshot {
	const result = PublicPulseSnapshotSchema.safeParse(data);
	if (!result.success) {
		throw new Error(`pulse snapshot failed schema validation from ${source}: ${result.error.issues.map((i) => i.message).join('; ')}`);
	}

	return result.data;
}

export async function loadPulseSnapshot(fetchFn: PulseSnapshotFetch): Promise<PublicPulseSnapshot> {
	const res = await fetchFn(PUBLIC_SNAPSHOT_PATH);
	if (!res.ok) {
		throw new Error(`pulse snapshot fetch failed: ${res.status} ${res.statusText} (${PUBLIC_SNAPSHOT_PATH})`);
	}

	return parsePulseSnapshot(await res.json(), PUBLIC_SNAPSHOT_PATH);
}

export async function loadPulsePublicBrokerSnapshot(
	fetchFn: PulseSnapshotFetch,
	options: PulseSnapshotFetchOptions = {},
): Promise<PublicPulseSnapshot> {
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
