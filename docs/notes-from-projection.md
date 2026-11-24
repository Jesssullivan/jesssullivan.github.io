# Notes from the hub projection

Linear: TIN-8654. Contract: `xoxd-projection/v2`, target `blog`.

## How notes are fed

1. The operator approves a post in the hub. The hub renders it, signs a
   manifest for target `blog` and serves it at `<base>/projection/v2/blog/`.
2. The hub runs `workflow_dispatch` on `.github/workflows/hub-projection-v2.yml`
   with three inputs: `manifest`, `seq` and `projection_base`. That workflow
   holds no credential. `projection/check-dispatch.mjs` checks each input
   against its contract format, the base against `allowedBases` in
   `projection/config.json` and the pinned key against the placeholder. Then
   the run ends.
3. A successful run on `main` starts
   `.github/workflows/cloudflare-pages-production-v2.yml` through
   `workflow_run`. That file always runs from the default branch. Its
   resolver reads the inputs from the run name, checks them again, and
   requires the exact current `main` SHA with canonical CI, private CV and
   the live kill switch, as for every production publish.
4. Before `npm run build`, the publish job runs
   `bazelisk run --ignore_dev_dependency //projection:step`. The step uses the
   `xoxd_projection` module to fetch that manifest by its sha256, verify the
   signature against `projection/hub-ed25519.pub`, verify every blob and
   write `src/lib/projection-data`. Any finding fails the build and leaves the
   previous output as it was.
5. The site build reads only `src/lib/projection-data`. An entry whose
   manifest path is `/notes/<slug>` becomes a note. Its HTML is the verified
   blob, placed with `{@html}` inside the site's article chrome.

## A build with no dispatch inputs

The last accepted projection is the one the live site serves at
`/.well-known/projection.json`. The step reads that receipt.

- The site answers 404: nothing was accepted yet, so the build has no notes.
- The site serves a receipt: the step fetches that same manifest from
  `recoveryBase` and verifies it in full, as an equal-seq rebuild.
- Any other answer fails the step, so no build drops live notes by accident.

No file is committed for this and no verification is skipped. The hub needs
only Actions write to start the carrier. A dispatch also reads the live
receipt first and refuses a lower `seq` before it fetches from the hub.

## The pinned key and the hub origin

`projection/hub-ed25519.pub` holds the hub's projection signing public key:
the 32 raw ed25519 bytes as standard base64. Its fingerprint, the sha256 of
the SPKI DER, is `SHA256:Of2yGf0oxWtl3/FgFX1V1etRLKqCNFZZNeSav9dnJAs=`. It is
a public key. The private half is held by the hub only.

`allowedBases` and `recoveryBase` in `projection/config.json` are
`https://social.transscendsurvival.org`. That is the hub's planned public
origin for target `blog`. It does not answer until the hub is deployed. Until
then a dispatch fails when it fetches from the hub, and a build with no inputs still
reads the live receipt and builds no notes on a 404.

`projection/step.mjs` still refuses a placeholder key: with it, the step
refuses every dispatch, fetches nothing without inputs, and the site builds
with no notes.

## The module

`xoxd_projection` 1.0.0 comes from the registry pinned in `.bazelrc`, as a
normal `bazel_dep` in `MODULE.bazel`, so the public graph
(`--ignore_dev_dependency`) resolves it too. Every `//projection` label
reaches it through `XOXD_PROJECTION` in `projection/module.bzl`. The CI step
"Refuse a stand-in for the xoxd_projection registry module" runs
`projection/check-no-temporary-override.mjs`. It fails if a vendored copy, an
override or another label comes back.

## What a projection can and cannot change

- Notes: `/notes` (newest first, 20 per page, as `/blog`) and
  `/notes/<slug>`, plus each note attachment at its own path.
- The RSS and JSON feeds and the sitemap gain each note under its canonical
  URL. Posts keep their order and their bytes. Notes merge in by date, and
  a post wins a tie.
- The navigation shows Notes only when at least one note exists.
- Entries with a `/blog/<slug>` path are ignored and counted in the build
  log. Articles stay on their files in `src/posts` until the cutover, so a
  projection never shadows or replaces a post page.
- Other paths, redirects and tombstones are ignored in this change.
- With no notes, `/notes` and `/.well-known/projection.json` are not built
  and answer the host's normal 404. `/.well-known/webfinger` is unchanged.

## Tests

- `//projection:step_test`: the step against the contract fixtures that the
  `xoxd_projection` module ships, with the contract's fixture public key. The
  module leaves out the key pair file, which also holds the private half.
  A tampered manifest, a wrong signature, a lower `seq` and the firm
  target's manifest each fail closed and leave the previous output
  untouched.
- `//:playwright_notes_e2e`: the site built from the valid blog fixture.
  `/notes` lists the note and `/notes/first-light` renders it.
- `e2e/notes-absent.spec.ts` in `//:playwright_chromium_e2e`: the default
  build has no Notes link, no notes routes and no receipt.
- `src/lib/notes.test.ts`: placement, order and feed items.
- `scripts/compare-static-builds.mjs`: compares a build of this branch with
  two builds of the base commit.

## Before merge

1. Confirm when the hub answers at `https://social.transscendsurvival.org`
   that it serves `projection/v2/blog/` signed by the pinned key.
2. Point the hub's dispatch for target `blog` at
   `.github/workflows/hub-projection-v2.yml` on `main`.
