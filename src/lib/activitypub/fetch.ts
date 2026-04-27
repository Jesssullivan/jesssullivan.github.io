import type { AS2OrderedCollection, ResolvedActivity } from './types';
import { resolveOutbox } from './resolve';
import { AP_CONFIG } from './config';

function isHttpsUrl(url: string): boolean {
	try {
		return new URL(url).protocol === 'https:';
	} catch {
		return false;
	}
}

export async function loadActivities(fetchFn: typeof fetch): Promise<ResolvedActivity[]> {
	const res = await fetchFn(AP_CONFIG.staticPath);
	if (!res.ok) return [];
	const collection: AS2OrderedCollection = await res.json();
	return resolveOutbox(collection);
}

export async function loadFreshActivities(): Promise<ResolvedActivity[]> {
	if (!AP_CONFIG.enableLiveFetch) return [];
	if (!isHttpsUrl(AP_CONFIG.outboxUrl)) return [];
	try {
		const res = await fetch(AP_CONFIG.outboxUrl, {
			headers: { Accept: 'application/activity+json' },
			signal: AbortSignal.timeout(5000),
		});
		if (res.ok) {
			const collection: AS2OrderedCollection = await res.json();
			return resolveOutbox(collection);
		}
	} catch {
		// fall through to empty — caller uses static fallback
	}
	return [];
}
