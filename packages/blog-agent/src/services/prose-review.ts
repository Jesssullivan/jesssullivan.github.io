import { Effect, Layer, ServiceMap } from "effect"
import Anthropic from "@anthropic-ai/sdk"

// ── Types ───────────────────────────────────────────────────

export interface ProseReviewResult {
	suggestions: ProseSuggestion[]
	styleScore: number
	summary: string
	hyperlinkCandidates: string[]
}

export interface ProseSuggestion {
	line: number
	original: string
	replacement: string
	reason: string
}

// ── Service definition ─────────────────────────────────────

export class ProseReviewService extends ServiceMap.Service<ProseReviewService, {
	readonly reviewPost: (
		frontmatter: Record<string, unknown>,
		body: string,
		styleGuide: string,
	) => Effect.Effect<ProseReviewResult, Error>
}>()("ProseReviewService") {}

// ── Claude system prompt ────────────────────────────────────

const SYSTEM_PROMPT = `You are a writing style reviewer for Jess Sullivan's blog.
Your job is to review blog posts against the provided style guide and suggest improvements.

Focus on:
1. Voice and tone — does it match the author's established style?
2. Sentence rhythm — the author uses wildly varied sentence lengths as a signature
3. Punctuation — dashes, ellipsis, parentheticals are part of the voice
4. Openings and closings — should feel personal, not generic
5. Technical explanations — should use narrative discovery framing
6. Passages that feel "too formal" or "too AI-generated"

Return your review as JSON (no markdown wrapping):
{
  "suggestions": [
    {
      "line": <line number in the body>,
      "original": "<the original text>",
      "replacement": "<your suggested rewrite>",
      "reason": "<why this change improves the post>"
    }
  ],
  "style_score": <1-10, where 10 perfectly matches the style guide>,
  "summary": "<2-3 sentence overall assessment>",
  "hyperlink_candidates": ["<unlinked nouns that should have URLs>"]
}`

// ── Live implementation ─────────────────────────────────────

export const ProseReviewServiceLive = Layer.succeed(ProseReviewService)({
	reviewPost: (frontmatter: Record<string, unknown>, body: string, styleGuide: string) =>
		Effect.tryPromise({
			try: async () => {
				const client = makeClient()

				const userMessage = `<style-guide>
${styleGuide}
</style-guide>

<post-frontmatter>
${JSON.stringify(frontmatter, null, 2)}
</post-frontmatter>

<post-body>
${body}
</post-body>

Review this blog post against the style guide. Return JSON only.`

				const response = await client.messages.create({
					model: "claude-sonnet-4-20250514",
					max_tokens: 4096,
					system: SYSTEM_PROMPT,
					messages: [{ role: "user", content: userMessage }],
				})

				const text = response.content
					.filter((b): b is Anthropic.TextBlock => b.type === "text")
					.map((b) => b.text)
					.join("")

				const jsonMatch = text.match(/\{[\s\S]*\}/)
				if (!jsonMatch) {
					return {
						suggestions: [],
						styleScore: 5,
						summary: "Could not parse review response",
						hyperlinkCandidates: [],
					}
				}

				const parsed = JSON.parse(jsonMatch[0]) as {
					suggestions?: Array<{ line: number; original: string; replacement: string; reason: string }>
					style_score?: number
					summary?: string
					hyperlink_candidates?: string[]
				}

				return {
					suggestions: (parsed.suggestions ?? []).map((s) => ({
						line: s.line,
						original: s.original,
						replacement: s.replacement,
						reason: s.reason,
					})),
					styleScore: parsed.style_score ?? 5,
					summary: parsed.summary ?? "",
					hyperlinkCandidates: parsed.hyperlink_candidates ?? [],
				}
			},
			catch: (e) => new Error(`Prose review failed: ${e}`),
		}),
})

function makeClient(): Anthropic {
	const apiKey = process.env.ANTHROPIC_API_KEY
	if (!apiKey) throw new Error("ANTHROPIC_API_KEY not set")
	return new Anthropic({ apiKey })
}
