import { describe, expect, it } from 'vitest';
import { profileFallback } from './fallback';
import { loadLiveProfile, loadProfile, type ProfileFetch } from './load';

describe('validated live profile and saved fallback', () => {
	it('uses the live document only after schema validation', async () => {
		const result = await loadProfile(async () => Response.json(profileFallback));
		expect(result.source).toBe('live');
		expect(result.data.corpus_sha256).toBe(profileFallback.corpus_sha256);
	});
	it('keeps actual fallback evidence when live data is invalid', async () => {
		const urls: string[] = [];
		const get: ProfileFetch = async (input) => {
			urls.push(String(input));
			return Response.json(urls.length === 1 ? { ...profileFallback, private_data: 'not allowed' } : profileFallback);
		};
		const result = await loadProfile(get);
		expect(result.source).toBe('fallback');
		expect(urls[1]).toBe('/profile/profile.v1.json');
		expect(result.data.repos).toEqual(profileFallback.repos);
	});
	it('rejects an invalid fallback too, rather than fabricating series', async () => {
		await expect(loadProfile(async () => Response.json({ schema: 'wrong' }))).rejects.toThrow('schema validation');
	});
	it('aborts a stalled live request and then loads the fallback', async () => {
		let count = 0;
		const get: ProfileFetch = async (_input, init) => {
			if (++count === 2) return Response.json(profileFallback);
			return new Promise((_, reject) =>
				init?.signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError'))),
			);
		};
		const result = await loadProfile(get, { timeoutMs: 5 });
		expect(result.source).toBe('fallback');
		expect(result.liveError).toBe('live profile request timed out');
	});
	it('propagates an already-aborted outer signal', async () => {
		const outer = new AbortController();
		outer.abort();
		const get: ProfileFetch = async (_input, init) => {
			expect(init?.signal?.aborted).toBe(true);
			throw new DOMException('Aborted', 'AbortError');
		};
		await expect(loadLiveProfile(get, { signal: outer.signal })).rejects.toThrow('Aborted');
	});
});
