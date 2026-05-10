import { PulseApStreamDemoSchema, type PulseApStreamDemo } from '@blog/pulse-core/schema';

export const TINYLAND_PULSE_AP_STREAM_DEMO_URL =
	'https://tinyland.dev/projections/jesssullivan-github-io/pulse/ap-stream-demo.v1.json';

export type PulseApStreamFetch = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

export interface PulseApStreamFetchOptions {
	readonly endpoint?: string;
	readonly signal?: AbortSignal;
}

export type PulseApStreamDemoPanelState =
	| { readonly status: 'loading'; readonly endpoint: string }
	| { readonly status: 'ready'; readonly endpoint: string; readonly demo: PulseApStreamDemo }
	| { readonly status: 'unavailable'; readonly endpoint: string; readonly reason: string };

export async function loadPulseApStreamDemo(
	fetchFn: PulseApStreamFetch,
	options: PulseApStreamFetchOptions = {},
): Promise<PulseApStreamDemo> {
	const endpoint = options.endpoint ?? TINYLAND_PULSE_AP_STREAM_DEMO_URL;
	const init: RequestInit = {
		headers: { Accept: 'application/json' },
		cache: 'no-store',
	};

	if (options.signal) {
		init.signal = options.signal;
	}

	const res = await fetchFn(endpoint, init);

	if (!res.ok) {
		throw new Error(`pulse AP stream demo fetch failed: ${res.status} ${res.statusText} (${endpoint})`);
	}

	const data: unknown = await res.json();
	const result = PulseApStreamDemoSchema.safeParse(data);

	if (!result.success) {
		throw new Error(`pulse AP stream demo failed schema validation: ${result.error.issues.map((i) => i.message).join('; ')}`);
	}

	return result.data;
}

export function summarizePulseApStreamError(error: unknown): string {
	if (error instanceof Error) {
		if (error.name === 'AbortError') {
			return 'broker request timed out';
		}

		return error.message;
	}

	return 'broker request failed';
}
