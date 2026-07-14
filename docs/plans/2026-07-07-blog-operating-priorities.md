# Blog Operating Priorities: 2026-07-07 To 2026-09-06

Date: 2026-07-07

Status: successor window. The prior 2026-05-06-to-2026-07-06 operating-priority
window has lapsed as of this truth-maintenance sweep; this entry date-stamps
the next one for `jesssullivan.github.io` so it does not lapse silently again.

## Carried Forward From The Prior Window

- Apex and `www` fully on Cloudflare Pages (2026-06-23 cut); GitHub Pages
  remains the rollback publisher only.
- `substrate-boundary` conformance validator ported (#213); `bazel-remote-gates`
  is now a required CI check.
- Editorial tier taxonomy landed (#212,
  `docs/blog-editorial-taxonomy-2026-07-03.md`).
- Pulse-core noteworthy salience tier landed (#215), display/ranking-only --
  recorded in the 2026-07-07 update to
  `docs/tinyland-pulse-broker-mutation-api-2026-05-03.md`.
- Blog webfinger AP self delegates to the hub, not the apex (#214, TIN-1456).

## Open Into This Window

1. **GFTB CD stabilization.** GloriousFlywheel CD went live for this repo's
   Bazel remote-gates lane at 2026-07-07T02:53Z; the first two applies failed
   at rollout. #219/#220/#221 (serialize tenant gates, drop the
   self-referential bazelrc executor cycle, retry-on-quota) are the first
   stabilization passes. Keep tightening `scripts/bazel-cache-backed.sh`
   retry/backoff behavior until GFTB CD is green across two consecutive
   cycles before calling this closed.
2. **AP-gating HYBRID doctrine (TIN-2511).** This repo is the static spoke --
   hub-authored content federates in, this repo does not deliver. Any Pulse
   or blog work that touches `admin.federation.deliver`-shaped concepts stays
   read-only/projection-only here; authoring the delivery gate itself is
   mothership (`tinyland.dev`) scope.
3. **Pulse payload-kind public projection.** `photo`, `git_summary`, and
   `listening` are schema-valid mutation kinds (see
   `packages/pulse-core/src/schema/payload.ts`) but are not yet in
   `M1_PUBLIC_PAYLOAD_KINDS`. Decide and document a public-projection contract
   for at least one of them before the window closes, or explicitly defer
   with a new dated note.
4. **GF enrollment posture.** `jesssullivan.github.io` is `enrolled: true` on
   the GFTB validator plane -- not a mint authority; TIN-2364 owns the
   org-grained tenancy mint gate upstream (cell-first: cell accepts an `org-`
   prefix before exchange mints). Track TIN-2364's rollout for any change to
   how this repo's Bazel remote-gates lane authenticates.
5. **`/stream` shadow surface.** The `transscendsurvival.org` shadow `/stream`
   ingestion route (#217) stays a shadow-preview concern
   (`cloudflare-pages-shadow.yml`, non-`main` branch deploys) until it has its
   own promotion decision. Do not fold it into the production apex path
   silently.

## Exit Criteria For This Window (Target: 2026-09-06)

- GFTB CD green for the `bazel-remote-gates` required check across at least
  two consecutive weeks with no manual gate re-runs.
- A public-projection decision recorded for payload kinds beyond
  `note`/`bird_sighting` (ship one, or defer explicitly with a new
  date-stamped entry).
- This entry superseded by the next date-stamped `docs/plans/` window instead
  of being left to lapse silently.
