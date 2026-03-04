import { Schema } from "effect"

// ── Categories ──────────────────────────────────────────────

export const POST_CATEGORIES = [
	"hardware", "software", "ecology", "music",
	"photography", "personal", "tutorial", "devops",
] as const

export const PostCategory = Schema.Literals([...POST_CATEGORIES])
export type PostCategory = typeof PostCategory.Type

// ── Date pattern ────────────────────────────────────────────

const ISODate = Schema.String.pipe(
	Schema.refine((s): s is string => /^\d{4}-\d{2}-\d{2}$/.test(s))
)

// ── Base frontmatter (permissive — for collection/import) ───

export const PostFrontmatter = Schema.Struct({
	title: Schema.String,
	date: ISODate,
	description: Schema.optional(Schema.String),
	tags: Schema.optional(Schema.Array(Schema.String)),
	category: Schema.optional(PostCategory),
	published: Schema.optional(Schema.Boolean),
	featured: Schema.optional(Schema.Boolean),
	feature_image: Schema.optional(Schema.String),
	reading_time: Schema.optional(Schema.Number),
	slug: Schema.optional(Schema.String),
	source_repo: Schema.optional(Schema.String),
	source_path: Schema.optional(Schema.String),
	publish_to: Schema.optional(Schema.String),
	original_url: Schema.optional(Schema.String),
	excerpt: Schema.optional(Schema.String),
	body_excerpt: Schema.optional(Schema.String),
	thumbnail_image: Schema.optional(Schema.String),
	author_slug: Schema.optional(Schema.String),
})

export type PostFrontmatter = typeof PostFrontmatter.Type

// ── Strict schema for published posts ───────────────────────

export const PublishedPost = Schema.Struct({
	title: Schema.String.pipe(
		Schema.refine((s): s is string => s.length >= 1)
	),
	date: ISODate,
	description: Schema.String.pipe(
		Schema.refine((s): s is string => s.length >= 10)
	),
	tags: Schema.Array(Schema.String).pipe(
		Schema.refine((a): a is ReadonlyArray<string> => a.length >= 1)
	),
	category: PostCategory,
	published: Schema.Literal(true),
	featured: Schema.optional(Schema.Boolean),
	feature_image: Schema.optional(Schema.String),
	reading_time: Schema.optional(Schema.Number),
	slug: Schema.optional(Schema.String),
	source_repo: Schema.optional(Schema.String),
	source_path: Schema.optional(Schema.String),
	publish_to: Schema.optional(Schema.String),
	original_url: Schema.optional(Schema.String),
	excerpt: Schema.optional(Schema.String),
	body_excerpt: Schema.optional(Schema.String),
	thumbnail_image: Schema.optional(Schema.String),
	author_slug: Schema.optional(Schema.String),
})

export type PublishedPost = typeof PublishedPost.Type

// ── Validation helpers ──────────────────────────────────────

export const decodePostFrontmatter = Schema.decodeUnknownExit(PostFrontmatter)
export const decodePublishedPost = Schema.decodeUnknownExit(PublishedPost)

// ── Canonical YAML frontmatter parser ──────────────────────
// Single source of truth — used by blog-agent services and build scripts.

function stripQuotes(s: string): string {
	if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'")))
		return s.slice(1, -1)
	return s
}

function parseValue(val: string): string | number | boolean | null | string[] {
	if (val === "true") return true
	if (val === "false") return false
	if (val === "" || val === "null" || val === "~") return null
	if (/^-?\d+(\.\d+)?$/.test(val)) return Number(val)
	if (val.startsWith("[") && val.endsWith("]")) {
		const inner = val.slice(1, -1).trim()
		if (inner === "") return []
		return inner.split(",").map((s) => stripQuotes(s.trim()))
	}
	return stripQuotes(val)
}

/** Parse YAML frontmatter from a markdown string into a key-value record. */
export function parseFrontmatter(raw: string): Record<string, unknown> | null {
	const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---/)
	if (!match) return null
	const yaml = match[1]!
	const result: Record<string, unknown> = {}
	for (const line of yaml.split("\n")) {
		const trimmed = line.trim()
		if (!trimmed || trimmed.startsWith("#")) continue
		const kvMatch = trimmed.match(/^(\w[\w_]*):\s*(.*)/)
		if (!kvMatch) continue
		const [, key, rawVal] = kvMatch
		if (!key || rawVal === undefined) continue
		result[key] = parseValue(rawVal.trim())
	}
	return result
}

/** Extract raw frontmatter string, its end index, and the body. */
export function parseFrontmatterRaw(content: string): { raw: string; endIndex: number; body: string } | null {
	const match = content.match(/^---\n([\s\S]*?)\n---\n/)
	if (!match) return null
	return {
		raw: match[1]!,
		endIndex: match[0].length,
		body: content.slice(match[0].length),
	}
}
