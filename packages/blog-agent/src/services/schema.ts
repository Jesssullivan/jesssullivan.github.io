import { Effect, Exit, Layer, ServiceMap } from "effect"
import { Schema } from "effect"
import {
	PostFrontmatter,
	PublishedPost,
	POST_CATEGORIES,
	parseFrontmatter as parseFrontmatterYaml,
} from "../schema/frontmatter.js"

// ── Types ──────────────────────────────────────────────────

export interface ValidationResult {
	ok: boolean
	value?: Record<string, unknown>
	errors: ValidationError[]
}

export interface ValidationError {
	path: string
	message: string
}

// ── Service definition ─────────────────────────────────────

export class SchemaService extends ServiceMap.Service<SchemaService, {
	readonly parseFrontmatter: (raw: string) => Record<string, unknown> | null
	readonly validateDraft: (data: unknown) => ValidationResult
	readonly validatePublished: (data: unknown) => ValidationResult
	readonly validCategories: readonly string[]
}>()("SchemaService") {}

// ── Extract validation errors from Effect Exit ──────────────

function extractErrors(exit: Exit.Exit<unknown, unknown>): ValidationError[] {
	if (Exit.isSuccess(exit)) return []
	const cause = exit.cause
	const errors: ValidationError[] = []
	const str = String(cause)
	const lines = str.split("\n").filter((l: string) => l.includes("Expected") || l.includes("is missing"))
	for (const line of lines) {
		errors.push({ path: "", message: line.trim() })
	}
	if (errors.length === 0) {
		errors.push({ path: "", message: "Validation failed" })
	}
	return errors
}

// ── Live implementation ─────────────────────────────────────

export const SchemaServiceLive = Layer.succeed(SchemaService)({
	parseFrontmatter: parseFrontmatterYaml,

	validateDraft: (data: unknown) => {
		const exit = Schema.decodeUnknownExit(PostFrontmatter)(data)
		if (Exit.isSuccess(exit)) {
			return { ok: true, value: exit.value as unknown as Record<string, unknown>, errors: [] }
		}
		return { ok: false, errors: extractErrors(exit) }
	},

	validatePublished: (data: unknown) => {
		const exit = Schema.decodeUnknownExit(PublishedPost)(data)
		if (Exit.isSuccess(exit)) {
			return { ok: true, value: exit.value as unknown as Record<string, unknown>, errors: [] }
		}
		return { ok: false, errors: extractErrors(exit) }
	},

	validCategories: POST_CATEGORIES,
})
