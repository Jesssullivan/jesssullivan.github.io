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

function getEagerModules() {
	return import.meta.glob('/src/posts/*.md', { eager: true }) as Record<
		string,
		{ metadata: Record<string, unknown> }
	>;
}

function getSortedPosts(): { slug: string; title: string; date: string }[] {
	const modules = getEagerModules();
	const posts: { slug: string; title: string; date: string }[] = [];

	for (const [path, module] of Object.entries(modules)) {
		const metadata = module.metadata;
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

function slugToPath(): Map<string, string> {
	const modules = getEagerModules();
	const map = new Map<string, string>();
	for (const [path, module] of Object.entries(modules)) {
		const metadata = module.metadata;
		if (!metadata?.published) continue;
		map.set(getSlug(path, metadata), path);
	}
	return map;
}

export const entries: EntryGenerator = async () => {
	return getSortedPosts().map(({ slug }) => ({ slug }));
};

export const load: PageLoad = async ({ params }) => {
	const lazyModules = import.meta.glob('/src/posts/*.md');
	const pathMap = slugToPath();
	const matchedPath = pathMap.get(params.slug);

	if (matchedPath && lazyModules[matchedPath]) {
		const post = (await lazyModules[matchedPath]()) as {
			default: unknown;
			metadata: Record<string, unknown>;
		};

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

	error(404, 'Post not found');
};
