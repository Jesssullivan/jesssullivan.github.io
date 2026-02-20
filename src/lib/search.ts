import { Document } from 'flexsearch';

export interface SearchResult {
	slug: string;
	title: string;
	description: string;
	tags: string;
	category: string;
	date: string;
}

interface IndexEntry {
	[key: string]: string;
	id: string;
	title: string;
	description: string;
	tags: string;
	category: string;
	slug: string;
	date: string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let index: any = null;
let entries: IndexEntry[] = [];

export async function loadFlexSearch(): Promise<boolean> {
	if (index) return true;
	try {
		const res = await fetch('/search-index.json');
		if (!res.ok) return false;
		entries = await res.json();

		index = new Document({
			document: {
				id: 'id',
				index: ['title', 'description', 'tags', 'category'],
				store: true
			},
			tokenize: 'forward',
			resolution: 9,
			context: { depth: 2, bidirectional: true, resolution: 9 }
		});

		for (const entry of entries) {
			index.add(entry);
		}
		return true;
	} catch {
		return false;
	}
}

export function searchFlexSearch(query: string, limit = 8): SearchResult[] {
	if (!index || !query.trim()) return [];

	const results = index.search(query, { limit, enrich: true });

	const seen = new Set<string>();
	const items: SearchResult[] = [];

	for (const fieldResult of results) {
		for (const hit of (fieldResult as { result: Array<{ doc: IndexEntry }> }).result) {
			const doc = hit.doc;
			if (!doc || seen.has(doc.slug)) continue;
			seen.add(doc.slug);
			items.push({
				slug: doc.slug,
				title: doc.title,
				description: doc.description,
				tags: doc.tags,
				category: doc.category,
				date: doc.date
			});
		}
	}

	return items.slice(0, limit);
}
