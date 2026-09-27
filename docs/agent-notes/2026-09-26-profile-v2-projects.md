# Profile v2: interactive projects and About

Date: 2026-09-26 (America/New_York). Goal 4 implementation in the existing
`jess/profile-v2-map` worktree. Reviewable source only: no commit, push,
merge, remote apply, or publication was authorized for this lane.

The latest corrected-source static build and staging receipt is
[the final review note](2026-09-26-profile-v2-final-review.md).

## Directed research and authorities

Read the applicable `AGENTS.md`, the existing About page and regression
assertions, the preserved strict profile schema/loader (`7581276`, `a13a56d`),
and the producer's profile contract, claim ledger, takeover plan and xoxd
source-design note before implementation.

The producer remains the authority for claims and public visibility:
`spear_resumes/profile/facts.toml`, governed by its ledger and `generic/`.
This consumer does not edit claims, infer public status, or fabricate activity.
Existing xoxd.ai is the design source, not a downstream site to redesign.
Its reviewed theme pin is `4fd966f8ed1b217b9a1658be34ce9c541f338c98`:
PAL2/PAL2a red/slate families, Fira Code headings, Inter body, square borders.
The profile scope uses those exact values; the rest of the blog retains its
existing theme. There are no external font requests.

The reviewed `profile/out-v2/profile.v1.json` is copied into the blog through
`scripts/sync-profile-v2.mts`, which requires an explicit source file and
validates it before writing. Optional `--timeline` copies the four reviewed
timeline SVGs from the adjacent producer presentation directory. The legacy
facts/image Bazel sync remains the release authority. An explicit `--legacy`
path also permits an exact local copy of the generated legacy artifacts;
all editorial fields must match the validated v2 projection before any write.

Snapshot provenance:

- Current source revision: `d42cf1197c1590ab09383d31e6aaba643d980bb7`,
  carrying the direct corrections from signed source
  `d2f72574318023c2361a493a5a7fa263dd289af0`.
- Evidence fetched: `2026-09-27T00:11:21Z`.
- Corpus SHA-256: `238d08134814c34d0f5c1dfab485b3e442dbdf0dfcffad42763e56adfd87f6b1`.
- Producer JSON SHA-256: `c4299d47dda82f6854c5d5fd6eb4863c7c7545668f48e63913de8db76ceda978`.
- Saved consumer JSON SHA-256: `94020a4a54f6cf74131e17f878ecf65327e66b09013122db3a3b31e77025d584`.
  Schema parsing normalizes object field order; parsed values are deeply
  equal to the producer JSON.
- Legacy facts SHA-256: `7c4ca82372eaa1d7161385a0979cebb6d24329091bd19a58e5949015a84161ba`.
- Public projection: 60 project records, 79 edges, 15 latest upstream
  merge records, 13 language histories, four roles and five ventures.
  These are audit counts, not profile counters.
- Repository and upstream coverage is complete. Activity and language
  coverage is partial. Language observations are presently confined to
  September 2026; earlier unavailable periods remain visible as unavailable.
  The activity window is 2025-09-29 through 2026-09-27.

## Implemented behavior

`/projects` has four evidence views, with the map also embedded in `/about`.

1. **Project similarity.** Exact supplied x/y coordinates receive a uniform
   positive scale into a square SVG. Filtering never fits a new layout or
   displaces marks. Equal-area category shapes supplement color. Edges and
   neighbor values come only from the supplied shared-similarity graph.
   The methods disclosure states the 0.6 TF–IDF cosine + 0.4 Jaccard metric,
   union of qualifying top-three connections, 0.15 threshold, `1-S`
   dissimilarity, and the pinned fitter's squared-affinity behavior.
   Axes, distant-cluster distances, and mark size carry no ranking claim.
2. **Observed language history.** Full coverage strip, month selector,
   active-day bars and complete history table. Unknown stays unknown;
   partial observations are lower bounds; actual month lengths set the
   denominator. Current code shares appear only in the project detail,
   explicitly separated from history and proficiency.
3. **Merged upstream work.** Exact calendar positions for the latest
   verified merge per project, with relationship shape/label and actual
   pull-request links. Recency does not imply contribution depth.
4. **Public activity rhythm.** UTC Monday weeks and separate commit, PR,
   review and issue observations. Active, observed-inactive, unknown and
   outside-window days remain distinct. Overlapping activity is not summed
   into an invented total. Selectors and tables expose the full window.

The map supports mouse hover, click, touch, arrow-key movement between
marks, Home/End, Escape/reset, zoom, category filters, search, a native
project chooser and an accessible catalogue. Details are docked beside
the map on desktop and flow below it on mobile; immediate mobile selection
text links to the details. Public links appear only when provided by the
validated producer; unlinked descriptions stay explicitly unlinked.
HTML controls are at least 44px high. Dense history plots scroll within
their labeled regions; they do not force page-wide overflow. Native SVG,
SSR text and HTML tables remain available without JavaScript.

`/about` preserves approved identity/header prose, every role and venture,
the offline-year assertion, Beyond Code, community, publications, links,
owned learning/IDL images, JSON-LD and blog post lists. Its role and venture
copy is pinned to the validated saved projection, with the existing facts
surface as the optional-field fallback. The new timeline uses desktop
960×713 and compact 390×1068 SVGs; undated ventures remain outside the axis.
The original `/about#projects` and `/about#experience` anchors are retained.

## Runtime fallback and integration

The initial render always uses the validated saved projection. The browser
tries `https://jess.clients.xoxd.ai/v1/profile.v1.json` with the preserved
four-second timeout, retries manually or hourly while visible, and adopts
only schema-valid data that is not older than the current snapshot.
Failed requests leave the last valid display intact. The UI identifies
saved versus live evidence and shows its actual fetched time; it never
labels a fallback response as fresh live data. The download is explicitly
the saved fallback even when the current view is newer.

The blog CSP now permits only that exact new service origin in `connect-src`.
A browser test requires an actual request and successful live replacement,
so a CSP-blocked request cannot make the fallback tests appear sufficient.
The primary service itself was unavailable during this implementation.

Two existing toolchain issues needed narrow integration fixes:

- Vite 8 rejects direct JSON imports from its public asset directory in
  development. Both projection and legacy facts use explicit `?raw` imports
  followed by parsing; legacy facts values and API are unchanged.
- `@tummycrypt/vite-plugin-a11y` 0.2.2 inserted diagnostic CSS comments
  into HTML tag names when it could not resolve a CSS variable. Its existing
  validation/reporting transform still runs, but its rewritten source is
  discarded. No accessibility rule or reporting hook is disabled. Measured
  semantic contrast and actual browser behavior are separately tested.

Public Bazel filegroups include the new saved projection and SVGs without
adding private module dependencies to public checks. No dependency or
lockfile changes were needed.

## Verification and review artifacts

- `npx vitest run src/lib/profile`: 36 passing tests after the direct claim
  correction. These cover strict
  schema behavior, provenance hash, unchanged approved claims, theme text
  contrast, exact geometry, equal area, directional keyboard navigation,
  supplied edges, coverage semantics, calendar boundaries and loader errors.
- Scoped ESLint passes with zero warnings. Formatting is checked for the
  changed implementation, tests and sync script.
- `svelte-check`: zero errors; one existing warning in
  `src/routes/blog/+page.svelte` about capturing the initial `data` value.
- Chrome regressions: 39 passed initially, including all new profile tests,
  claims/links checks and sidebar tests. The two original banner-scroll
  tests raced SSR before the scroll listener hydrated; after waiting for
  hydration and polling the original opacity assertion, both pass.
- New browser cases verify fallback, exact coordinates after filtering,
  keyboard/touch selection, invalid-live rejection, valid-live adoption
  through CSP, and all four views plus complete catalogue without JavaScript.
- `npm run test:bazel-graph-hygiene`: passes.
- Final strict build passes with
  `PUPPETEER_EXECUTABLE_PATH='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' npm run build`.
  All 41 Mermaid diagrams are available (40 rendered, one cached, none
  skipped), adapter-static completes, Pagefind indexes 142 pages, and 302
  directory aliases are generated. Earlier preview builds used the repo's
  optional Mermaid fallback; the final build uses strict prerendering.
- Chrome against the actual static `build/` files passes all eight
  route/theme/viewport combinations: `/projects` and `/about`, light/dark,
  1440px/390px. Every case returns HTTP 200, renders the 60 supplied marks,
  has zero page errors and no page-wide overflow. Static-build interaction,
  live response adoption and a JavaScript-disabled four-view/catalogue
  check also pass. `test-results/profile-v2/static-browser.json` records
  these results; adjacent PNGs are the final static-build captures.
- The final working-tree diff contains no incidental generated blog stats,
  post-image rewrites, tag-graph changes or publication-hold timestamps.
  Those prebuild outputs were restored to their initial state.

Local visual proof (ignored, intentionally not public artifacts):

- `test-results/profile-v2/`: projects, map and About captures at real
  1440px and 390px Chrome viewports in both color modes, plus JSON receipts.
- `test-results/profile-history/`: twelve individual history-chart captures
  and `browser-checks.json`, including touch, keyboard, evidence links and
  full tables. Screenshot-backed fixes included adjacent month-label
  collisions and a visually hidden span causing horizontal overflow.
- Parent can review the existing local development server at
  `http://127.0.0.1:5188/projects` and `/about`.

`npm run test:production-health` is **not green**: public DNS, HTTPS,
canonical/slash routes and broker coverage checks pass, but the currently
published apex and www blog both fail hydration because broker post 1's
reviewed component contains module statements. The existing Cloudflare
Insights script is also blocked by the existing script CSP. Shadow source
and noindex checks report the already served pre-v2 artifact. This lane has
not published anything, so these observations are existing serving state,
not proof against or for this candidate.

## Remaining boundaries

Jess's visual review and the parent's final integration/release gates remain
outstanding. The service requires its separate producer/runtime work before
live data can be demonstrated against the actual endpoint; successful local
live tests use a validated response fixture. No claim that live infrastructure
or production publication is complete is made. Remote GF/private-CV authority
checks were not dispatched from this lane.

## Independent review: multiple upstream PRs

The independent graph reviewer found a valid-input hydration failure in
the About embed: `merged_upstream` permits distinct PRs from the same
repository, but the list was keyed by repository before consolidation.
A valid live refresh could therefore trigger Svelte's `each_key_duplicate`.

The embed now derives `upstreamHistory(...).points`, sharing the full
timeline's latest-merge-per-repository selection and canonical PR URL.
No schema restriction, producer data, geometry or claim was changed.

The new browser regression explicitly validates a response with three PRs
from one repository, placing the latest first and an older higher-numbered
PR last. It asserts successful live adoption, one row per repository,
the correct latest date/link, and no page errors. It passes against both
the development server and the rebuilt static output. The static test uses
the repository's `playwright.bazel.config.ts`, an explicit Chrome executable
and isolated port 5190; it does not contact the actual service.

Focused verification after the repair: the 12 history tests and component
ESLint pass; the strict Vite build and postbuild pass using the existing
prerender cache; the new browser case passes in both environments. Receipts:
`test-results/profile-v2/multi-pr-{dev,static,build}.log`. Source changes for
this repair are limited to `ProfileExplorer.svelte`, the added regression
in `e2e/profile-v2.spec.ts`, and this note. No commit or publication.

## Direct claim correction propagated

Per Jess's later document review, the Cornell research bullet now names
Visipedia only: she never contributed to iNaturalist. The false clinical
business-stack/four-expansions bullet and the xoxd full-business-stacks
clause are gone. xoxd now reads `Operating as` from 2024, while independent
contracting remains 2017–present. The About heading renders `Operating as
xoxd.ai`; the source timeline has the same corrected role without an
inserted comma. The stronger, approved Merlin ownership summary remains.

The curated blog contained no assertion that FFT.js shipped inside Merlin.
Its real upstream contribution remains visible with its verified PR link;
the explanatory source comment no longer incorrectly lists FFT.js among
projects without a merged PR. Other project relationship labels remain
producer data. Packet-specific Boston wording and contributor-label edits
were deliberately not propagated to this public source.

After the producer's artifact barrier and root authorization, the existing
consumer script imported `profile/out-v2/profile.v1.json`, the four v2
timeline SVGs, and `profile/out/facts.json` with its entire SVG/image
manifest. No JSON or SVG claim strings were edited by hand. The sync's
mismatch check was exercised with signed corrected facts plus a stale v2
projection; it rejected them before any destination file changed.

All 19 legacy artifacts and four v2 timeline variants are byte-identical
to the producer. Repository records, exact coordinates, edges, merged
upstream evidence, language months and activity observations have identical
before/after hashes. The evidence fetch stays `2026-09-27T00:11:21Z`;
generation and claim-change times are `2026-09-27T03:37:57Z`. This was a
wording correction, not a new evidence fetch or graph fit.

Post-correction checks: 36 profile tests, focused claim/venture/upstream
browser cases, scoped lint, and Svelte checking pass (the single existing
blog warning remains). Fresh Chrome captures for both pages at 1440/390 in
both modes have no page errors or horizontal overflow. The updated claims
and timeline were visually inspected. Current previews and receipt are
under `test-results/profile-v2/source-corrections/`; `claims-propagation.json`
contains the source/consumer hashes and unchanged-evidence proof.

The initial static-build screenshots and receipts predate this claim
correction. The correction pass first used those fresh development captures;
the parent then requested the current-source static build and focused
verification recorded in [the final review](2026-09-26-profile-v2-final-review.md).
That current static receipt supersedes the initial artifacts for content
review. `MODULE.bazel` still pins the former private spear revision
`d7e854da67bf95652fc91c326708bb087430979b`; the parent must coordinate its
advance and private CV consistency before release, since that pin also
governs the generic PDFs. No commit, push, merge or publication was performed
by this lane.
