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

While the pinned key is the placeholder, the step refuses every dispatch,
fetches nothing without inputs, and the site builds with no notes. The build
log says so.

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

- `//projection:step_test`: the step against the contract fixtures with the
  contract's fixture key. A tampered manifest, a wrong signature, a lower
  `seq` and the firm target's manifest each fail closed and leave the
  previous output untouched.
- `//:playwright_notes_e2e`: the site built from the valid blog fixture.
  `/notes` lists the note and `/notes/first-light` renders it.
- `e2e/notes-absent.spec.ts` in `//:playwright_chromium_e2e`: the default
  build has no Notes link, no notes routes and no receipt.
- `src/lib/notes.test.ts`: placement, order and feed items.
- `scripts/compare-static-builds.mjs`: compares a build of this branch with
  two builds of the base commit.

## Before merge

`xoxd_projection` 1.0.0 is not in the registry yet (TIN-8643), and the hub is
not deployed. This change stays a draft until both are done.

1. In `MODULE.bazel`, delete the comment block that starts with
   `# TEMPORARY, DRAFT ONLY (TIN-8654).` and add in its place:

   ```starlark
   bazel_dep(name = "xoxd_projection", version = "1.0.0")
   ```

   If the registry pin in `.bazelrc` predates the release, move it to the
   registry commit that adds `modules/xoxd_projection/1.0.0`.
2. In `projection/module.bzl`, replace
   `XOXD_PROJECTION = "//third_party/xoxd_projection_REMOVE_BEFORE_MERGE"`
   with `XOXD_PROJECTION = "@xoxd_projection//"` and drop the TEMPORARY
   comment above it.
3. Delete the directory `third_party/xoxd_projection_REMOVE_BEFORE_MERGE`.
4. Delete its line and the comment above it in `.gitleaks.toml`.
5. Delete `projection/check-no-temporary-override.mjs` and the CI step
   "Refuse the temporary xoxd_projection override outside a draft" in
   `.github/workflows/ci.yml`.
6. Refresh `MODULE.bazel.lock` with `bazel mod deps --lockfile_mode=update`,
   once with and once without `--ignore_dev_dependency`.
7. Replace `projection/hub-ed25519.pub` with the hub's real ed25519 public
   key: 44 characters of standard base64, one line.
8. Set `allowedBases` and `recoveryBase` in `projection/config.json` to the
   hub's real https origin.
9. Point the hub's dispatch for target `blog` at
   `.github/workflows/hub-projection-v2.yml` on `main`.
