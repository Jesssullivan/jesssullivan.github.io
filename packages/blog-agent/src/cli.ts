#!/usr/bin/env tsx
/**
 * CLI entry point for blog-agent.
 *
 * Usage:
 *   tsx packages/blog-agent/src/cli.ts review --pr 42
 *   tsx packages/blog-agent/src/cli.ts review --file src/posts/2026-03-04-test.md
 *   tsx packages/blog-agent/src/cli.ts validate --file src/posts/2026-03-04-test.md
 */

import { Effect, Layer, Exit } from "effect"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { reviewPR } from "./agents/review.js"
import { GitHubServiceLive } from "./services/github.js"
import { SchemaServiceLive, SchemaService } from "./services/schema.js"
import { ProseReviewServiceLive } from "./services/prose-review.js"
import { HyperlinkServiceLive, HyperlinkService } from "./services/hyperlink.js"

const args = process.argv.slice(2)
const command = args[0]

function getArg(flag: string): string | undefined {
	const idx = args.indexOf(flag)
	return idx >= 0 ? args[idx + 1] : undefined
}

const allServices = Layer.mergeAll(
	GitHubServiceLive,
	SchemaServiceLive,
	ProseReviewServiceLive,
	HyperlinkServiceLive,
)

async function main() {
	switch (command) {
		case "review": {
			const prNumber = getArg("--pr")
			if (!prNumber) {
				console.error("Usage: cli.ts review --pr <number>")
				process.exit(1)
			}
			const owner = getArg("--owner") ?? "Jesssullivan"
			const repo = getArg("--repo") ?? "jesssullivan.github.io"

			console.log(`Reviewing PR #${prNumber} on ${owner}/${repo}...`)

			const program = reviewPR(owner, repo, parseInt(prNumber, 10)).pipe(
				Effect.provide(allServices),
			)
			const exit = await Effect.runPromiseExit(program)
			if (Exit.isFailure(exit)) {
				console.error("Review failed:", exit.cause)
				process.exit(1)
			}
			console.log("Review complete.")
			break
		}

		case "validate": {
			const file = getArg("--file")
			if (!file) {
				console.error("Usage: cli.ts validate --file <path>")
				process.exit(1)
			}
			const content = readFileSync(resolve(file), "utf-8")
			const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/)
			if (!match) {
				console.error("No frontmatter found")
				process.exit(1)
			}

			const program = Effect.gen(function* () {
				const schema = yield* Effect.service(SchemaService)
				const fm = schema.parseFrontmatter(content)
				if (!fm) {
					console.error("Failed to parse frontmatter")
					return false
				}

				console.log("Parsed frontmatter:", JSON.stringify(fm, null, 2))

				const draftResult = schema.validateDraft(fm)
				if (!draftResult.ok) {
					console.error("Draft validation errors:")
					for (const e of draftResult.errors) console.error(`  - ${e.message}`)
					return false
				}
				console.log("✅ Draft validation passed")

				if (fm.published === true) {
					const pubResult = schema.validatePublished(fm)
					if (!pubResult.ok) {
						console.error("Published validation errors:")
						for (const e of pubResult.errors) console.error(`  - ${e.message}`)
						return false
					}
					console.log("✅ Published validation passed")
				}

				return true
			}).pipe(Effect.provide(SchemaServiceLive))

			const exit = await Effect.runPromiseExit(program)
			if (Exit.isFailure(exit) || (Exit.isSuccess(exit) && !exit.value)) {
				process.exit(1)
			}
			break
		}

		case "suggest-links": {
			const file = getArg("--file")
			if (!file) {
				console.error("Usage: cli.ts suggest-links --file <path>")
				process.exit(1)
			}
			const content = readFileSync(resolve(file), "utf-8")
			const bodyStart = content.indexOf("---", 3)
			const body = bodyStart >= 0 ? content.slice(content.indexOf("\n", bodyStart) + 1) : content

			const program = Effect.gen(function* () {
				const hl = yield* Effect.service(HyperlinkService)
				const suggestions = yield* hl.findUnlinkedKeywords(body)
				if (suggestions.length === 0) {
					console.log("No unlinked keywords found.")
					return
				}
				console.log(`Found ${suggestions.length} unlinked keyword(s):`)
				for (const s of suggestions) {
					console.log(`  Line ${s.line}: ${s.keyword} → [${s.keyword}](${s.url})`)
					console.log(`    "${s.context}"`)
				}
			}).pipe(Effect.provide(HyperlinkServiceLive))

			await Effect.runPromise(program)
			break
		}

		default:
			console.log(`Usage: cli.ts <command>

Commands:
  review          Review a PR (--pr <number>)
  validate        Validate a post's frontmatter (--file <path>)
  suggest-links   Find unlinked keywords in a post (--file <path>)`)
			break
	}
}

main().catch((err) => {
	console.error(err)
	process.exit(1)
})
