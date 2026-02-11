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
	categories?: string[];
	reading_time?: number; // Minutes, computed at build time
	feature_image?: string; // Hero/feature image URL
	thumbnail_image?: string;
	featured?: boolean; // Pinned/featured post
	author_slug?: string; // Default: 'jess'
}

/** A resolved post with guaranteed slug and optional rendered content */
export interface Post extends PostFrontmatter {
	slug: string;
	content?: string;
}
