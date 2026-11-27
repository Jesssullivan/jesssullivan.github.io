# Notes from the hub projection

Linear: TIN-8654. Contract: `xoxd-projection/v3`, target `blog`. Module:
`xoxd_projection` 2.0.0, which reads v3 only.

## How notes are fed

1. The operator approves a post in the hub. The hub renders it, signs a
   manifest for target `blog` and serves it at `<base>/projection/v3/blog/`.
2. The hub runs `workflow_dispatch` on `.github/workflows/hub-projection-v2.yml`
   with four inputs: `manifest`, `seq`, `projection_base` and `contract`. That
   workflow holds no credential. `projection/check-dispatch.mjs` refuses a
   `contract` other than `xoxd-projection/v3` first. Then it checks each
   other input against its contract format, the base against `allowedBases`
   in `projection/config.json` and the pinned key against the placeholder.
   Then the run ends.
3. A successful run on `main` starts
   `.github/workflows/cloudflare-pages-production-v2.yml` through
   `workflow_run`. That file always runs from the default branch. Its
   resolver reads the four inputs from the run name, checks them again, and
   requires the exact current `main` SHA with canonical CI, private CV and
   the live kill switch, as for every production publish. A run name with no
   contract, or with another contract, is refused there.
4. Before `npm run build`, the publish job runs
   `bazelisk run --ignore_dev_dependency //projection:step`. The step refuses
   another contract before it reads anything else. Then it uses the
   `xoxd_projection` module to fetch that manifest by its sha256, verify the
   signature against `projection/hub-ed25519.pub`, verify every blob and
   write `src/lib/projection-data`. Any finding fails the build and leaves
   the previous output as it was.
5. The site build reads only `src/lib/projection-data`. An entry whose
   manifest path is `/notes/<slug>` becomes a note.

## The file name of the carrier

The hub must dispatch `.github/workflows/hub-projection-v2.yml` on `main`.
The `v2` in that name, and in the workflow name `Hub projection v2`, is the
generation of this repository's workflow set, as in every other workflow
file here. It is not the contract version. The production workflow names the
carrier by both its name and its path, and the hub's dispatch settings name
the file, so the name stays.

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

## The first v3 build

Each contract counts its own `seq`. The live site serves no receipt today,
and a CI checkout has no output directory, so the first dispatch under v3 is
a first build with a last `seq` of 0. No v2 receipt is passed to the fetcher.

A receipt of another contract is refused wherever it is read. An
`xoxd-projection/v2` receipt on the live site fails the step. An output
directory that a v2 build left on a developer machine fails the step too,
and the message says to remove `src/lib/projection-data`. The site build
also refuses a post file with no `cover`, `heading` or `blocks`.

## The pinned key and the hub origin

`projection/hub-ed25519.pub` holds the hub's projection signing public key:
the 32 raw ed25519 bytes as standard base64. Its fingerprint, the sha256 of
the SPKI DER, is `SHA256:Of2yGf0oxWtl3/FgFX1V1etRLKqCNFZZNeSav9dnJAs=`. It is
a public key. The private half is held by the hub only. The key is the same
under v3.

`allowedBases` and `recoveryBase` in `projection/config.json` are
`https://social.transscendsurvival.org`. That is the hub's planned public
origin for target `blog`. It does not answer until the hub is deployed. Until
then a dispatch fails when it fetches from the hub, and a build with no inputs still
reads the live receipt and builds no notes on a 404.

`projection/step.mjs` still refuses a placeholder key: with it, the step
refuses every dispatch, fetches nothing without inputs, and the site builds
with no notes.

## The module

`xoxd_projection` 2.0.0 comes from the registry pinned in `.bazelrc`
(`xoxd-ai/bazel-registry` at `e6bc6a69af88973be3814c2ff38bf3fe1a844131`), as
a normal `bazel_dep` in `MODULE.bazel`, so the public graph
(`--ignore_dev_dependency`) resolves it too. Every `//projection` label
reaches it through `XOXD_PROJECTION` in `projection/module.bzl`. The CI step
"Refuse a stand-in for the xoxd_projection registry module" runs
`projection/check-no-temporary-override.mjs`. It fails if a vendored copy, an
override or another label comes back.

The npm build cannot import a Bazel module. So `src/lib/notes.ts` restates
the module's post types and two of its rules: `showsInHeading` and
`attachmentHeaders`. `src/lib/notes.projection.test.ts` loads the module and
fails when either rule differs from the module's own function on any fixture
post.

## How a note is rendered

The hub renders every block. A post file holds that HTML and the typed data
beside it: `cover`, `heading`, `blocks` and the attachment refs.

- The page shows the hub's HTML inside `NoteBody.svelte`, in the blog's
  prose type and spacing. The styles add no card, box or border. The note
  page and the notes list use the same component, so the list shows each
  note whole.
- A cover is shown above the body. A decorative cover has an empty `alt` and
  no figure, so a screen reader skips it.
- A figure with a label carries its number before its caption, and the prose
  links to it.
- A diagram is an `img` of the static SVG with its `alt`. The page never
  holds the SVG itself. A diagram with no picture yet shows its source as
  code, as the hub renders it.
- A recording is the browser's own audio player with controls.
- A photo set is a set of images, each with its `alt` and caption.
- A video by reference shows its poster. `src/lib/note-media.ts` loads the
  player from `youtube-nocookie.com` in place after a press. Until then the
  page asks the video host for nothing. With no script the poster is a link
  to the player.
- A clip is a short silent video. The same script starts it muted, looping
  and inline, and shows its button: "Pause the clip" while it plays, "Play
  the clip" while it stands. For a reader who asks for reduced motion it
  does not start: she sees the poster and the button, and nothing moves
  until she presses it. A clip that plays stops when she switches reduced
  motion on. With no script the poster stands still.

`src/lib/note-html.ts` reads the hub's HTML with a small tokenizer and
writes two forms of it. It fails the build when the HTML and the typed blocks
disagree, for example when the HTML holds a clip the blocks do not.

- The page body adds search hints only. The site search then indexes the
  `alt` of each image, of a clip and of a diagram with no picture. It skips
  the words of the controls, the TeX source beside a formula and the source
  of a diagram with no picture.
- The feed body is for `feed.xml` and `feed.json`. A clip is its `alt`,
  linked to the file, then its caption. A recording is its title, linked to
  the file, then its description. A diagram with no picture is its `alt`
  and description, never its source. Images keep their `alt`. Every site
  path becomes a full address. The feed holds no media element and no
  control.

The sitemap holds each note's address and day only.

## The heading placement

A post can ask for the home page's heading stage, with an optional last day.
`notesInHeading(day)` in `src/lib/server/notes.ts` returns the notes that ask
for it on a `YYYY-MM-DD` day, newest first. Each item carries its last day,
`until`, so a page built on an earlier day can check it again in the
browser. No page calls it yet. The home page and the constellation belong to
another change.

## Attachment headers

Each attachment needs three response headers: its exact `Content-Type`,
`X-Content-Type-Options: nosniff` and
`Content-Security-Policy: default-src 'none'; sandbox`. A diagram picture
needs all three, since an SVG opened on its own is a document.

This site set no response header for a file before this change. Its one
Pages Function answers a held post, and there was no `_headers` file. The
build output is static, so the headers a route returns never reach a reader.

- Cloudflare Pages, the production host, reads the file `_headers` from the
  build output. The route `src/routes/_headers` writes it when a note has an
  attachment: one rule per attachment path, matched whole, so no rule
  reaches a page. With no note attachment no `_headers` file is written.
- Cloudflare Pages reads at most 100 header rules, and one rule covers one
  file. The build fails when the notes hold more than 100 attachments,
  since an attachment must never go out without its headers. A wider rule
  would also match the pages under `/notes/`, so it is not used. Lifting the
  limit needs a Pages Function for `/notes/*/*`, which is a later change.
- GitHub Pages, the manual rollback target, cannot set a header per file.
  A rollback there would serve a diagram picture with the type GitHub
  derives from the file name and with no policy.
- The shadow image serves the build through nginx and does not read
  `_headers`.

## What a projection can and cannot change

- Notes: `/notes` (newest first, 20 per page, as `/blog`) and
  `/notes/<slug>`, plus each note attachment at its own path under it. An
  attachment at any other path fails the build.
- The RSS and JSON feeds and the sitemap gain each note under its canonical
  URL. Posts keep their order and their bytes. Notes merge in by date, and
  a post wins a tie.
- The navigation shows Notes only when at least one note exists.
- Entries with a `/blog/<slug>` path are ignored and counted in the build
  log. Articles stay on their files in `src/posts` until the cutover, so a
  projection never shadows or replaces a post page.
- Other paths, redirects and tombstones are ignored in this change.
- With no notes, `/notes`, `/.well-known/projection.json` and `/_headers`
  are not built and answer the host's normal 404. `/.well-known/webfinger`
  is unchanged. The note styles ship with the notes pages only, so the
  site's stylesheet is the one it had.

## Tests

- `//projection:step_test`: the step and the module's fetcher against the
  contract fixtures that the `xoxd_projection` module ships, served from a
  server on a loopback address and fetched over HTTP. It runs both valid
  trees, every case of `cases.json` and the step's own refusals: another
  contract, a v2 receipt, a lower `seq`, a base off the allowlist and the
  placeholder key. A refused projection leaves the previous output
  untouched. The fixtures verify against the contract's fixture public key.
  The module leaves out the key pair file, which also holds the private
  half.
- `src/lib/notes.projection.test.ts`: both valid trees through the same
  fetcher, then a render test for each block kind the fixtures hold, the
  feed body of each media block, the heading list, the header rules and the
  search index that the real indexer writes.
- `src/lib/notes.test.ts` and `src/lib/note-html.test.ts`: placement,
  order, feed items, the heading day, the headers file and what the HTML
  reader refuses.
- `//:playwright_notes_e2e`: the site built from the valid blog fixture.
  `/notes` and `/notes/first-light` show the note. The fixture's one note is
  a paragraph, and its media blocks are in an article at a `/blog` path that
  this site does not build. So the media tests answer the note's page data
  request with that article's verified post file, on a phone-sized screen:
  the recording loads, the video frame loads only after a press, and the
  clip starts, pauses and respects reduced motion.
- `e2e/notes-absent.spec.ts` in `//:playwright_chromium_e2e`: the default
  build has no Notes link, no notes routes, no receipt and no headers file.
- `scripts/compare-static-builds.mjs`: compares a build of this branch with
  two builds of the base commit.

What the fixtures do not hold: a note with an attachment, a diagram with no
picture and a clip a browser can play. The attachment route and the
`_headers` route are covered by unit tests on their rules, not by a built
page. The diagram case is tested on a string written in the shape the hub's
renderer writes. The clip tests stand in for the video element's play and
pause, and one test runs the real 24 byte file to check that the page stands
still on its poster.

## Before merge

1. The hub must be live and answering at
   `https://social.transscendsurvival.org`, serving `projection/v3/blog/`
   signed by the pinned key.
2. The operator sets `HUB_DISPATCH_BLOG_CONTRACT=v3` on the hub, so it sends
   the v3 manifest with the `contract` input.
3. The hub's dispatch for target `blog` points at
   `.github/workflows/hub-projection-v2.yml` on `main`.
