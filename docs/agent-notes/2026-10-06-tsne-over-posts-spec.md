# Spec: t-SNE over blog posts in the reader constellation (proposed TIN-2413 child)

Status: **proposal only. The operator has not scoped it, and nothing is implemented.** Ruling:
R-HOOK-CONVERGENCE-20261004 (R-N13 durable note). Source: the 2026-10-06 estate
workstream board (TIN-3692), §3.6 row "t-SNE over blog posts" and lane U3.

## Why

The default-off reader constellation on `main` (`37ba6c9`, flag
`?flags=constellation`) plots the 4 latest posts and 2 Pulse items. It has no
spatial meaning. "Real t-SNE navigation" exists today only as the profile project
map in PR #288, which is produced by the spear_resumes embed and fit pipeline. This
spec reuses that pipeline's method on public posts, so the constellation becomes a
similarity map of the writing.

## Gates (unchanged and not bypassed)

TIN-2413 is gated on TIN-603, TIN-604, TIN-2414 (Pulse 503: blocked on the
Mothership lane's real note transaction) and TIN-2425. This child covers the posts
projection only. It does not depend on Pulse: Pulse items keep their current
non-spatial strip until TIN-2414 clears.

## Operator decision needed first

"Real t-SNE navigation" means one of the following:

- (a) Land #288 (the project map) and stop there.
- (b) Also build t-SNE over posts (this spec).
- (c) Both, with #288 first.

The spec assumes (c).

## Method (mirrors spear `profile/refresh/embed.py`, method `tfidf-jaccard-exact-tsne-2`)

- **Corpus.** Only published posts (`published !== false`) whose build output
  already passes the unpublished-content sentinel scan. Fields: title, description,
  tags and category, plus body text with code fences and front matter stripped. No
  external fetch.
- **Similarity.** 0.6 TF-IDF cosine plus 0.4 Jaccard over tags and category, the
  same weights as spear. Taxonomy colour, date and display order must not enter
  the fit.
- **Projection.** Exact t-SNE (`sklearn.manifold.TSNE`, `init="pca"`,
  `metric="precomputed"` on 1 minus similarity). Perplexity is tuned for about 140
  to 180 posts (start at 15 and record the value). Fixed seed. Pinned numpy and
  scikit-learn versions taken from the spear `profile-layout` flake shell.
- **Stability.** Warm-start from the previous coordinates when they exist (spear
  `WARM_ITERATIONS`, low learning rate, 0.1% jitter), so adding one post does
  not reshuffle the map. A cold refit is an explicit recipe.
- **Edges.** Top-k neighbours (k=3) above a threshold, for constellation lines.
  The coordinates and edges are the only outputs.
- **Honesty text.** Axes and distances are not measurements. The caption carries
  the same "describe, don't measure" disclaimer as the profile map.

## Where it runs

- **Build time only.** Static output only, with no runtime fitting and no
  client-side numerical packages. Producer: a Bazel target (or a just recipe
  inside the pinned numerical shell) that writes
  `static/reader/posts-projection.v1.json`. That file holds
  `{schema, method, seed, perplexity, inputs_sha256, posts:[{slug,x,y}], edges:[[a,b]]}`.
- The output has a checked-in digest, plus a sync test in the style of
  `profile_synced_test`, so CI detects drift without refitting. CI never needs
  the numerical shell.
- Remote CI stays the authority. A local fit is a diagnostic only.

## Rendering

- `ReaderConstellation.svelte` positions post nodes from the projection when the
  file is present. Otherwise it falls back to today's latest-4 layout.
- Reuse the #288 map engine (WebGL2 with a Canvas 2D fallback, plus an SVG
  overlay of focusable markers) only if its bundle budget allows. Otherwise use a
  plain SVG.
- **Keyboard and list equivalent (required).** Every node is a focusable link.
  Arrow keys move to the nearest neighbour. "Browse as a list" and the Year tree
  stay first-class. `?focus=<slug>` deep links work as they do in #288.
- Production stays default-off behind the existing constellation flag. SSR and
  no-JS show the list.

## Acceptance

1. Projection JSON is reproducible from the pinned inputs: same seed and inputs
   give byte-identical output.
2. Sync test is green in remote CI.
3. Browser cases:
   - flag off: no constellation DOM and no projection request;
   - flag on: the nodes count equals the published posts count, every node is
     reachable by keyboard, and `?focus` selects the node;
   - an unpublished post never appears (sentinel scan).
4. Bundle budget holds.
5. The operator accepts the map visually.

## Prior art

- `archive/recovery-reader-20260924-dbe7ff8` (reader constellation recovery).
- Spear `profile/refresh/embed.py`, `profile/layout/fit.py`.
- #288 `ProjectMap.svelte`.
- TIN-2986 (git activity feeding the constellation; Backlog) stays out of scope.

## Proposed Linear child (draft body; not filed by this lane)

Title: "Reader constellation: build-time t-SNE projection over public posts".
Parent: TIN-2413. Blocked by the operator scope decision (a/b/c above). Related:
TIN-603, TIN-604, TIN-2425, TIN-4675 (#288). Estimate: 1 sprint after scoping.
