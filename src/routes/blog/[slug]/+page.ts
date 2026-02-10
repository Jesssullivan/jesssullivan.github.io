import type { PageLoad, EntryGenerator } from './$types';
import { error } from '@sveltejs/kit';

export const entries: EntryGenerator = async () => {
	const modules = import.meta.glob('/src/posts/*.md', { eager: true });
	const result: { slug: string }[] = [];

	for (const [path, module] of Object.entries(modules)) {
		const mod = module as { metadata: Record<string, unknown> };
		const metadata = mod.metadata;
		if (!metadata?.published) continue;

		const filename = path.split('/').pop()?.replace('.md', '') ?? '';
		const slug =
			(metadata.slug as string) ??
			filename.replace(/^\d{4}-\d{2}-\d{2}-/, '');

		result.push({ slug });
	}

	return result;
};

export const load: PageLoad = async ({ params }) => {
	const modules = import.meta.glob('/src/posts/*.md');

	for (const [path, resolver] of Object.entries(modules)) {
		const filename = path.split('/').pop()?.replace('.md', '') ?? '';
		// Extract slug: strip leading date prefix if present
		const slug = filename.replace(/^\d{4}-\d{2}-\d{2}-/, '');

		if (slug === params.slug) {
			const post = (await resolver()) as { default: unknown; metadata: Record<string, unknown> };
			return {
				content: post.default,
				metadata: post.metadata
			};
		}
	}

	// Also try exact filename match (for posts like hello-world.md)
	try {
		const post = await import(`../../../posts/${params.slug}.md`);
		return {
			content: post.default,
			metadata: post.metadata
		};
	} catch {
		error(404, 'Post not found');
	}
};
