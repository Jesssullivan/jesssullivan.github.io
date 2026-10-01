import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import {
	loadProfile,
	PROFILE_FALLBACK_PATH,
	PROFILE_LIVE_TIMEOUT_MS,
	PROFILE_LIVE_URL,
	summarizeProfileError,
	type ProfileFetch,
} from './load';

// The real law-filtered projection copied from spear_resumes profile/out-v2.
const STATIC_COPY = JSON.parse(
	readFileSync(new URL('../../../static/profile/v2/profile.v1.json', import.meta.url), 'utf8'),
) as Record<string, unknown>;

function json(body: unknown, status = 200): Response {
	return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

function liveCopy(): Record<string, unknown> {
	return structuredClone(STATIC_COPY);
}

describe('loadProfile', () => {
	it('uses the live host with no-store caching when it answers with a valid projection', async () => {
		const calls: [string, RequestInit | undefined][] = [];
		const fetchFn: ProfileFetch = async (input, init) => {
			calls.push([String(input), init]);
			return json(liveCopy());
		};
		const result = await loadProfile(fetchFn);
		expect(result.source).toBe('live');
		expect(result.liveError).toBeUndefined();
		expect(calls).toHaveLength(1);
		expect(calls[0][0]).toBe(PROFILE_LIVE_URL);
		expect(calls[0][1]?.cache).toBe('no-store');
		expect(calls[0][1]?.credentials).toBe('omit');
		expect(calls[0][1]?.signal).toBeInstanceOf(AbortSignal);
	});

	it('falls back to the static copy when the live host errors', async () => {
		const fetchFn: ProfileFetch = async (input) =>
			String(input) === PROFILE_LIVE_URL ? json({ error: 'nope' }, 503) : json(STATIC_COPY);
		const result = await loadProfile(fetchFn);
		expect(result.source).toBe('fallback');
		expect(result.liveError).toMatch(/503/);
		expect(result.data.repos.length).toBeGreaterThan(0);
	});

	it('falls back when the live host is unreachable (blocked by network or CSP)', async () => {
		const fetchFn: ProfileFetch = async (input) => {
			if (String(input) === PROFILE_LIVE_URL) throw new TypeError('Failed to fetch');
			return json(STATIC_COPY);
		};
		const result = await loadProfile(fetchFn);
		expect(result.source).toBe('fallback');
		expect(result.liveError).toBe('Failed to fetch');
	});

	it('aborts a hung live request after the timeout, then falls back', async () => {
		vi.useFakeTimers();
		try {
			const fetchFn: ProfileFetch = (input, init) => {
				if (String(input) !== PROFILE_LIVE_URL) return Promise.resolve(json(STATIC_COPY));
				return new Promise((_, reject) => {
					init?.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')));
				});
			};
			const pending = loadProfile(fetchFn);
			await vi.advanceTimersByTimeAsync(PROFILE_LIVE_TIMEOUT_MS - 1);
			let settled = false;
			void pending.then(() => (settled = true));
			await Promise.resolve();
			expect(settled).toBe(false);
			await vi.advanceTimersByTimeAsync(2);
			const result = await pending;
			expect(PROFILE_LIVE_TIMEOUT_MS).toBe(4_000);
			expect(result.source).toBe('fallback');
			expect(result.liveError).toBe('live profile request timed out');
		} finally {
			vi.useRealTimers();
		}
	});

	it('rejects a live payload that fails the contract (never renders unknown fields)', async () => {
		const bad = liveCopy();
		(bad.repos as Record<string, unknown>[])[0].stars = 74;
		const seen: string[] = [];
		const fetchFn: ProfileFetch = async (input) => {
			seen.push(String(input));
			return json(String(input) === PROFILE_LIVE_URL ? bad : STATIC_COPY);
		};
		const result = await loadProfile(fetchFn);
		expect(result.source).toBe('fallback');
		expect(result.liveError).toMatch(/schema validation/);
		expect(seen).toEqual([PROFILE_LIVE_URL, PROFILE_FALLBACK_PATH]);
	});

	it('throws when both the live host and the static copy fail', async () => {
		const fetchFn: ProfileFetch = async () => {
			throw new TypeError('Failed to fetch');
		};
		await expect(loadProfile(fetchFn)).rejects.toThrow('Failed to fetch');
	});

	it('summarizes timeouts and unknown errors', () => {
		expect(summarizeProfileError(new DOMException('x', 'AbortError'))).toBe('live profile request timed out');
		expect(summarizeProfileError('weird')).toBe('live profile request failed');
	});
});
