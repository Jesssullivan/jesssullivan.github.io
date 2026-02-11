/**
 * Utilities for RSS/JSON feed generation.
 * Extracts raw post content (markdown body without frontmatter) keyed by slug.
 */

function stripFrontmatter(raw: string): string {
	return raw.replace(/^---[\s\S]*?---\s*/, '').trim();
}

function getSlug(path: string, metadata: { slug?: string }): string {
	const filename = path.split('/').pop()?.replace('.md', '') ?? '';
	return metadata.slug ?? filename.replace(/^\d{4}-\d{2}-\d{2}-/, '');
}

/**
 * Returns a Map of slug → raw markdown body (frontmatter stripped).
 * Uses eager glob imports so this runs at build time.
 */
export function getRawPostContent(): Map<string, string> {
	const eagerModules = import.meta.glob('/src/posts/*.md', { eager: true }) as Record<
		string,
		{ metadata: { slug?: string; published?: boolean } }
	>;
	const rawModules = import.meta.glob('/src/posts/*.md', {
		eager: true,
		query: '?raw',
		import: 'default'
	}) as Record<string, string>;

	const map = new Map<string, string>();

	for (const [path, module] of Object.entries(eagerModules)) {
		if (!module.metadata?.published) continue;
		const slug = getSlug(path, module.metadata);
		const raw = rawModules[path] ?? '';
		map.set(slug, stripFrontmatter(raw));
	}

	return map;
}
