# Tinyland Static Post And Pulse Ingest

Date: 2026-05-10

This repo is the static consumer for `transscendsurvival.org`. Tinyland owns the
reviewed source projection.

2026-05-19 correction: this checked-in ingest path is fallback and migration
evidence only. The intended Cloudflare Pages display path is runtime broker
fetch from `hub.tinyland.dev`, with Tinyland-managed greymatter and Pulse policy
snapshots as the source of truth. Checked-in snapshots must not be treated as
the live blog federation mechanism.

## Checked-In Inputs

Post projection snapshot:

```text
static/data/tinyland/posts/public-snapshot.v1.json
```

Pulse projection snapshot:

```text
static/data/pulse/public-snapshot.v1.json
```

Both are copied from Tinyland reviewed static artifacts. They remain useful as
first-paint and regression fixtures, but canonical display now hydrates from the
public broker endpoints when available:

```text
https://hub.tinyland.dev/projections/jesssullivan-github-io/blog/broker-stream.v1.json
https://hub.tinyland.dev/projections/jesssullivan-github-io/pulse/public-snapshot.v1.json
```

## Post Ingest

Run:

```text
just ingest-tinyland-posts
```

This invokes `scripts/ingest-tinyland-posts.mts --adopt-reviewed`. The script
validates the Tinyland snapshot hash, checks the static/read-only policy fields,
and materializes the selected records into `src/posts/*.md`.

The default script mode refuses to overwrite a post that is not already marked
with `tinyland_projection: true`. The `--adopt-reviewed` flag is only for an
explicit reviewed tranche.

Rendered Markdown frontmatter stores the Tinyland snapshot id, source record,
and short hash prefixes only. The full SHA-256 integrity values stay in the
checked-in snapshot JSON so static-post secret scanners do not misclassify
projection hashes as API keys.

When a Tinyland source URL is the same as the post's canonical
`transscendsurvival.org/blog/{slug}` URL, the ingester omits `original_url`.
In this repo, `original_url` means legacy redirect source, not canonical self
URL.

`npm run check` runs the script in `--check` mode before regenerating the search
index and validating Pulse.

## Local Validation

2026-05-09:

- `npm run check` passed.
- `npm run lint` passed.
- `npm run test:unit` passed.
- `npx tsx scripts/validate-frontmatter.mts` passed for 169 posts.
- `MERMAID_PRERENDER=optional just build` passed.
- `npx tsx scripts/validate-redirects.mts` passed for 148 entries.
- Strict `just build` remains blocked by the existing Mermaid/Puppeteer
  Chromium spawn failure in `scripts/render-mermaid.mts`
  (`spawn Unknown system error -88`). The Tinyland ingest check runs before
  that step and passed.

## GitHub PR State

2026-05-10:

- [jesssullivan.github.io #111](https://github.com/Jesssullivan/jesssullivan.github.io/pull/111)
  is mergeable, clean, and CI-green.
- Passed checks: `build-and-test`, `check-dates`, `review-posts`,
  `Resolve preview target`, and `Build source image`.
- The upstream Tinyland source-authority PR
  [tinyland.dev #315](https://github.com/tinyland-inc/tinyland.dev/pull/315)
  is also CI-green, but GitHub still reports `REVIEW_REQUIRED`. Prefer merging
  the Tinyland source-authority PR before treating this checked-in blog
  snapshot as production source truth.

## Boundaries

Allowed:

- checked-in static snapshots as fallback/regression fixtures;
- ordinary Markdown/frontmatter posts in `src/posts` for legacy/static
  first-paint content;
- runtime display fetches from public `hub.tinyland.dev` broker endpoints;
- the existing `PublicPulseSnapshot` validator and `/pulse` first-paint
  renderer.

Blocked:

- mutations back into Tinyland;
- ActivityPub delivery, inbox, follower, retry, tombstone, or moderation claims;
- private storage refs, exact location payloads, credentials, or payment data.

Browser smoke remains a GitHub Actions or approved remote execution concern; do
not run local Playwright for this slice.
