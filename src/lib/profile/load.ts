import { parseProfileV1, type ProfileV1 } from './schema';

/** Hourly dataset served by spear-profile-web behind honey-ingress (R77, R78). */
export const PROFILE_LIVE_URL = 'https://jess.clients.xoxd.ai/v1/profile.v1.json';
/**
 * Build-time copy of the law-filtered projection, copied from spear_resumes
 * profile/out-v2 (see static/profile/v2/provenance.json). Never sample data.
 */
export const PROFILE_FALLBACK_PATH = '/profile/v2/profile.v1.json';
export const PROFILE_LIVE_TIMEOUT_MS = 4_000;

export type ProfileFetch = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

export type ProfileSource = 'live' | 'fallback';

export interface ProfileLoadResult {
	readonly data: ProfileV1;
	readonly source: ProfileSource;
	/** Why the live endpoint was not used (undefined when it was). */
	readonly liveError?: string;
}

export interface ProfileLoadOptions {
	readonly liveUrl?: string;
	readonly fallbackPath?: string;
	readonly timeoutMs?: number;
	readonly signal?: AbortSignal;
}

function parse(data: unknown, source: string): ProfileV1 {
	try {
		return parseProfileV1(data);
	} catch (error) {
		const detail = error instanceof Error ? error.message : String(error);
		throw new Error(`profile.v1 failed schema validation from ${source}: ${detail}`);
	}
}

export function summarizeProfileError(error: unknown): string {
	if (error instanceof Error) {
		if (error.name === 'AbortError' || error.name === 'TimeoutError') return 'live profile request timed out';
		return error.message;
	}
	return 'live profile request failed';
}

/** Fetches the live dataset with `cache: 'no-store'` and a hard timeout. */
export async function loadLiveProfile(fetchFn: ProfileFetch, options: ProfileLoadOptions = {}): Promise<ProfileV1> {
	const url = options.liveUrl ?? PROFILE_LIVE_URL;
	const controller = new AbortController();
	const timer = setTimeout(() => controller.abort(), options.timeoutMs ?? PROFILE_LIVE_TIMEOUT_MS);
	const onOuterAbort = () => controller.abort();
	options.signal?.addEventListener('abort', onOuterAbort, { once: true });
	if (options.signal?.aborted) controller.abort();
	try {
		const res = await fetchFn(url, {
			headers: { Accept: 'application/json' },
			cache: 'no-store',
			mode: 'cors',
			credentials: 'omit',
			signal: controller.signal,
		});
		if (!res.ok) throw new Error(`live profile fetch failed: ${res.status} ${res.statusText} (${url})`);
		return parse(await res.json(), url);
	} finally {
		clearTimeout(timer);
		options.signal?.removeEventListener('abort', onOuterAbort);
	}
}

/** Fetches the static build-time copy. */
export async function loadFallbackProfile(fetchFn: ProfileFetch, options: ProfileLoadOptions = {}): Promise<ProfileV1> {
	const path = options.fallbackPath ?? PROFILE_FALLBACK_PATH;
	const init: RequestInit = { headers: { Accept: 'application/json' } };
	if (options.signal) init.signal = options.signal;
	const res = await fetchFn(path, init);
	if (!res.ok) throw new Error(`fallback profile fetch failed: ${res.status} ${res.statusText} (${path})`);
	return parse(await res.json(), path);
}

/**
 * Live first (4 s abort), then the static copy. Throws only when both fail,
 * in which case callers keep the server-rendered chart (SVG + table).
 */
export async function loadProfile(fetchFn: ProfileFetch, options: ProfileLoadOptions = {}): Promise<ProfileLoadResult> {
	let liveError: string | undefined;
	try {
		const data = await loadLiveProfile(fetchFn, options);
		return { data, source: 'live' };
	} catch (error) {
		liveError = summarizeProfileError(error);
	}
	const data = await loadFallbackProfile(fetchFn, options);
	return { data, source: 'fallback', liveError };
}
