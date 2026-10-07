/**
 * Tailnet hint (row TS18, ruling RM11): a hint-tier "you are on the tailnet"
 * affordance driven by a tsidp-flags Surface v1 manifest. Never authentication,
 * never private-content authority: the probe runs in the visitor's browser, so
 * it can only reveal decoration, never content.
 *
 * Default off. With no build-time manifest URL (VITE_TAILNET_HINT_MANIFEST_URL)
 * nothing probes, fetches or renders. The parser is vendored from
 * Jesssullivan/tsidp-flags packages/flags (TS16 3ef4fa8) until the tsidp_flags
 * Bazel module is in xoxd-ai/bazel-registry.
 */

export const TAILNET_HINT_FLAG = 'member';
export const TAILNET_HINT_TIMEOUT_MS = 4000;

const SOURCE_KINDS = new Set([
	'override',
	'serve-header',
	'tsidp-oidc',
	'cf-access',
	'tailnet-probe',
	'cf-session-probe',
]);

export interface TailnetSurface {
	version: 1;
	flags: Record<string, boolean>;
	status: 'pending' | 'settled' | 'failed';
}

/**
 * The configured manifest URL, or null (the flag is off). Only an absolute
 * https URL with no credentials, query or fragment turns the hint on.
 */
export function resolveTailnetHintManifest(raw: string | undefined | null): string | null {
	if (typeof raw !== 'string' || raw.trim() === '') return null;
	try {
		const url = new URL(raw.trim());
		if (url.protocol !== 'https:') return null;
		if (url.username || url.password || url.search || url.hash) return null;
		return url.href;
	} catch {
		return null;
	}
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Parse untrusted JSON into the Surface v1 fields this hint reads, or null. */
export function parseTailnetSurface(value: unknown): TailnetSurface | null {
	if (!isRecord(value) || value.version !== 1) return null;
	const status = value.status;
	if (status !== 'pending' && status !== 'settled' && status !== 'failed') return null;
	if (!isRecord(value.flags) || !Array.isArray(value.basis)) return null;
	const flags: Record<string, boolean> = {};
	for (const [key, flagValue] of Object.entries(value.flags)) {
		if (typeof flagValue !== 'boolean') return null;
		flags[key] = flagValue;
	}
	for (const entry of value.basis) {
		if (!isRecord(entry) || typeof entry.flag !== 'string') return null;
		if (typeof entry.source !== 'string' || !SOURCE_KINDS.has(entry.source)) return null;
		if (entry.trust !== 'verified' && entry.trust !== 'hint') return null;
	}
	return { version: 1, flags, status };
}

export interface TailnetHintProbeOptions {
	fetch?: typeof globalThis.fetch;
	timeoutMs?: number;
	signal?: AbortSignal;
}

/**
 * One credential-free, uncached GET. Resolves true only when a settled
 * manifest's own flag is exactly true; every failure resolves false.
 */
export async function probeTailnetHint(
	manifestUrl: string,
	flag: string = TAILNET_HINT_FLAG,
	{ fetch: fetchImpl = globalThis.fetch, timeoutMs = TAILNET_HINT_TIMEOUT_MS, signal }: TailnetHintProbeOptions = {},
): Promise<boolean> {
	if (typeof fetchImpl !== 'function') return false;
	const controller = new AbortController();
	const timer = setTimeout(() => controller.abort(), timeoutMs);
	const onAbort = () => controller.abort();
	signal?.addEventListener('abort', onAbort, { once: true });
	try {
		const res = await fetchImpl(manifestUrl, {
			method: 'GET',
			credentials: 'omit',
			cache: 'no-store',
			redirect: 'error',
			signal: controller.signal,
		});
		if (!res.ok) return false;
		const surface = parseTailnetSurface(await res.json());
		return (
			surface !== null &&
			surface.status === 'settled' &&
			Object.hasOwn(surface.flags, flag) &&
			surface.flags[flag] === true
		);
	} catch {
		return false;
	} finally {
		clearTimeout(timer);
		signal?.removeEventListener('abort', onAbort);
	}
}
