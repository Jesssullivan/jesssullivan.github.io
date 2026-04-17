import type { Post, PostCategory } from './types';
import { POST_CATEGORIES } from './types';
import searchIndexData from '../../static/search-index.json';

export type { Post, PostFrontmatter, PostCategory } from './types';
export { POST_CATEGORIES } from './types';

export interface SearchIndexEntry {
	title: string;
	description: string;
	tags?: string;
	tag_list?: string[];
	category?: string;
	slug: string;
	date: string;
	source_file?: string;
	body_excerpt?: string;
	published?: boolean;
	reading_time?: number;
	feature_image?: string;
	thumbnail_image?: string;
	featured?: boolean;
	author_slug?: string;
	original_url?: string;
	excerpt?: string;
}

const searchIndex = searchIndexData as SearchIndexEntry[];

/**
 * Strip markdown/HTML to approximate plain text.
 */
function stripMarkdown(raw: string): string {
	let text = raw.replace(/^---[\s\S]*?---/, '');
	text = text.replace(/```[\s\S]*?```/g, '');
	text = text.replace(/`[^`]*`/g, '');
	text = text.replace(/<[^>]+>/g, '');
	text = text.replace(/!\[[^\]]*\]\([^)]*\)/g, '');
	text = text.replace(/\[([^\]]*)\]\([^)]*\)/g, '$1');
	text = text.replace(/[#*_~>|\\-]/g, '');
	return text.replace(/\s+/g, ' ').trim();
}

/**
 * Strip markdown/HTML to approximate plain text and count words.
 * Returns estimated reading time in minutes (min 1).
 */
export function computeReadingTime(raw: string): number {
	const text = stripMarkdown(raw);
	if (!text) return 1;
	const words = text.split(/\s+/).filter((w) => w.length > 0).length;
	return Math.max(1, Math.round(words / 230));
}

export function searchIndexEntriesToPosts(entries: SearchIndexEntry[]): Post[] {
	const posts: Post[] = entries
		.filter((entry) => entry.published !== false)
		.map((entry) => {
			const rawCategory = entry.category;
			const tags = Array.isArray(entry.tag_list)
				? entry.tag_list
				: (entry.tags?.split(/\s+/).filter(Boolean) ?? []);

			// Validate category against allowed values if present
			const category: PostCategory | undefined =
				rawCategory && POST_CATEGORIES.includes(rawCategory as PostCategory)
					? (rawCategory as PostCategory)
					: undefined;

			return {
				title: entry.title ?? entry.slug,
				slug: entry.slug,
				date: entry.date ?? '',
				description: entry.excerpt ?? entry.description ?? '',
				tags,
				published: true,
				original_url: entry.original_url ?? undefined,
				excerpt: entry.excerpt ?? undefined,
				category,
				categories: undefined,
				reading_time: entry.reading_time ?? undefined,
				feature_image: entry.feature_image ?? undefined,
				thumbnail_image: entry.thumbnail_image ?? undefined,
				featured: entry.featured ?? undefined,
				author_slug: entry.author_slug ?? 'jesssullivan',
				body_excerpt: entry.body_excerpt ?? undefined
			};
		});

	return posts.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}

export async function getPosts(): Promise<Post[]> {
	return searchIndexEntriesToPosts(searchIndex);
}
