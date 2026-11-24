import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { CONSTELLATION_STORAGE_KEY, resolveConstellationFlag } from './constellation';

function memoryStorage() {
	const values = new Map<string, string>();
	return {
		getItem: (key: string) => values.get(key) ?? null,
		setItem: (key: string, value: string) => {
			values.set(key, value);
		},
		removeItem: (key: string) => {
			values.delete(key);
		},
	};
}

describe('public constellation visual preference', () => {
	it('is closed for SSR and the first default browser load', () => {
		expect(resolveConstellationFlag()).toBe(false);
		expect(resolveConstellationFlag({ getStorage: memoryStorage })).toBe(false);
	});
	it('opts in, remembers the preference and explicitly clears it', () => {
		const storage = memoryStorage();
		const getStorage = () => storage;
		expect(resolveConstellationFlag({ search: '?flags=constellation', getStorage })).toBe(true);
		expect(storage.getItem(CONSTELLATION_STORAGE_KEY)).toBe('on');
		expect(resolveConstellationFlag({ getStorage })).toBe(true);
		expect(resolveConstellationFlag({ search: '?flags=none', getStorage })).toBe(false);
		expect(resolveConstellationFlag({ getStorage })).toBe(false);
	});
	it('allows a page-only explicit choice when storage is unavailable', () => {
		expect(resolveConstellationFlag({ search: '?flags=constellation' })).toBe(true);
		expect(resolveConstellationFlag()).toBe(false);
	});
	it('fails closed for throwing browser storage', () => {
		const getStorage = () => {
			throw new Error('blocked');
		};
		expect(resolveConstellationFlag({ getStorage })).toBe(false);
		expect(resolveConstellationFlag({ search: '?flags=constellation', getStorage })).toBe(false);
		expect(resolveConstellationFlag({ search: '?flags=none', getStorage })).toBe(false);
	});
	it('fails closed on read and write failures; explicit off survives removal failures', () => {
		const fail = () => {
			throw new Error('blocked');
		};
		const getStorage = () => ({ getItem: fail, setItem: fail, removeItem: fail });
		expect(resolveConstellationFlag({ getStorage })).toBe(false);
		expect(resolveConstellationFlag({ search: '?flags=constellation', getStorage })).toBe(false);
		expect(resolveConstellationFlag({ search: '?flags=none', getStorage })).toBe(false);
	});
	it('does not opt in through unknown or ambiguous query flags', () => {
		expect(resolveConstellationFlag({ search: '?flags=membership' })).toBe(false);
		expect(resolveConstellationFlag({ search: '?flags=constellation&flags=none' })).toBe(false);
	});
	it('only accepts the exact stored preference', () => {
		const storage = memoryStorage();
		storage.setItem(CONSTELLATION_STORAGE_KEY, 'true');
		expect(resolveConstellationFlag({ getStorage: () => storage })).toBe(false);
	});
	it('never probes or fetches on either default or explicit opt-in', () => {
		const fetchSpy = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('unexpected network'));
		try {
			expect(resolveConstellationFlag()).toBe(false);
			expect(resolveConstellationFlag({ search: '?flags=constellation' })).toBe(true);
			expect(fetchSpy).not.toHaveBeenCalled();
		} finally {
			fetchSpy.mockRestore();
		}
	});
});

// The home page keeps the constellation's room from its first paint (TIN-8628). The script in app.html
// marks the document before SvelteKit loads, so it cannot import the resolver. It must give the same answer.
describe('first-paint mark in app.html', () => {
	const appHtml = readFileSync(new URL('../../app.html', import.meta.url), 'utf8');
	const source = appHtml.match(/\/\/ The constellation flag \(TIN-8628\)[\s\S]*?(\(function \(\) \{[\s\S]*?\}\)\(\);)\s*<\/script>/)?.[1];

	function marked(pathname: string, search: string, stored: string | null, blocked = false): boolean {
		if (!source) throw new Error('first-paint script not found in app.html');
		const attributes: string[] = [];
		const run = new Function('location', 'localStorage', 'document', source);
		run(
			{ pathname, search },
			{
				getItem: (key: string) => {
					if (blocked) throw new Error('blocked');
					return key === CONSTELLATION_STORAGE_KEY ? stored : null;
				},
			},
			{ documentElement: { setAttribute: (name: string) => attributes.push(name) } },
		);
		return attributes.includes('data-sky');
	}

	it('agrees with the resolver for every query and stored preference', () => {
		for (const search of ['', '?flags=constellation', '?flags=none', '?flags=membership', '?flags=constellation&flags=none', '?flags=constellation&flags=constellation', '?focus=a-post', '?flags=']) {
			for (const stored of [null, 'on', 'true']) {
				const storage = memoryStorage();
				if (stored) storage.setItem(CONSTELLATION_STORAGE_KEY, stored);
				expect(marked('/', search, stored), `${search} with ${stored}`).toBe(resolveConstellationFlag({ search, getStorage: () => storage }));
			}
		}
	});

	it('marks nothing without the flag, on another page, or when storage is blocked', () => {
		expect(marked('/', '', null)).toBe(false);
		expect(marked('/blog', '?flags=constellation', 'on')).toBe(false);
		expect(marked('/', '?flags=constellation', null, true)).toBe(false);
	});
});
