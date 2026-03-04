// PostFrontmatter is derived from the Effect Schema in @blog/agent.
// Re-exported here for backwards compatibility with existing scripts.
export type { PostFrontmatter } from '@blog/agent/schema'

// Extended frontmatter type for scripts that need legacy fields not in the schema.
export interface PostFrontmatterLegacy {
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

export interface ImageRef {
	url: string;
	type: 'markdown' | 'html';
	alt: string;
}

export interface CdxRecord {
	timestamp: string;
	original: string;
	mimetype: string;
	statuscode: string;
	digest: string;
	length: string;
}

export interface ImageDimensions {
	width: number;
	height: number;
}

export interface GalleryEntry {
	src: string;
	webp: string | null;
	width: number;
	height: number;
	post_slug: string | null;
	post_title: string | null;
}

export interface BlogStats {
	generated: string;
	totals: {
		posts: number;
		words: number;
		avgWordsPerPost: number;
		avgReadingTime: number;
		tags: number;
		categories: number;
	};
	postsPerYear: Record<string, number>;
	postsPerQuarter: Record<string, number>;
	readingTimeDistribution: Record<string, number>;
	wordCountTrends: Record<string, { avgWords: number; totalWords: number; posts: number }>;
	topTags: Record<string, number>;
	tagCooccurrence: TagEdge[];
	categories: Record<string, number>;
	codeLanguages: Record<string, number>;
	codeLanguagesByYear: Record<string, Record<string, number>>;
	rolling12MonthPosts: Record<string, number>;
	mostActiveMonth: { month: string; posts: number } | null;
	recentPosts: { slug: string; title: string; date: string }[];
}

export interface TagEdge {
	source: string;
	target: string;
	weight: number;
}

export interface SearchIndexEntry {
	id: string;
	title: string;
	description: string;
	tags: string;
	category: string;
	slug: string;
	date: string;
	body_excerpt: string;
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

export interface MediaAuditReport {
	totalPosts: number;
	totalImageRefs: number;
	localExisting: { file: string; url: string }[];
	localMissing: { file: string; url: string; filename: string }[];
	externalWp: { file: string; url: string; normalized: string; mapped: string | null }[];
	externalOther: { file: string; url: string }[];
	unmappedUrlMapEntries: { wpUrl: string; localPath: string }[];
}

export interface WaybackSnapshot {
	timestamp: string;
	url: string;
}

export interface WpImage {
	key: string;
	original: string;
	uploadPath: string;
	timestamp: string;
	localFile?: string | null;
}

export interface PlaceholderInfo {
	lineIndex: number;
	text: string;
}

export interface PostWithPlaceholders {
	file: string;
	content: string;
	lines: string[];
	placeholders: PlaceholderInfo[];
	originalUrl: string | null;
}

export interface ParsedFrontmatter {
	raw: string;
	endIndex: number;
	body: string;
}

export interface GraphNode {
	id: string;
	count: number;
	x: number;
	y: number;
	vx: number;
	vy: number;
}
