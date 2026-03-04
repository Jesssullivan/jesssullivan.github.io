/**
 * Agentuity webhook agent — receives GitHub events and dispatches to
 * the appropriate Effect-based handler (review or command).
 *
 * This is the Agentuity entry point. For pure-CI usage, see cli.ts.
 */

import { createAgent } from "@agentuity/runtime"
import { z } from "zod"
import { Effect, Layer, Exit } from "effect"
import { reviewPR } from "../agents/review.js"
import { handleCommand } from "../agents/commands.js"
import { GitHubServiceLive } from "../services/github.js"
import { SchemaServiceLive } from "../services/schema.js"
import { ProseReviewServiceLive } from "../services/prose-review.js"
import { HyperlinkServiceLive } from "../services/hyperlink.js"

const allServices = Layer.mergeAll(
	GitHubServiceLive,
	SchemaServiceLive,
	ProseReviewServiceLive,
	HyperlinkServiceLive,
)

const WebhookPayload = z.object({
	event: z.string(),
	action: z.string().optional(),
	pull_request: z.object({
		number: z.number(),
	}).optional(),
	issue: z.object({
		number: z.number(),
		pull_request: z.unknown().optional(),
	}).optional(),
	comment: z.object({
		id: z.number(),
		body: z.string(),
		user: z.object({ login: z.string() }),
	}).optional(),
	repository: z.object({
		owner: z.object({ login: z.string() }),
		name: z.string(),
	}).optional(),
})

export default createAgent("webhook", {
	description: "GitHub webhook receiver for blog post PR review and slash commands",
	schema: {
		input: WebhookPayload,
		output: z.object({
			ok: z.boolean(),
			action: z.string().optional(),
			error: z.string().optional(),
			pr: z.number().optional(),
		}),
	},
	handler: async (_ctx, payload) => {
		const owner = payload.repository?.owner?.login ?? "Jesssullivan"
		const repo = payload.repository?.name ?? "jesssullivan.github.io"

		if (payload.event === "pull_request" && payload.pull_request) {
			const prNumber = payload.pull_request.number
			const program = reviewPR(owner, repo, prNumber).pipe(
				Effect.provide(allServices),
			)
			const exit = await Effect.runPromiseExit(program)
			if (Exit.isFailure(exit)) {
				return { ok: false, error: "Review failed" }
			}
			return { ok: true, action: "review", pr: prNumber }
		}

		if (payload.event === "issue_comment" && payload.comment && payload.issue?.pull_request) {
			const prNumber = payload.issue.number
			const program = handleCommand({
				owner,
				repo,
				prNumber,
				commentId: payload.comment.id,
				commentBody: payload.comment.body,
				commenter: payload.comment.user.login,
			}).pipe(Effect.provide(allServices))

			const exit = await Effect.runPromiseExit(program)
			if (Exit.isFailure(exit)) {
				return { ok: false, error: "Command failed" }
			}
			return { ok: true, action: "command", pr: prNumber }
		}

		return { ok: true, action: "ignored" }
	},
})
