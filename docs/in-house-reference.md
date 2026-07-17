# In-house reference — jesssullivan.github.io

Ground truth for the blog's design system, in-house packages/repos, and as-built engineering patterns. Verified 2026-07-17 against `jesssullivan.github.io.worktrees/tin-2903-reader` (branch `jess/tin-2903-observatory-ledger-reader`) + installed `node_modules`; `origin` = GitHub direct on both worktrees.

## Design system

### Pins (installed, not manifest range)

| Package | package.json | Installed | npm `latest` | npm `next` |
|---|---|---|---|---|
| `@skeletonlabs/skeleton` | `^4.15.2` | 4.15.2 | 4.15.2 | 5.0.0-next.12 |
| `@skeletonlabs/skeleton-svelte` | `^4.15.2` | 4.15.2 | 4.15.2 | 5.0.0-next.12 |
| `tailwindcss` | `^4.2.2` | 4.2.2 | — | — |
| `svelte` | `^5.55.4` | 5.55.4 | — | — |
| `@sveltejs/kit` | `^2.61.1` | 2.61.1 | — | — |
| `vite` | `^8.0.14` | 8.0.14 | — | — |
| `@floating-ui/dom` | `^1.8.0` (direct, since M1.3) | 1.8.0 | — | — |
| `@tummycrypt/vite-plugin-a11y` | `^0.2.2` | 0.2.2 | — | — |
| `@tummycrypt/vite-plugin-skeleton-colors` | `^0.2.2` | 0.2.2 | — | — |

**4.15.2 vs "5.15.2":** `5.15.2` was never published for either Skeleton package (npm `versions` tail = `4.15.1, 4.15.2, 5.0.0-next.0…next.12`). 4.15.2 is `latest`-stable and the pin everywhere; v5 exists only as prerelease on the `next` tag (`5.0.0-next.12`). Ruled by TIN-2222 (Done, "correct the Skeleton-v5 phantom, stay pinned 4.15.2") and TIN-1541 (2026-05-18: "5.14.2 does not exist; latest=4.15.2; next=5.0.0-next.9"). Treat "5.15.2" as a misremembering of "4.15.2 on the v5-next track".

### Component usage (grep `src/`)

| Component (`@skeletonlabs/skeleton-svelte`) | Call sites |
|---|---|
| `Avatar` | `src/routes/making/+page.svelte`, `src/routes/signal-boosts/+page.svelte`, `src/routes/THIRD-PARTY-LICENSES/+page.svelte` |
| `AppBar`, `Dialog`, `Navigation` | `src/routes/+layout.svelte` |
| `Popover`, `Portal` | `src/lib/components/ThemeSwitcher.svelte` |

No other `@skeletonlabs` imports in `src`. Reader components import zero Skeleton components; `ObservatoryMasthead`'s canvas-hover tooltip positions via direct `@floating-ui/dom` `computePosition` against a virtual element at the cursor (see tooltip pattern below).

### Themes (`src/app.css`)

5 themes: `pine`/`catppuccin`/`rose` are stock (`@skeletonlabs/skeleton/themes/*`); `pride`/`trans` are hand-authored (`src/lib/styles/themes/{pride,trans}.css`, ~213 lines each). Metadata in `src/lib/theme.svelte.ts` `THEMES` const:

| id | label | swatch |
|---|---|---|
| `pine` | TSS | `#8a9a5b #9b4dca #e2e8f0` |
| `rose` | Rose | `#fb7185 #fdba74 #a78bfa` |
| `catppuccin` | Catppuccin | `#8839ef #fe640b #40a02b` |
| `pride` | Goth | `#E40303 #FF8C00 #732982` |
| `trans` | xoxd | `#5bcefa #f5a9b8 #ffffff` |

Selection → `localStorage['skeleton-theme']`, applied via `[data-theme]`; color mode via `[data-mode]` + `@custom-variant dark`. `ThemeSwitcher.svelte` is the UI (default `pine`).

### In-house vite plugins

`@tummycrypt/vite-plugin-a11y@0.2.2` (build-time WCAG check of Svelte components; dep `magic-string`) and `@tummycrypt/vite-plugin-skeleton-colors@0.2.2` (on-demand Skeleton v4 color-pairing CSS utilities; dep `culori`). Source: `github.com/tinyland-inc/tinyland.dev`, `packages/vite-plugin-{a11y,skeleton-colors}`; consumed here via npm. Editing that source is inert without publish+bump (registry split-brain applies to the bazel-consuming path; npm path needs a version bump either way).

### Tooltip / popover house pattern (M1.3-relevant)

`skeleton-svelte@4.15.2` re-exports both via `dist/index.d.ts`:
```
export * from './components/popover/index.js';
export * from './components/tooltip/index.js';
```
`Tooltip` is `Object.assign(Root, {...})` — the **bare `<Tooltip>` is the root** (same convention as the live `<Popover>` in ThemeSwitcher), children are `Tooltip.{Trigger, Positioner, Content, Arrow, ArrowTip, Provider, Context}`. Full prop surface: `TooltipRootProps` (`dist/components/tooltip/anatomy/root.svelte`).

Minimal shape (not yet in repo; root is the bare component, not `Tooltip.Root`):
```svelte
<script lang="ts">
  import { Tooltip } from '@skeletonlabs/skeleton-svelte';
</script>
<Tooltip openDelay={200}>
  <Tooltip.Trigger>hover me</Tooltip.Trigger>
  <Tooltip.Positioner>
    <Tooltip.Content>tooltip text</Tooltip.Content>
  </Tooltip.Positioner>
</Tooltip>
```

In-repo reference = `ThemeSwitcher.svelte`: `<Popover>` root, `Popover.Trigger`, `<Portal>`, `Popover.Positioner`, `.Content/.Title/.Description/.Arrow/.ArrowTip`.

Positioning chain: `Skeleton Tooltip/Popover → @zag-js/{tooltip,popover} → @zag-js/popper → @floating-ui/dom`. Two ruled tooltip patterns (helm adjudication 2026-07-17):

1. **DOM-anchored** tooltip/popover → the Skeleton compound component (`import { Tooltip | Popover } from '@skeletonlabs/skeleton-svelte'`; bare component = root, children `.Trigger/.Positioner/.Content/...`). Reference call site: `ThemeSwitcher.svelte`.
2. **Canvas/virtual-point** tooltip (no DOM trigger exists) → direct `@floating-ui/dom` `computePosition` with a virtual element + `offset/flip/shift` middleware — the same engine Skeleton uses via `@zag-js/popper`, per the TIN-608 Floating-UI-Attachments cookbook. Precedent: `ObservatoryMasthead.svelte` `positionTip()` (M1.3). Direct usage requires the dep declared in `package.json` (done: `^1.8.0`) — never lean on the transitive copy.

### v5-beta posture

Fully on 4.15.2 stable — no v5 code, no v5 CSS-var renames, no local v5 validation landed. No `~/git/skeleton*` clone. Migration tickets are Backlog: TIN-603 (install `5.0.0-next.4` on a worktree, validate themes/components), TIN-604 (Pride/Trans OKLCH themes vs v5 theme-spec PR #4353: renamed CSS vars, new `accent-color`/`corner-shape`), TIN-607/609 (dev-env/Discord, not started). TIN-608 (Done): `floating-ui-svelte` archived 2026-01-29, Zag owns positioning. When v5 ships to `latest`, most-exposed here = (1) hand-authored OKLCH themes `pride.css`/`trans.css` vs renamed CSS-var spec, (2) `Popover`/new `Tooltip` compound call sites (Zag anatomy most likely to shift). Until a TIN-603-class pass runs, 4.15.2 is the only supported target. TIN-606's "27 of 50 Zag machines used" figure is unverified here (installed `node_modules/@zag-js` ≈42 packages, many shared infra not machines).

## In-house packages & repos

### Blog workspace packages (`packages/*`)

| Package | Version | Role | Notes |
|---|---|---|---|
| `@blog/pulse-core` | 0.0.1 | Pulse event contract, lifecycle FSM, in-memory broker mock | Subpaths `. ./schema ./fsm ./broker ./publisher ./policy ./fixtures`. `schema/event.ts`: `PulseEventSchema`, `SalienceSchema` (`less-noteworthy`\|`noteworthy`, display/rank-only per 2026-07-05 ruling — never an auth/AP-delivery gate), `salienceRank()`. `broker/projection.ts` sorts `occurredAt` desc then `salienceRank`. No `blend` export here. |
| `@blog/pulse-client` | 0.0.1 | Durable client contract scaffold | Subpaths `. ./drafts ./identity ./media ./storage`; deps `@blog/pulse-core` 0.0.1. |
| `@blog/agent` (dir `blog-agent`) | 0.1.0 | Agentuity agent surface | Deps `@agentuity/{core,runtime}`, `@anthropic-ai/sdk`, `@octokit/rest`; `src/agents/{commands,review}.ts`, `src/cli.ts`. |

`src/lib/stream/blend.ts` (reader worktree only) is the actual blend logic — imports `PublicPulseItem` from `@blog/pulse-core/schema` and `post.editorial_tier` from `$lib/types`; not a pulse-core export.

### bazel-registry modules (`tinyland-inc/bazel-registry`)

Local clone `~/git/bazel-registry` on branch `registry/tin-2786-content-0.3.1` (HEAD `2d3ea08`, ahead of `origin/main` `6ec6b63`) — unmerged promotion branch, not authoritative HEAD.

| Module | Registry latest | tinyland.dev pin | State |
|---|---|---|---|
| `tummycrypt_tinyland_auth` | 0.7.1 | 0.6.0 | BEHIND (0.7.1 fixes TIN-2781 TOCTOU) |
| `tummycrypt_tinyland_invitation` | 0.2.5 | 0.2.3 | BEHIND (0.2.5 fixes TIN-2780 dup service) |
| `tummycrypt_tinyland_content` | 0.3.2 | 0.2.5 | BEHIND |
| `tummycrypt_tinyland_content_types` | 0.3.1 | 0.2.4 | BEHIND |
| `tummycrypt_tinyland_security` | 0.3.2 | 0.3.1 | BEHIND |
| `tummycrypt_tinyland_activitypub` | 0.3.1 | 0.3.1 | CURRENT |

~55 other `tummycrypt_tinyland_*` modules on registry (auth_pg/auth_redis/admin_*/analytics/calendar/forms/logging/otel/rate_limit/threat_detection/websocket_metrics/…). **Consumption rule (verified `~/git/tinyland.dev/MODULE.bazel`):** the registry pin is sole build authority; editing `tinyland.dev/packages/*` source is inert — flow is release → promote → pin-bump. Registry wave is done upstream; tinyland.dev live pins are still pre-fix.

### Org repos (reference material)

| Repo | Role | Local clone / caveat |
|---|---|---|
| `tinyland.dev` | Hub SoT (managed blog content, projections, pulse snapshot) | `~/git/tinyland.dev`. TWO remotes: `origin`→yoga STALE (`origin/main` `49aa4888e`), `github`→GitHub TRUTH (`github/main` `c64098abc`); local HEAD matches `github`. Diff against `github`, not `origin`. |
| `lab` | Sops/secrets conventions, Nix-first infra, `just` entrypoint | `~/git/lab`, single `origin`→GitHub. `.sops.yaml` + `scripts/validation/sops-runtime-secret-audit.py`. Own AGENTS.md flags docs transitional; SoT order `justfile > inventory/* > nix/* > playbooks > docs/ARCHITECTURE.md`. |
| `GloriousFlywheel` | Cache-first bazel build/runner substrate backing blog CI | `~/git/GloriousFlywheel` on `codex/tin-2763-pr-b` (`e5a9c167`), NOT main (`origin/main` `3aa22ac8`). ~10 `GloriousFlywheel-*` sibling clones = per-task worktrees; don't conflate. Repo split: `docs/` (internal) vs `public-docs/` (conservative) vs `examples/` (alpha). |
| `prompts-enqueue` | Prompt library, git-only authority | `~/git/prompts-enqueue` on main, HEAD `0079c0e` = `origin/main` (current). |
| `bazel-registry` | BCR for `@tummycrypt` packages | See above; on branch not main. |

Other tinyland-inc repos (via `gh repo list`, not inspected): `blahaj`, `tinyland.media`, `finances`, `outbot-ci`, `fuzzy`, `tinyland-fingerprint`, `rockies.tinyland.dev`, `signals.tinyland.dev`, `transcendsurvival.org` (single-s repo name, distinct from live apex `transscendsurvival.org` double-s), etc.

### Personal repos serving the blog

| Repo | Role | Local state |
|---|---|---|
| `jesssullivan.github.io` | This spoke; Svelte content + `packages/*` | `~/git/jesssullivan.github.io` + `-footer-fix` sibling + `.worktrees/tin-2903-reader` (agent-active). |
| `jesssullivan-infra` | Shadow-preview receiver + OpenTofu IaC | `~/git/jesssullivan-infra` on `feat/tinyland-goo-nix-anchor` (`ab37d9c`), behind `origin/main` `4feff84`. 5 task sibling clones. |
| `spear_resumes` (GH `spear-resumes`) | `rules_tectonic`/XeLaTeX CV pipeline → blog `/cv` | `~/git/spear_resumes` on main. ~16 lane dirs on disk (generic, cra, cra_scepter, str, une, mitre, mitre_{agentic,decision,embsec,network}, cmcc, lightmatter, adi_{aiml,algorithms,audio,platform}) + `study_*` — far more than the "5-lane" summary. Blog `/cv` consumes ONLY `generic`: `static/cv/BUILD.bazel` `sync_pdfs` maps `@spear_resumes//generic:{resume,precis,cv}` → `jess_sullivan_{resume,precis,cv}.pdf`, CI-gated by `build-cv.yml` + `assert_pdfs_synced.mjs`. |
| `Great-Falls-Tool-Bus/greatfallstoolbus.org` | Footer-provenance reference | `~/git/greatfallstoolbus.org`. `src/lib/build-info.ts`: `PUBLIC_BUILD_SHA` injected only by container-image CI from `github.sha`; `normalizeSha()` validates 7-64 hex else `''`; footer fail-quiet (absent sha → no provenance line). Reusable for blog footer build-provenance. |

### Naming traps

- **`prompt-pulse`** (tinyland-inc: `prompt-pulse`, `-mirror`, `-tui`) is a prompt-library/TUI product, UNRELATED to blog `@blog/pulse-core`/`pulse-client` (content-federation event stream). Pure name collision.
- **`transcendsurvival.org`** (GH repo, single-s) ≠ live apex `transscendsurvival.org` (double-s).
- **Local origin-mirror trap** — many `~/git` clones' `origin` is a stale yoga mirror; prefer the GitHub-pointing remote (confirmed for `tinyland.dev`).

## Engineering patterns

### Bazel SSOT boundary

Bzlmod consumer module `jesssullivan_github_io` v0.0.1 (`MODULE.bazel`). Registries (`.bazelrc`): `tinyland-inc/bazel-registry` → `bcr.bazel.build`. Deps: `bazel_skylib 1.8.2`, `platforms 1.0.0`, `aspect_bazel_lib 2.22.5`, `rules_nodejs 6.7.3`, `aspect_rules_js 2.9.1`, `spear_resumes 0.2.0` (git_override, SSH deploy key), `rules_tectonic 0.2.1`. Toolchains: node `22.13.1`, pnpm `9.15.9`. `npm_translate_lock` consumes `pnpm-lock.yaml` as Bazel's external graph only — **the app itself stays npm/package-lock based** (explicit MODULE.bazel comment).

**Cache-backed, NOT full RBE.** All gates run `scripts/bazel-cache-backed.sh test //:<target>` under `--config=ci-cached` (`--jobs=1`, `NODE_OPTIONS=--max-old-space-size=1024`, `local_test_jobs=1` for the ARC runner memory limit). `--config=executor-backed` (`spawn_strategy=remote,worker,sandboxed,local`) is opt-in behind an explicit REAPI proof. `build:gloriousflywheel` aliases `ci-cached`. Local disk cache `~/.cache/bazel-jesssullivan-github-io`.

Test targets (`BUILD.bazel`, all tagged `gloriousflywheel-rbe-candidate`): `vitest_unit_tests`/`types_unit_tests`, `blog_agent_node_tests`, `workspace_package_checks`, `sveltekit_check` (`web-check-runtime-authority`), `sveltekit_vite_build_smoke` (`web-build-runtime-authority`), `playwright_chromium_smoke`/`_e2e` + `puppeteer_chromium_smoke` (`web-browser-runtime-authority`), `bazel_graph_hygiene`, `bazel_cache_backed_contract`, `shadow_preview_digest_contract` (sh_test contract-testing `.github/workflows/shadow-preview.yml` as a Bazel target). "Bazel-first evidence" = npm `remote:{check,test,e2e}` scripts, thin shells over the wrapper.

**NOT bazel:** production build is npm/vite/tsx — `dev` (vite dev), `prebuild` (tsx ingest/search/images/mermaid/stats/tag-graph/gallery/pulse-validate), `build` (vite → adapter-static), `postbuild` (redirects + pagefind + dir-index). `lint`/`format` = eslint/prettier direct. The vite build is separately re-exercised as `sveltekit_vite_build_smoke`, but the shipped artifact comes from the npm chain.

### FP exemplars (pure, DOM-free, deterministic)

| File | Exports | State |
|---|---|---|
| `src/lib/reader/ledger.ts` | `partitionLedger`, `buildConstellationGroups`, `postToConstellationNode` | Committed on reader branch (`b47be05`) + uncommitted working-tree edits (mid-change, mtime 17 Jul 08:22); **ABSENT on `origin/main`**. |
| `src/lib/stream/blend.ts` | `blendStream`, `compareStreamItems`, `postToStreamItem`, `pulseItemToStreamItem` | Harvested verbatim from #217 donors (`e7ed2c2`); **ABSENT on `origin/main`**; present on `origin/feat/blog-tiered-reader-ui`. In reader worktree it is carried-but-unconsumed (its `/stream/+page.ts` consumer lives on #217, not here). |

`ledger.ts` invariants (each has a named test in `ledger.test.ts`): total order `byDateDescThenSlug` (date-desc, slug tie-break, input-order-independent); tier read strictly from `editorial_tier` frontmatter (never inferred from featured/category/tags/length/recency); N-in→N-out into exactly one of `{noteworthy, lessNoteworthy, unclassified}` (no silent cap); `buildConstellationGroups` honest `basis: category|tag|pulse` (no embedding/similarity), post groups key-ordered, pulse group preserves producer order + appended last + never re-ranked + omitted when empty. `blend.ts` (`blend.test.ts`): reverse-chron, noteworthy floats within equal date (weight 0/1, mirrors #217 comparator), stable `id` tie-break, handles empty inputs.

**Fail-soft loaders:** `src/routes/+page.ts` — posts from build-time static index; pulse snapshot in `try/catch` → empty rail, page still renders. `src/routes/blog/[slug]/+page.ts` — post absent from glob → `brokerOnly:true`/`content:null` fallback, not a throw (TIN-2786 shape). `prerender = true` inherited from `+layout.ts`.

**Conditional-spread optional-field idiom** `...(x ? { x } : {})` (shared with hub projection): `src/lib/tinyland/blogBrokerStream.ts:171-172,294`, `src/lib/components/BlogArticle.svelte:96-97`, `src/lib/pulse/lab/compose.ts:76`.

### SvelteKit remote functions — unused

Zero `from '$app/server'` imports, zero `*.remote.ts`, no `experimental.remoteFunctions` in `svelte.config.js`/`vite.config.ts`. Architecturally incompatible: production ships `adapter-static` + `prerender = true` (`adapter-node` only under `BLOG_ADAPTER=node`, the tailnet shadow image); a frozen static export can't serve `command`/`form`/runtime `query`. The one candidate (broker/pulse hydration) is already solved via build-time static snapshot (`loadPulseSnapshot`) + fail-soft loader + CF Worker proxy for the dynamic broker. Not a live option without flipping prod to `adapter-node`.

### Ruled invariants to carry forward

- Tier never inferred — only explicit `editorial_tier` (posts) / `salience` (pulses).
- Tier is reader-weight/IA only — never an authorization, privacy, or AP-delivery signal (`docs/blog-editorial-taxonomy-2026-07-03.md`); same for `SalienceSchema` (2026-07-05 ruling).
- No embedding/similarity — grouping basis is `category|tag|pulse`.
- Producer order preserved for the pulse stratum — never re-ranked.
- N-in→N-out — partition/group never silently caps.
- Donors lifted verbatim — #217 primitives (TierBadge, blend, pulse cards) harvested as-is.
- Post bodies untouchable — editing `src/posts/*.md` reds every tinyland.dev PR via the managed-mirror parity gate; `tsx scripts/ingest-tinyland-posts.mts --check` prebuild enforces spoke==managed.
- Fail-soft on absent fields — loaders degrade, never throw.
- Commit prose describes what renders, not intent.