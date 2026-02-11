import type { Post, PostCategory } from './types';
import { POST_CATEGORIES } from './types';

export type { Post, PostFrontmatter, PostCategory } from './types';
export { POST_CATEGORIES } from './types';

/**
 * Strip markdown/HTML to approximate plain text and count words.
 * Returns estimated reading time in minutes (min 1).
 */
export function computeReadingTime(raw: string): number {
	// Strip YAML frontmatter
	const withoutFrontmatter = raw.replace(/^---[\s\S]*?---/, '');
	// Strip fenced code blocks
	const withoutCode = withoutFrontmatter.replace(/```[\s\S]*?```/g, '');
	// Strip inline code
	const withoutInlineCode = withoutCode.replace(/`[^`]*`/g, '');
	// Strip HTML tags
	const withoutHtml = withoutInlineCode.replace(/<[^>]+>/g, '');
	// Strip markdown images ![alt](url)
	const withoutImages = withoutHtml.replace(/!\[[^\]]*\]\([^)]*\)/g, '');
	// Strip markdown links but keep text [text](url) -> text
	const withoutLinks = withoutImages.replace(/\[([^\]]*)\]\([^)]*\)/g, '$1');
	// Strip markdown formatting characters
	const withoutFormatting = withoutLinks.replace(/[#*_~>|\\-]/g, '');
	// Collapse whitespace and count words
	const text = withoutFormatting.trim();
	if (!text) return 1;
	const words = text.split(/\s+/).filter((w) => w.length > 0).length;
	return Math.max(1, Math.round(words / 230));
}

export async function getPosts(): Promise<Post[]> {
	const modules = import.meta.glob('/src/posts/*.md', { eager: true });
	const rawModules = import.meta.glob('/src/posts/*.md', {
		eager: true,
		query: '?raw',
		import: 'default'
	}) as Record<string, string>;

	const posts: Post[] = [];

	for (const [path, module] of Object.entries(modules)) {
		const mod = module as { metadata: Record<string, unknown> };
		const metadata = mod.metadata;

		if (!metadata?.published) continue;

		const slug =
			(metadata.slug as string) ??
			path
				.split('/')
				.pop()
				?.replace('.md', '')
				.replace(/^\d{4}-\d{2}-\d{2}-/, '') ??
			'';

		// Validate category against allowed values if present
		const rawCategory = metadata.category as string | undefined;
		const category: PostCategory | undefined =
			rawCategory && POST_CATEGORIES.includes(rawCategory as PostCategory)
				? (rawCategory as PostCategory)
				: undefined;

		// Use frontmatter reading_time if provided, otherwise compute from raw markdown
		const rawContent = rawModules[path] ?? '';
		const reading_time =
			(metadata.reading_time as number) ?? computeReadingTime(rawContent);

		posts.push({
			title: (metadata.title as string) ?? slug,
			slug,
			date: (metadata.date as string) ?? '',
			description: (metadata.excerpt as string) ?? (metadata.description as string) ?? '',
			tags: (metadata.tags as string[]) ?? [],
			published: true,
			original_url: (metadata.original_url as string) ?? undefined,
			excerpt: (metadata.excerpt as string) ?? undefined,
			category,
			categories: (metadata.categories as string[]) ?? undefined,
			reading_time,
			feature_image: (metadata.feature_image as string) ?? undefined,
			thumbnail_image: (metadata.thumbnail_image as string) ?? undefined,
			featured: (metadata.featured as boolean) ?? undefined,
			author_slug: (metadata.author_slug as string) ?? 'jesssullivan'
		});
	}

	return posts.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}
