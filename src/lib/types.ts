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

/** Blog-post editorial tier; Pulse remains a separate snapshot/broker stratum. */
export const POST_EDITORIAL_TIERS = ['less-noteworthy', 'noteworthy'] as const;

export type PostEditorialTier = (typeof POST_EDITORIAL_TIERS)[number];

export const CONTENT_STRATA = ['pulse', ...POST_EDITORIAL_TIERS] as const;

export type ContentStratum = (typeof CONTENT_STRATA)[number];

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
	editorial_tier?: PostEditorialTier; // Reader treatment: less-noteworthy or noteworthy
	content_stratum?: ContentStratum; // Derived/search field; "pulse" is not blog frontmatter
	reading_time?: number; // Minutes, computed at build time
	feature_image?: string; // Hero/feature image URL
	thumbnail_image?: string;
	featured?: boolean; // Pinned/featured post
	author_slug?: string; // Default: 'jesssullivan'
	source_repo?: string; // Provenance: e.g. "Jesssullivan/aperture-bootstrap"
	source_path?: string; // Provenance: e.g. "blog/part-1-identity.md"
	publish_to?: string; // Discovery marker: "blog"
	linear_issue?: string; // Optional control-plane link: e.g. "TIN-171"
	linear_project?: string; // Optional management surface: e.g. "Blog + Profile Integration"
}

/** A resolved post with guaranteed slug and optional rendered content */
export interface Post extends PostFrontmatter {
	slug: string;
	content?: string;
	body_excerpt?: string;
}
