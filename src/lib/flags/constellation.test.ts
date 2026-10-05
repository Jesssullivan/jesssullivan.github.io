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
