import { Effect, Layer, ServiceMap } from "effect"

// ── Types ───────────────────────────────────────────────────

export interface HyperlinkSuggestion {
	keyword: string
	url: string
	line: number
	context: string
}

// ── Service definition ─────────────────────────────────────

export class HyperlinkService extends ServiceMap.Service<HyperlinkService, {
	readonly findUnlinkedKeywords: (body: string) => Effect.Effect<HyperlinkSuggestion[]>
}>()("HyperlinkService") {}

// ── Known keyword → URL mappings ────────────────────────────

const KEYWORD_MAP: Record<string, string> = {
	// Networking / Infrastructure
	"Tailscale": "https://tailscale.com",
	"tsnet": "https://pkg.go.dev/tailscale.com/tsnet",
	"WireGuard": "https://www.wireguard.com",
	"Aperture": "https://github.com/aperture-sh/aperture",

	// Languages / Tools
	"Dhall": "https://dhall-lang.org",
	"Nix": "https://nixos.org",
	"SvelteKit": "https://kit.svelte.dev",
	"Svelte": "https://svelte.dev",
	"Effect": "https://effect.website",
	"TypeScript": "https://www.typescriptlang.org",
	"Haskell": "https://www.haskell.org",
	"Python": "https://python.org",
	"Flask": "https://flask.palletsprojects.com",
	"Sharp": "https://sharp.pixelplumbing.com",

	// Platforms
	"GitHub Actions": "https://docs.github.com/actions",
	"Agentuity": "https://agentuity.dev",
	"Raspberry Pi": "https://www.raspberrypi.org",
	"Arduino": "https://www.arduino.cc",

	// Standards / Specs
	"AVIF": "https://aomediacodec.github.io/av1-avif/",
	"WebP": "https://developers.google.com/speed/webp",
	"NVMe": "https://nvmexpress.org",

	// Nature / Science
	"eBird": "https://ebird.org",
	"Merlin": "https://merlin.allaboutbirds.org",
	"iNaturalist": "https://www.inaturalist.org",
}

// ── Live implementation ─────────────────────────────────────

export const HyperlinkServiceLive = Layer.succeed(HyperlinkService)({
	findUnlinkedKeywords: (body: string) =>
		Effect.succeed(findUnlinked(body)),
})

function findUnlinked(body: string): HyperlinkSuggestion[] {
	const suggestions: HyperlinkSuggestion[] = []
	const lines = body.split("\n")

	for (const [keyword, url] of Object.entries(KEYWORD_MAP)) {
		const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
		const regex = new RegExp(`(?<!\\[)\\b${escaped}\\b(?!\\])(?!\\()`, "g")

		for (let i = 0; i < lines.length; i++) {
			const line = lines[i]!
			if (line.startsWith("```") || line.startsWith("    ")) continue
			if (line.includes(`[${keyword}]`)) continue

			if (regex.test(line)) {
				suggestions.push({
					keyword,
					url,
					line: i + 1,
					context: line.trim().slice(0, 100),
				})
				break
			}
			regex.lastIndex = 0
		}
	}

	return suggestions
}
