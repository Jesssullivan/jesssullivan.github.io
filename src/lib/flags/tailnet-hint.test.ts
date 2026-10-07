import { describe, expect, it, vi } from 'vitest';
import { parseTailnetSurface, probeTailnetHint, resolveTailnetHintManifest } from './tailnet-hint';

const MANIFEST = 'https://probe.example.ts.net/v1/surface';
const surface = {
	version: 1,
	flags: { member: true },
	basis: [{ flag: 'member', source: 'tailnet-probe', trust: 'hint' }],
	status: 'settled',
};
const json = (body: unknown, status = 200) =>
	new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

describe('resolveTailnetHintManifest', () => {
	it('is off by default', () => {
		expect(resolveTailnetHintManifest(undefined)).toBeNull();
		expect(resolveTailnetHintManifest(null)).toBeNull();
		expect(resolveTailnetHintManifest('')).toBeNull();
		expect(resolveTailnetHintManifest('   ')).toBeNull();
	});

	it('turns on only for a plain https URL', () => {
		expect(resolveTailnetHintManifest(MANIFEST)).toBe(MANIFEST);
		for (const bad of [
			'http://probe.example.ts.net/v1/surface',
			'https://user:pw@probe.example.ts.net/v1/surface',
			'https://probe.example.ts.net/v1/surface?x=1',
			'https://probe.example.ts.net/v1/surface#a',
			'/v1/surface',
			'javascript:alert(1)',
		]) {
			expect(resolveTailnetHintManifest(bad), bad).toBeNull();
		}
	});
});

describe('parseTailnetSurface', () => {
	it('accepts Surface v1', () => {
		expect(parseTailnetSurface(surface)).toEqual({ version: 1, flags: { member: true }, status: 'settled' });
	});

	it.each([
		['null', null],
		['another version', { ...surface, version: 2 }],
		['a bad status', { ...surface, status: 'open' }],
		['a non-boolean flag', { ...surface, flags: { member: 1 } }],
		['no basis', { version: 1, flags: {}, status: 'settled' }],
		['an unknown source', { ...surface, basis: [{ flag: 'member', source: 'cookie', trust: 'hint' }] }],
		['the proposed items shape', { items: [] }],
	])('rejects %s', (_label, value) => {
		expect(parseTailnetSurface(value)).toBeNull();
	});
});

describe('probeTailnetHint', () => {
	it('grants on a settled true flag with a credential-free uncached GET', async () => {
		const fetch = vi.fn(async () => json(surface));
		expect(await probeTailnetHint(MANIFEST, 'member', { fetch })).toBe(true);
		const [, init] = fetch.mock.calls[0] as unknown as [string, RequestInit];
		expect(init).toMatchObject({ method: 'GET', credentials: 'omit', cache: 'no-store', redirect: 'error' });
	});

	it('fails closed', async () => {
		const cases: Array<() => Promise<Response>> = [
			async () => json({ ...surface, flags: { member: false } }),
			async () => json({ ...surface, status: 'pending' }),
			async () => json(surface, 403),
			async () => new Response('<html>', { status: 200 }),
			async () => {
				throw new TypeError('Failed to fetch');
			},
		];
		for (const fetch of cases) {
			expect(await probeTailnetHint(MANIFEST, 'member', { fetch })).toBe(false);
		}
		expect(await probeTailnetHint(MANIFEST, 'other', { fetch: async () => json(surface) })).toBe(false);
	});

	it('fails closed on timeout', async () => {
		const hang = (_url: RequestInfo | URL, init?: RequestInit) =>
			new Promise<Response>((_resolve, reject) => {
				init?.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')));
			});
		expect(await probeTailnetHint(MANIFEST, 'member', { fetch: hang, timeoutMs: 5 })).toBe(false);
	});
});
