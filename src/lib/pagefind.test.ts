import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { debounce, executeSearch, type Pagefind } from './pagefind';

describe('debounce', () => {
	beforeEach(() => {
		vi.useFakeTimers();
	});
	afterEach(() => {
		vi.useRealTimers();
	});

	it('delays function execution', () => {
		const fn = vi.fn();
		const d = debounce(fn, 200);
		d.call();
		expect(fn).not.toHaveBeenCalled();
		vi.advanceTimersByTime(200);
		expect(fn).toHaveBeenCalledOnce();
	});

	it('cancels pending calls on cancel()', () => {
		const fn = vi.fn();
		const d = debounce(fn, 200);
		d.call();
		d.cancel();
		vi.advanceTimersByTime(200);
		expect(fn).not.toHaveBeenCalled();
	});

	it('only fires last call within window', () => {
		const fn = vi.fn();
		const d = debounce(fn, 200);
		d.call();
		d.call();
		d.call();
		vi.advanceTimersByTime(200);
		expect(fn).toHaveBeenCalledOnce();
	});
});

describe('executeSearch', () => {
	function makeMockPagefind(items: Array<{ url: string; excerpt: string; title?: string }>): Pagefind {
		return {
			init: vi.fn(),
			search: vi.fn().mockResolvedValue({
				results: items.map((item) => ({
					data: () =>
						Promise.resolve({
							url: item.url,
							excerpt: item.excerpt,
							meta: item.title ? { title: item.title } : {}
						})
				}))
			})
		};
	}

	it('maps pagefind results to SearchItem[]', async () => {
		const pf = makeMockPagefind([
			{ url: '/blog/test', excerpt: 'A <mark>test</mark> excerpt', title: 'Test Post' }
		]);
		const results = await executeSearch(pf, 'test', 10);
		expect(results).toEqual([
			{ url: '/blog/test', title: 'Test Post', excerpt: 'A <mark>test</mark> excerpt' }
		]);
	});

	it('limits results to specified count', async () => {
		const pf = makeMockPagefind([
			{ url: '/a', excerpt: '', title: 'A' },
			{ url: '/b', excerpt: '', title: 'B' },
			{ url: '/c', excerpt: '', title: 'C' }
		]);
		const results = await executeSearch(pf, 'q', 2);
		expect(results).toHaveLength(2);
	});

	it('defaults title to Untitled when meta.title is missing', async () => {
		const pf = makeMockPagefind([{ url: '/x', excerpt: '' }]);
		const results = await executeSearch(pf, 'q', 10);
		expect(results[0].title).toBe('Untitled');
	});

	it('returns empty array for no results', async () => {
		const pf = makeMockPagefind([]);
		const results = await executeSearch(pf, 'q', 10);
		expect(results).toEqual([]);
	});
});
