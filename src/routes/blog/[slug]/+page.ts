import type { PageLoad, EntryGenerator } from './$types';
import { error } from '@sveltejs/kit';

interface PostMeta {
	title: string;
	slug: string;
	date: string;
	published?: boolean;
	[key: string]: unknown;
}

function getSlug(path: string, metadata: Record<string, unknown>): string {
	const filename = path.split('/').pop()?.replace('.md', '') ?? '';
	return (metadata.slug as string) ?? filename.replace(/^\d{4}-\d{2}-\d{2}-/, '');
}

function getSortedPosts(): { slug: string; title: string; date: string }[] {
	const modules = import.meta.glob('/src/posts/*.md', { eager: true });
	const posts: { slug: string; title: string; date: string }[] = [];

	for (const [path, module] of Object.entries(modules)) {
		const mod = module as { metadata: Record<string, unknown> };
		const metadata = mod.metadata;
		if (!metadata?.published) continue;

		const slug = getSlug(path, metadata);
		posts.push({
			slug,
			title: (metadata.title as string) ?? slug,
			date: (metadata.date as string) ?? ''
		});
	}

	return posts.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}

export const entries: EntryGenerator = async () => {
	return getSortedPosts().map(({ slug }) => ({ slug }));
};

export const load: PageLoad = async ({ params }) => {
	const modules = import.meta.glob('/src/posts/*.md');

	for (const [path, resolver] of Object.entries(modules)) {
		const filename = path.split('/').pop()?.replace('.md', '') ?? '';
		const slug = filename.replace(/^\d{4}-\d{2}-\d{2}-/, '');

		if (slug === params.slug) {
			const post = (await resolver()) as { default: unknown; metadata: Record<string, unknown> };

			const sorted = getSortedPosts();
			const idx = sorted.findIndex((p) => p.slug === params.slug);
			const prev = idx < sorted.length - 1 ? sorted[idx + 1] : null;
			const next = idx > 0 ? sorted[idx - 1] : null;

			return {
				content: post.default,
				metadata: post.metadata,
				prev,
				next
			};
		}
	}

	try {
		const post = await import(`../../../posts/${params.slug}.md`);

		const sorted = getSortedPosts();
		const idx = sorted.findIndex((p) => p.slug === params.slug);
		const prev = idx < sorted.length - 1 ? sorted[idx + 1] : null;
		const next = idx > 0 ? sorted[idx - 1] : null;

		return {
			content: post.default,
			metadata: post.metadata,
			prev,
			next
		};
	} catch {
		error(404, 'Post not found');
	}
};
