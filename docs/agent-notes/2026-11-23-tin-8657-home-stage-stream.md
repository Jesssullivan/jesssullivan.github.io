# The home page as a heading stage and one mixed stream (TIN-8657)

Authority: rulings RM47 to RM50, Linear TIN-8594, the comment headed "Rulings
from the sixth interview" (`be2bf135`), November 23, 2026. Receipt under
R-HOOK-CONVERGENCE-20261004 (R-N13). Ticket: TIN-8657. The branch is
`feat/tin-8657-home-stage-stream`, stacked on the constellation branch
`feat/tin-8628-constellation-acceptance` (pull request 323).

Everything here sits behind one flag, `?flags=home`. With the flag off the site
behaves as it does on main.

## Her words

Her direction, verbatim. The elision is the name of another site of hers,
whose feathering and motion she asked to be studied:

> please explore the deeply featerhed and 3d workin in flight by [...] and the goals are heading, carusel, blog as pise de rssistance of my work where my pulse, posts, announcenets, articles etc flow along with media, recordings, photos etc (from the mothership)

Her rulings, verbatim where quoted:

| Id | Ruling |
|---|---|
| RM47 | "we alrady agreed on the conseatalion as heading, which can osccilate to the current heron headingm, as well as future announcemnt / heading type elemnts" |
| RM48 | "One mixed stream" |
| RM49 | "Depth by light and motion" |
| RM50 | The redesigned home page is part of the December 11 proof. Her choice: "Make it the Dec 11 proof" |

Her taste, from her design reviews, as binding rules:

- She loved "the deep falloffs / feathers".
- She pushed back on "excessive cards, layered bg and excsssive subheadings" and "excessive boarders".
- The first load plays itself, so the impact shows "without any input".
- Controls must be "clear", with no sideways scroll to reach one.
- She asked for tooltips and clickable elements, and a footerless main page.
- On this blog she asked for full bleed, tooltips, and "removing undeeded headers / descirioptions  / labining thngs that are self ev eident".

## The design in ten lines

1. One flag, `?flags=home`. It is remembered as `tss:flags:home`, and `?flags=none` forgets it. Off, nothing changes.
2. The home page opens on a stage as wide as the window and most of the first screen tall. It has no box: its ground is the page's own.
3. Scene one is the sky of her posts. Scene two is the heron heading with her title, her three definitions and her name. Further scenes are items placed in the heading.
4. Type sits straight on a photograph. Behind it is the deep feather: a near-solid band of the page's ground exactly as wide as the text, then a long falloff into the picture.
5. The stage plays itself. A scene holds 9 to 18 seconds by its word count, then the next arrives out of a short soft blur. One thin line shows the hold.
6. Pause and Next are two icon controls with tooltips. A press, a key, a wheel or a touch on the stage stops the play. A hidden tab pauses it and it resumes by itself.
7. Photographs drift like a slow camera and give the drift up on a slow device. With reduced motion nothing plays, drifts or blurs, and the scenes step by the controls.
8. Below is one stream, newest first. Each kind has its own form and one renderer. There is no card, rule, border or label, and whitespace sets the rhythm.
9. One builder writes one data file from the posts, the committed Pulse snapshot, the photo gallery and the Music page, through one item type the hub's items can join.
10. With the flag on, the home page has no site-wide banner, no side column, no footer and no blob background. Inner pages keep the slim top bar.

## What was built

| Piece | File |
|---|---|
| The flag, after `constellation.ts` | `src/lib/flags/home.ts`, `home-state.svelte.ts` |
| The item type and the builder | `src/lib/home/stream.ts` |
| The scenes and their holds | `src/lib/home/scenes.ts` |
| The timing rules, with no DOM | `src/lib/home/stageClock.ts` |
| The generator and its sources | `scripts/generate-home-stream.mts`, `scripts/lib/home-stream-sources.mts` |
| The data file | `static/data/home-stream.v1.json` |
| The Music page's lists, moved into one file | `src/lib/data/music.ts` |
| The stage | `src/lib/components/home/HomeStage.svelte` |
| The stream and the one renderer per kind | `HomeStream.svelte`, `StreamEntry.svelte` |
| The page behind the flag | `src/lib/components/home/Home.svelte` |
| Posters of her four dated videos | `static/images/video/` |

Recipes: `just home-stream` rewrites the data file, and `just home-stream-check`
fails when it is stale. The unit test `committed-stream.test.ts` runs the same
check wherever the gallery and the images are on disk.

### The stage

- **The sky** is `ReaderConstellation`, used through its props, as the
  constellation branch ships it at `0ebd70f`: full bleed, its legend and
  controls laid over it, nothing printed above it. The stage gives it the room
  with two style rules: it fills the stage, and its legend and controls line up
  with the page's edge. A plain wheel and a one-finger swipe scroll the page.
- **The heron** uses `static/images/header.png`, which is 672 by 219 pixels.
  The repository holds no larger original: every other copy on this host is the
  same file. So the photograph is drawn as wide as the window, the size the
  site has always drawn it, and never taller than that shape. On a phone it is
  cropped to the bird. The brightness filter is gone.
- Her rainbow stays as the one thin rule under the title. As text on a light
  ground it could not hold contrast.
- **A placed item** is any stream item the data file lists under `heading`.
  The hub marks one with `heading: true`. Until it does, the builder picks the
  newest writing that has its own image and the newest photographs.
- Only the sky is in the first paint. The heron's photograph is asked for two
  seconds later, when the browser is idle, and each later scene one hold before
  its turn.
- A reload plays again. A stop is remembered until the page is reloaded.
- A stage scrolled away, with less than a quarter of it on screen, pauses and
  resumes by itself, like a hidden tab.
- `?stage-pace=20` runs the holds twenty times faster. Tests use it.

### The stream

| Kind | Form | Source today |
|---|---|---|
| Note | A few lines set plainly, the date small under it | The committed Pulse snapshot, which is empty |
| Writing | The title as a link, one summary line, its own image | `src/posts` |
| Announcement | One strong line and its link | None yet. The hub supplies it |
| Photographs | The lead image wide, the others in one row, the post linked | `static/photo-gallery.json` |
| Recording | A title and a play control | The Music page's three tracks |
| Video | A poster and a play control | The Music page's videos |

- **The cover rule.** A post shows a cover only when its own text uses that
  image file, in any format. Most covers come from a small pool of photographs
  shared between posts, and those are left off.
- A post that has photographs in the gallery shows them as their own item
  straight after it, and its title is not repeated under them.
- **Dates.** A gallery photograph takes the date of the post that uses it. A
  video takes a date only when its title states the day.
- A player loads only on a press: SoundCloud for a recording, YouTube no-cookie
  for a video. The posters are YouTube's own thumbnails of her videos, fetched
  once on November 23, 2026 and committed, so the page asks YouTube for nothing
  until she presses play.
- A filter is offered only for a kind the stream has. The filter is kept in the
  address as `?show=photos`. The filters share one line with the stage's
  controls, so the stage and the stream join with no seam. A filter chosen from
  the first screen scrolls the stream up, so the choice shows.
- The play control of a recording or a video is the bare sign in the page's
  ink, with no filled square behind it.
- Twelve items are in the first paint. More show as the reader nears the end.
  Without scripts, More is a plain link to `/blog`.

### A preview build

`BLOG_HOME_STAGE=on npm run build` prerenders the new home page, so a preview
address shows it with no swap after load. Production builds leave it off, and
the home page then swaps in after the flag is read.

### The default page

A production build reads the build constant bare in `src/routes/+page.ts`, so
the bundler drops the import of the new page from the server graph. The
prerendered default page then links the same one stylesheet it links on main.
An earlier draft linked four more, which the constellation specs caught.

## Measured

Measured on November 23, 2026 on a local production build, through one
headless Chromium.

| What | Result |
|---|---|
| JavaScript on the home page, flag off | 24 files, 176,414 bytes gzip |
| JavaScript on the home page, flag on | 27 files, 193,728 bytes gzip |
| Added by the flag | 17,314 bytes gzip: the sky's interactive layer 9,410, the stage and stream 7,662, one shared piece 250 |
| The stream's data file | 75,942 bytes, 21,335 gzip |
| Lowest contrast of type over a scene, 5 themes, 2 modes, 1440 and 390 wide | 7.0 to 1, pine dark. Measured over the photograph, over pure white and over pure black |
| Lowest contrast of quiet text on the ground | 5.63 to 1, pine light |
| Lowest contrast of the accent on the ground | 3.82 to 1, catppuccin light. It marks controls and underlines, never running text |
| Smallest type on a scene | 14.4 pixels |

The comparison is with the flag off on this same build. Main was not built
here, so the constellation branch's own difference from main is not in these
figures.

## Decisions for her

1. The newest three posts have covers made for them that their text never uses,
   so the cover rule shows none. A looser rule would show a cover that no other
   post shares.
2. The definitions under the heron title are set in the page's ink, and the
   rainbow is one thin rule. Her old banner filled the definitions with a
   moving rainbow.
3. Announcements show under All and have no filter of their own.
4. The feed links and the licence line are in the footer, which the home page
   no longer has. They are on every inner page.
5. The side column's content is on the About page, which the top bar links.
   Nothing from it was folded into the stream.
6. The stage's pause and next share a line with the stream's filters. With the
   stream scrolled up they stay in view for a moment beside the filters.
7. `?flags=home` on a production build paints the old page first and swaps
   after the flag is read. Only a preview build paints the new page first.

## Left out

See the pull request body for the measured counts. In short: gallery
photographs no public post uses, videos whose title states no day, and notes,
because the committed Pulse snapshot is empty and the page fetches nothing at
run time.

## Requests for the constellation lane

The stage reaches into the component with two style rules, in one block in
`HomeStage.svelte`. They can go when the component offers the same as props:

1. A way to fill its container, with no fixed height on the sky.
2. A way to set the inset of its legend and controls. The stage overrides
   `--edge`, which the component sets inline.
3. A notice that does not name "Latest and Archive below", which the new home
   page does not have.
4. A prop that tells it when it is off show, so it can rest.
