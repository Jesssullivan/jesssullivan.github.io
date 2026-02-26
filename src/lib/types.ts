/** Constrained post category — tinyland.dev const-assertion style enum */
export const POST_CATEGORIES = [
	'hardware',
	'software',
	'ecology',
	'music',
	'photography',
	'personal',
	'tutorial',
	'devops'
] as const;

export type PostCategory = (typeof POST_CATEGORIES)[number];

/** Canonical frontmatter schema for blog posts (tinyland.dev compat) */
export interface PostFrontmatter {
	title: string;
	date: string; // ISO date YYYY-MM-DD
	description: string;
	tags: string[];
	published: boolean;
	slug?: string; // Optional, falls back to filename
	original_url?: string; // WordPress source URL
	excerpt?: string; // Alias for description (tinyland compat)
	category?: PostCategory; // Typed singular category (tinyland compat)
	categories?: string[]; // Legacy free-form categories
	reading_time?: number; // Minutes, computed at build time
	feature_image?: string; // Hero/feature image URL
	thumbnail_image?: string;
	featured?: boolean; // Pinned/featured post
	author_slug?: string; // Default: 'jesssullivan'
	source_repo?: string; // Provenance: e.g. "Jesssullivan/aperture-bootstrap"
	source_path?: string; // Provenance: e.g. "blog/part-1-identity.md"
	publish_to?: string; // Discovery marker: "blog"
}

/** A resolved post with guaranteed slug and optional rendered content */
export interface Post extends PostFrontmatter {
	slug: string;
	content?: string;
	body_excerpt?: string;
}
