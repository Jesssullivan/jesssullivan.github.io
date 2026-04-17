import { Effect } from "effect"
import { GitHubService, type ReviewComment } from "../services/github.js"
import { SchemaService } from "../services/schema.js"
import { ProseReviewService } from "../services/prose-review.js"
import { HyperlinkService, type HyperlinkSuggestion } from "../services/hyperlink.js"
import { POST_CATEGORIES } from "../schema/frontmatter.js"
import { readFileSync } from "node:fs"
import { resolve, dirname } from "node:path"
import { fileURLToPath } from "node:url"

const __dirname = dirname(fileURLToPath(import.meta.url))

// ── Types ───────────────────────────────────────────────────

interface PostAnalysis {
	filename: string
	status: "new" | "modified"
	frontmatter: Record<string, unknown>
	body: string
	content: string
}

// ── Load AGENTS.md ──────────────────────────────────────────

function loadStyleGuide(): string {
	try {
		return readFileSync(resolve(__dirname, "../../../AGENTS.md"), "utf-8")
	} catch {
		return ""
	}
}

// ── Review agent pipeline ───────────────────────────────────

export const reviewPR = (owner: string, repo: string, prNumber: number) =>
	Effect.gen(function* () {
		const github = yield* Effect.service(GitHubService)
		const schema = yield* Effect.service(SchemaService)
		const prose = yield* Effect.service(ProseReviewService)
		const hyperlinks = yield* Effect.service(HyperlinkService)

		// 1. Get PR metadata
		const pr = yield* github.getPR(owner, repo, prNumber)

		// 2. Find changed blog post files
		const files = yield* github.listChangedFiles(owner, repo, prNumber)
		const postFiles = files.filter(
			(f: { filename: string; status: string }) => f.filename.startsWith("src/posts/") &&
				f.filename.endsWith(".md") &&
				f.status !== "removed"
		)

		if (postFiles.length === 0) return

		// 3. Analyze each post
		const posts: PostAnalysis[] = []
		for (const file of postFiles) {
			const { content } = yield* github.getFileContent(owner, repo, file.filename, pr.headSha)
			const fm = schema.parseFrontmatter(content)
			if (!fm) continue
			const bodyStart = content.indexOf("---", 3)
			const body = bodyStart >= 0 ? content.slice(content.indexOf("\n", bodyStart) + 1) : content
			posts.push({
				filename: file.filename,
				status: file.status === "added" ? "new" : "modified",
				frontmatter: fm,
				body,
				content,
			})
		}

		if (posts.length === 0) return

		// 4. Schema validation (Haiku-tier: fast, cheap)
		const schemaResults = posts.map((post) => ({
			post,
			draft: schema.validateDraft(post.frontmatter),
			published: post.frontmatter.published === true
				? schema.validatePublished(post.frontmatter)
				: null,
		}))

		// 5. Prose review (Sonnet-tier: deeper analysis)
		const styleGuide = loadStyleGuide()
		const proseResults = styleGuide
			? yield* Effect.all(
				posts.map((post) =>
					prose.reviewPost(post.frontmatter, post.body, styleGuide)
				)
			)
			: []

		// 6. Hyperlink suggestions
		const hyperlinkResults = yield* Effect.all(
			posts.map((post) => hyperlinks.findUnlinkedKeywords(post.body))
		)

		// 7. Build review comment
		const tableRows = posts.map((p) => {
			const title = (p.frontmatter.title as string) || p.filename.split("/").pop()?.replace(".md", "") || "Untitled"
			const statusIcon = p.status === "new" ? "🆕 New" : "✏️ Modified"
			const date = (p.frontmatter.date as string) || "not set"
			const published = p.frontmatter.published === true ? "✅ Published" : "❌ Draft"
			const tags = Array.isArray(p.frontmatter.tags) && p.frontmatter.tags.length > 0
				? (p.frontmatter.tags as string[]).join(", ")
				: "_none_"
			return `| ${title} | ${statusIcon} | ${date} | ${published} | ${tags} |`
		}).join("\n")

		// Schema error summary
		const schemaIssues = schemaResults
			.filter((r) => !r.draft.ok)
			.map((r) => `- **${r.post.filename.split("/").pop()}**: ${r.draft.errors.map((e) => e.message).join("; ")}`)

		// Prose review summary
		const proseSection = proseResults.length > 0
			? proseResults.map((r, i) => {
				const post = posts[i]!
				const name = post.filename.split("/").pop()
				return `#### ${name} — Style: ${r.styleScore}/10\n${r.summary}${r.suggestions.length > 0 ? `\n${r.suggestions.length} suggestion(s) posted as inline comments.` : ""}`
			}).join("\n\n")
			: ""

		// Hyperlink summary
		const linkSuggestions = hyperlinkResults.flat()

		let body = `<!-- blog-post-bot -->
## 📝 Blog Post Review

Found **${posts.length}** blog post(s) in this PR:

| Post | Status | Date | Published | Tags |
|------|--------|------|-----------|------|
${tableRows}

### Schema Validation
${schemaIssues.length > 0 ? schemaIssues.join("\n") : "✅ All posts pass schema validation."}

${proseSection ? `### Prose Review\n${proseSection}\n` : ""}
${linkSuggestions.length > 0 ? `### Hyperlink Suggestions\n${linkSuggestions.map((s: HyperlinkSuggestion) => `- **${s.keyword}** → [${s.keyword}](${s.url}) (line ${s.line})`).join("\n")}\n` : ""}
### Slash Commands
| Command | Description |
|---------|-------------|
| \`/schedule 2026-03-15\` | Schedule auto-merge for a date |
| \`/publish\` | Set all posts to \`published: true\` |
| \`/draft\` | Set all posts back to draft |
| \`/retitle "New Title"\` | Change a post's title |
| \`/review\` | Re-run AI prose review |
| \`/suggest-links\` | Find unlinked keywords |`

		// Check for DO NOT MERGE scheduling
		const scheduleMatch = (pr.body ?? "").match(/DO NOT MERGE until (\d{4}-\d{2}-\d{2})\s*UTC/i)
		if (scheduleMatch) {
			const mergeDate = new Date(scheduleMatch[1] + "T00:00:00Z")
			const today = new Date()
			today.setUTCHours(0, 0, 0, 0)
			if (mergeDate <= today) {
				body += `\n\n---\n⏰ **Scheduled date (${scheduleMatch[1]} UTC) has passed** — this PR is ready to merge!`
			} else {
				body += `\n\n---\n📅 **Scheduled for auto-merge on ${scheduleMatch[1]} UTC.** The auto-merge workflow runs daily at 05:00 UTC.`
			}
		}

		// 8. Post the review comment
		yield* github.postComment(owner, repo, prNumber, body, "<!-- blog-post-bot -->")

		// 9. Post inline suggestions from prose review
		const inlineComments: ReviewComment[] = []

		for (let i = 0; i < proseResults.length; i++) {
			const review = proseResults[i]!
			const post = posts[i]!
			for (const s of review.suggestions) {
				inlineComments.push({
					path: post.filename,
					line: s.line,
					side: "RIGHT",
					body: `**Style suggestion**: ${s.reason}\n\n\`\`\`suggestion\n${s.replacement}\n\`\`\``,
				})
			}
		}

		// Add frontmatter suggestions
		for (const result of schemaResults) {
			const post = result.post
			const fm = post.frontmatter
			const lines = post.content.split("\n")

			// Find frontmatter boundaries
			let fmEnd = -1
			let dashCount = 0
			for (let i = 0; i < lines.length; i++) {
				if (lines[i]!.trim() === "---") {
					dashCount++
					if (dashCount === 2) { fmEnd = i; break }
				}
			}

			if (!fm.description && fmEnd > 0) {
				inlineComments.push({
					path: post.filename,
					line: fmEnd + 1,
					side: "RIGHT",
					body: "📝 **Missing description** — add one for SEO and the blog card preview.",
				})
			}

			if ((!fm.tags || (Array.isArray(fm.tags) && fm.tags.length === 0)) && fmEnd > 0) {
				inlineComments.push({
					path: post.filename,
					line: fmEnd + 1,
					side: "RIGHT",
					body: "🏷️ **No tags** — tags help with search and the tag cloud.",
				})
			}

			if (fm.category && !POST_CATEGORIES.includes(fm.category as typeof POST_CATEGORIES[number])) {
				inlineComments.push({
					path: post.filename,
					line: fmEnd + 1,
					side: "RIGHT",
					body: `⚠️ **Unknown category** \`${fm.category}\`. Valid: ${POST_CATEGORIES.map((c) => `\`${c}\``).join(", ")}`,
				})
			}
		}

		// Add hyperlink suggestions as inline comments
		for (let i = 0; i < hyperlinkResults.length; i++) {
			const post = posts[i]!
			const links = hyperlinkResults[i]!
			for (const link of links.slice(0, 5)) {
				const bodyOffset = post.content.split("\n").findIndex((l: string) => l.trim() === "---" && post.content.indexOf(l) > 0) + 1
				inlineComments.push({
					path: post.filename,
					line: bodyOffset + link.line,
					side: "RIGHT",
					body: `🔗 Consider linking **${link.keyword}**: \`[${link.keyword}](${link.url})\``,
				})
			}
		}

		if (inlineComments.length > 0) {
			yield* github.postReview(owner, repo, prNumber, pr.headSha, inlineComments).pipe(
				Effect.catch(() => Effect.void)
			)
		}

		// 10. Manage labels
		const labelsToAdd = ["blog-content"]
		if (posts.some((p) => p.frontmatter.published === false)) labelsToAdd.push("draft-post")
		if (scheduleMatch) labelsToAdd.push("scheduled")
		yield* github.addLabels(owner, repo, prNumber, labelsToAdd)

		// Remove stale labels
		const hasDraft = posts.some((p) => p.frontmatter.published === false)
		if (!hasDraft && pr.labels.includes("draft-post")) {
			yield* github.removeLabel(owner, repo, prNumber, "draft-post").pipe(Effect.catch(() => Effect.void))
		}
		if (!scheduleMatch && pr.labels.includes("scheduled")) {
			yield* github.removeLabel(owner, repo, prNumber, "scheduled").pipe(Effect.catch(() => Effect.void))
		}
	})
