/**
 * frontmatter.mts — Re-exports the canonical frontmatter parser from @blog/agent.
 *
 * This is the single source of truth for YAML frontmatter parsing across the
 * entire monorepo. All scripts should import from here (or directly from
 * @blog/agent/schema).
 */

export {
	parseFrontmatter,
	parseFrontmatterRaw,
	POST_CATEGORIES,
} from '@blog/agent/schema'

export type { PostFrontmatter } from '@blog/agent/schema'
