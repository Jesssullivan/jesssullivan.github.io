export interface PostFrontmatter {
	title: string;
	date: string;
	slug?: string;
	description?: string;
	tags?: string[];
	category?: string;
	published?: boolean;
	featured?: boolean;
	feature_image?: string;
	reading_time?: number;
	source_repo?: string;
	source_path?: string;
	publish_to?: string;
	body_excerpt?: string;
	original_url?: string;
	excerpt?: string;
	categories?: string[];
	thumbnail_image?: string;
	author_slug?: string;
}
