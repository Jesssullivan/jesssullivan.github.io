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

export interface LinkInfo {
	text: string;
	url: string;
	file: string;
	line: number;
}

export interface AuditIssue {
	file: string;
	line?: number;
	url?: string;
	text?: string;
	title?: string;
	wordCount?: number;
	date?: string;
	ageYears?: number;
	hasRedirect?: boolean;
}

export interface BundleChunk {
	file: string;
	size: number;
}

export interface BundleReport {
	timestamp: string;
	totals: { js: number; css: number; other: number; total: number };
	counts: { js: number; css: number; other: number };
	largeChunks: BundleChunk[];
	topJS: BundleChunk[];
}
