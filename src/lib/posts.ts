import type { Post } from './types';

export type { Post, PostFrontmatter } from './types';

export async function getPosts(): Promise<Post[]> {
	const modules = import.meta.glob('/src/posts/*.md', { eager: true });

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

		posts.push({
			title: (metadata.title as string) ?? slug,
			slug,
			date: (metadata.date as string) ?? '',
			description: (metadata.description as string) ?? (metadata.excerpt as string) ?? '',
			tags: (metadata.tags as string[]) ?? [],
			published: true,
			original_url: (metadata.original_url as string) ?? undefined,
			excerpt: (metadata.excerpt as string) ?? undefined,
			categories: (metadata.categories as string[]) ?? undefined,
			reading_time: (metadata.reading_time as number) ?? undefined,
			feature_image: (metadata.feature_image as string) ?? undefined,
			thumbnail_image: (metadata.thumbnail_image as string) ?? undefined,
			featured: (metadata.featured as boolean) ?? undefined,
			author_slug: (metadata.author_slug as string) ?? undefined
		});
	}

	return posts.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}
