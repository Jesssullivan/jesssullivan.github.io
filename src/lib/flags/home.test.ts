import { describe, expect, it } from 'vitest';
import { HOME_BUILD_DEFAULT, HOME_STORAGE_KEY, resolveHomeFlag } from './home';
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

describe('home page flag (TIN-8657)', () => {
	it('is off for prerender and the first default browser load', () => {
		expect(HOME_BUILD_DEFAULT).toBe(false);
		expect(resolveHomeFlag()).toBe(false);
		expect(resolveHomeFlag({ getStorage: memoryStorage })).toBe(false);
	});

	it('opts in with ?flags=home, remembers it and clears it with ?flags=none', () => {
		const storage = memoryStorage();
		const getStorage = () => storage;
		expect(resolveHomeFlag({ search: '?flags=home', getStorage })).toBe(true);
		expect(storage.getItem(HOME_STORAGE_KEY)).toBe('on');
		expect(resolveHomeFlag({ getStorage })).toBe(true);
		expect(resolveHomeFlag({ search: '?show=photos', getStorage })).toBe(true);
		expect(resolveHomeFlag({ search: '?flags=none', getStorage })).toBe(false);
		expect(storage.getItem(HOME_STORAGE_KEY)).toBeNull();
		expect(resolveHomeFlag({ getStorage })).toBe(false);
	});

	it('is a different flag from the constellation: neither turns the other on', () => {
		const storage = memoryStorage();
		const getStorage = () => storage;
		expect(resolveHomeFlag({ search: '?flags=constellation', getStorage })).toBe(false);
		expect(resolveConstellationFlag({ search: '?flags=home', getStorage })).toBe(false);
		expect(resolveHomeFlag({ search: '?flags=home', getStorage })).toBe(true);
		expect(storage.getItem(CONSTELLATION_STORAGE_KEY)).toBeNull();
	});

	it('is off for a repeated flags parameter, even over a remembered preference', () => {
		const storage = memoryStorage();
		storage.setItem(HOME_STORAGE_KEY, 'on');
		expect(resolveHomeFlag({ search: '?flags=home&flags=none', getStorage: () => storage })).toBe(false);
		expect(resolveHomeFlag({ search: '?flags=home&flags=home', getStorage: () => storage })).toBe(false);
	});

	it('allows a page-only choice with no storage, and fails closed when storage throws', () => {
		expect(resolveHomeFlag({ search: '?flags=home' })).toBe(true);
		const getStorage = () => {
			throw new Error('blocked');
		};
		expect(resolveHomeFlag({ getStorage })).toBe(false);
		expect(resolveHomeFlag({ search: '?flags=home', getStorage })).toBe(false);
		expect(resolveHomeFlag({ search: '?flags=none', getStorage })).toBe(false);
	});

	it('follows a preview build default, which ?flags=none still turns off', () => {
		expect(resolveHomeFlag({ fallback: true })).toBe(true);
		expect(resolveHomeFlag({ fallback: true, getStorage: memoryStorage })).toBe(true);
		expect(resolveHomeFlag({ search: '?flags=none', fallback: true })).toBe(false);
		expect(resolveHomeFlag({ search: '?flags=a&flags=b', fallback: true })).toBe(false);
	});
});
