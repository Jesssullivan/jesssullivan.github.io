# Profile v2: current-source static review

Verified 2026-09-27 at 03:56 UTC (September 26, America/New_York), after the
independent review repair and Jess's direct claim corrections. This receipt
supersedes the earlier static-build evidence for content review. The parent
owns the preservation commit and every subsequent merge/publication step.

## Current candidate

Both public routes consume the corrected producer projection with source
revision `d42cf1197c1590ab09383d31e6aaba643d980bb7`, carrying signed source
correction `d2f72574318023c2361a493a5a7fa263dd289af0`. Evidence was fetched
at `2026-09-27T00:11:21Z`; corrected claims were generated at `03:37:57Z`.
The pre/post-copy hashes still prove unchanged measured coordinates,
repository records, edges, upstream evidence and language/activity data.

The corrected research, client and operating-as wording is present in the
current built About page. The FFT.js upstream proof remains; the removed
iNaturalist association and false client-expansion claims do not. About's
multiple-PR handling retains the independently reviewed latest-merge fix.

## Exact verification

Passed:

1. `PUPPETEER_EXECUTABLE_PATH='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' npm run build`
   with strict Mermaid prerendering: all 41 diagrams cached, none skipped;
   adapter-static succeeds, Pagefind indexes 142 pages, and 302 directory
   aliases are generated.
2. `npm run test:bazel-graph-hygiene` after the root/public-profile filegroup
   changes.
3. Six focused Chrome cases against this exact `build/` output using the
   repository's `playwright.bazel.config.ts`, explicit Chrome path, and port
   5190: every role, ventures including Operating as, verified upstream PR
   links, retired-claim exclusion, saved fallback with keyboard/touch
   selection, and all four views/catalogue without JavaScript.
4. Direct static captures of `/about` at 1440px dark and `/projects` at
   390px light: HTTP 200, all 60 supplied project marks, zero page errors,
   no page-wide overflow, and the corrected About text visibly present.
5. Built projection and legacy facts bytes equal their current committed-
   candidate source copies. Formatting and `git diff --check` pass. No
   unrelated generated image, stats, tag-graph or hold-timestamp changes
   remain in the candidate.

The earlier 36 unit tests, seven focused corrected-source browser tests,
scoped lint and Svelte checks remain applicable. No unrelated functional
suite was rerun. The full prior implementation review and source correction
history are in [the implementation note](2026-09-26-profile-v2-projects.md).

Current artifact SHA-256 values:

| Artifact | SHA-256 |
| --- | --- |
| `build/about.html` | `384a7ef8e88a5779f43d8214b6949a0ff4ba97f2d85ff09e50294ffc9b14c524` |
| `build/projects.html` | `fe0b5c826a1e9ae4a54cfa3e5f9529a2c612f67639bffbc115d1ec0327953d6d` |
| `build/profile/profile.v1.json` | `94020a4a54f6cf74131e17f878ecf65327e66b09013122db3a3b31e77025d584` |
| `build/profile/profile.v1.provenance.json` | `a75982e05f361c8284050c0337ef130e7d4072c339f3e5d4653c68ae1f4d1829` |
| `build/profile/facts.json` | `7c4ca82372eaa1d7161385a0979cebb6d24329091bd19a58e5949015a84161ba` |

Ignored local receipts are in `test-results/profile-v2/`:
`current-static-build.log`, `current-bazel-hygiene.log`,
`current-static-routes.log`, and `current-static/receipt.json`. The last
also records all four timeline SVG hashes; adjacent PNGs show the current
static pages and Experience/Ventures crops. The full eight-mode/viewport
corrected-content capture set remains in `source-corrections/`.

## Remaining release gates

`MODULE.bazel` and the private CV pin are unchanged. The private spear pin
is still `d7e854da67bf95652fc91c326708bb087430979b`; advancing it and proving
private CV consistency is the parent's coordinated release work. The actual
live profile service, Jess's LOOK, and the previously reported public-blog
health issue remain separate gates. No TIN-4971 repair was duplicated.

Only owned task files are staged for the parent. No commit, push, merge,
deployment, or public claim of completion was performed by this lane.
