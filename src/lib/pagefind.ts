export interface PagefindResultData {
	url: string;
	excerpt: string;
	meta: Record<string, string>;
}

export interface PagefindResult {
	data: () => Promise<PagefindResultData>;
}

export interface Pagefind {
	init: () => Promise<void>;
	search: (q: string) => Promise<{ results: PagefindResult[] }>;
}

export interface PagefindState {
	instance: Pagefind | null;
	available: boolean;
	error: string;
}

export interface SearchItem {
	url: string;
	title: string;
	excerpt: string;
}

/**
 * Load and initialize pagefind. Returns state indicating success or failure.
 */
export async function loadPagefind(): Promise<PagefindState> {
	try {
		const pagefindPath = `${window.location.origin}/pagefind/pagefind.js`;
		const pf: Pagefind = await import(/* @vite-ignore */ pagefindPath);
		await pf.init();
		return { instance: pf, available: true, error: '' };
	} catch {
		return { instance: null, available: false, error: 'Search unavailable in dev mode' };
	}
}

/**
 * Execute a pagefind search and return mapped results.
 */
export async function executeSearch(
	pf: Pagefind,
	query: string,
	limit: number
): Promise<SearchItem[]> {
	const res = await pf.search(query);
	const items = await Promise.all(res.results.slice(0, limit).map((r) => r.data()));
	return items.map((item) => ({
		url: item.url,
		title: item.meta?.title || 'Untitled',
		excerpt: item.excerpt
	}));
}

/**
 * Debounce utility returning call and cancel functions.
 */
export function debounce(fn: () => void, ms: number): { call: () => void; cancel: () => void } {
	let timer: ReturnType<typeof setTimeout> | undefined;
	return {
		call: () => {
			clearTimeout(timer);
			timer = setTimeout(fn, ms);
		},
		cancel: () => clearTimeout(timer)
	};
}
