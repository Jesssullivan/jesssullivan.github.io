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
| The data file | `src/lib/data/home-stream.v1.json` |
| The Music page's lists, moved into one file | `src/lib/data/music.ts` |
| The stage | `src/lib/components/home/HomeStage.svelte` |
| The stream and the one renderer per kind | `HomeStream.svelte`, `StreamEntry.svelte` |
| The page behind the flag | `src/lib/components/home/Home.svelte` |
| Files the page brings with it: the heron at its own size, posters of her four dated videos | `src/lib/assets/home/`, resolved by `src/lib/home/assets.ts` |
| What the layout and the page share: the flag, and the new page once it has loaded | `src/lib/flags/home-state.svelte.ts` |

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
  cropped to the bird. The brightness filter is gone. Round two serves it as an
  AVIF and a WebP made from that PNG at 672 pixels. No enlarged copy is shipped.
- Her rainbow stays as the one thin rule under the title. As text on a light
  ground it could not hold contrast.
- **A placed item** is any stream item the data file lists under `heading`.
  The hub marks one with `heading: true`. Until it does, the builder picks the
  newest writing that has its own image and the newest photographs.
- Only the sky is in the first paint. The heron's photograph is asked for two
  seconds later, when the browser is idle, and each later scene one hold before
  its turn. The sky holds 9 seconds, the shortest a scene may, so a first visit
  sees the stage move within ten seconds.
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
  until she presses play. The stream names a poster `asset:video/<id>.jpg`, and
  the page gives it its built address.
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
address shows it with no swap after load. Production builds leave it off. The
ordinary page then paints first and stays whole until the new page's code and
stream have both arrived, and the two change places in one step.

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
   A script in the page head could hide the old page sooner, and the ground
   rules forbid a new script on the default page. A preview built with
   `BLOG_HOME_STAGE=on` shows what a launch will look like.

## Left out

See the pull request body for the measured counts. In short: gallery
photographs no public post uses, videos whose title states no day, and notes,
because the committed Pulse snapshot is empty and the page fetches nothing at
run time.

## Round two: polish, motion and loading

Authority: rulings RM59 and RM60, Linear TIN-8594, the comment headed "Rulings
from the eighth interview", November 24, 2026. Receipt under
R-HOOK-CONVERGENCE-20261004 (R-N13).

Her words, verbatim:

| Id | Her words |
|---|---|
| RM60, on the home page | "Right direction, keep refining (Recommended)" |
| RM59, on models | "fable is back.  execute UX, devlpoment ooin human facing \"wow\" woth fable andopus for non UX" |
| RM32, earlier, on the constellation | "needs significantly more fable 5.2 clean, UX, \"wow\" factor and clean loading and caching" |
| After she saw commit `3fdff87` in Chrome | "in chrome, the layout is beautiful!" |
| On the restart, November 24, 2026 | "please reassert the extant lanes / dialogs / reattach all worktrees, workstreams, subagents, review the current ouputs and states and plans and goals etc)  usage has been reset, apologies for the interuption/status" |

So the layout is frozen at `3fdff87`. This round changed only what does not
move a block: motion, loading, caching, the crop and the encoding of the heron,
tooltips and focus.

The round stopped once on an account usage limit, before its proof had run. It
was finished on her word above. Nothing was built again: the proof ran once on
the work as it stood.

### The layout check

Fifteen screenshots of the final build were laid over the same fifteen of
`3fdff87`: the sky, the heron, a placed item and the top of the stream at 1440,
1920 and 390 pixels wide, and the whole page at each width. Every block both
builds show was measured, 87 to 206 blocks a picture. The largest shift is
0.00 pixels.

### What changed

| Part | Before | Now |
|---|---|---|
| The hand-off between scenes | The whole scene blurred and faded, type included | The type on show fades where it stands. The picture dissolves into a blur while the next comes out of one. The new type rises line by line, sharp all the way |
| Easing | Four different curves | One family of ease-out curves: a quick one for what travels, a soft one for a fade or a blur |
| The next scene | Its picture was decoded as the hand-off began, so the two scenes did not cross | It is drawn and decoded ahead of its turn, unseen, so the two truly cross |
| The first paint | The stage just appeared | It opens out of the same soft blur, once |
| The sky's hold | 13 seconds | 9 seconds, so a first visit sees the stage move within ten |
| A mouse over a scene | The scene changed under a reader | A mouse that moves over a scene holds it. It goes on when the mouse leaves or has rested four seconds. The control still offers Pause |
| A slow device | The drift gave up after ten slow frames | An arrival that draws three frames slower than 50 milliseconds also gives up the blur, for the stage and the stream. Scenes then change one after the other by a plain fade |
| A stopped drift | The picture jumped back to its start | It stops where it stands |
| Pictures in the stream | Popped in as they loaded | One still on its way fades in as it lands |
| Back to the sky | A jump | A glide, and focus goes to the stage |
| The flag on a production build | The old page lost its banner, then a blank stage showed, then the stream | The old page stays whole until the new page's code and stream are both here. Then the two change places in one step |
| File names | The stream's data, the heron and the posters had plain names | Each has a content hash in its name |
| The stream's data on a prerendered page | Written into the page's HTML, 21 kilobytes on every visit | Asked for once by its hashed name, with a preload |
| Type on a prerendered page | Loaded after the stylesheet | The three type files of the first screen are preloaded with it |
| The heron file | A lossy WebP of 32 kilobytes | An AVIF and a WebP made from the PNG at 672 by 219 pixels |
| The heron on a phone | The bill ran off the frame | The frame holds the head, the whole bill, the neck and the near wing |
| The heron's top falloff | The head, at the very top of the photograph, was half faded | A little shorter, so the head keeps its light |

One fault was found and fixed on the way. A fade on the whole stream section
laid it over the stage's controls for a second, and it took their presses.
The fade is on the flow now.

### The heron photograph

`static/images/header.png` is 672 by 219 pixels. No larger original is in the
repository or anywhere on this host. A wide screen draws it at up to 2.9 times
its size, and a phone at up to 1.8 times before the screen's own density. It is
soft at those sizes, and no encoding can add detail. No enlarged copy is
shipped. With the original photograph the stage would be sharp at every width.

### Measured

One throttled run, November 24, 2026: a phone of 412 by 823 pixels at twice
density, 1.6 megabits a second down, 150 milliseconds of delay, the processor
four times slower. The local server answers as production does today: brotli,
four hours of browser cache on files and none on pages.

| Load | First paint | Largest paint | Layout shift | Transferred | Requests |
|---|---|---|---|---|---|
| Prerendered page, cold | 1,128 milliseconds | 1,128 milliseconds, a word of the sky's legend | 0 | 862,295 bytes | 44 |
| Prerendered page, warm | 424 milliseconds | 424 milliseconds | 0 | 253 bytes | 44, of which 43 from the cache |
| `?flags=home` on a production build, cold | 1,012 milliseconds | 2,872 milliseconds, the old page's banner | 0.0013 | 1,179,954 bytes | 51 |
| `?flags=home` on a production build, warm | 352 milliseconds | 352 milliseconds | 0 | 254 bytes | 51, of which 50 from the cache |

- The largest file of a cold load is the site's own `favicon.svg`, 281,904
  bytes. Every page of the site asks for it today. It is not part of this work.
- A production build paints the old page first, so its cold load also carries
  the old page's pictures.
- JavaScript with the flag on is 19,584 bytes gzip above the flag off:
  197,557 against 177,973.
- Type over a scene was measured again in five themes and both modes, at 1440
  and 390 pixels wide: over the photograph, over pure white and over pure
  black. The lowest is 7.0 to 1, pine dark, as in round one. Quiet text on the
  ground is 5.63 to 1 and the accent 3.82 to 1, both as before.
- At 1440 pixels wide the ordinary page scores a layout shift of its own with
  the flag off: 0.03 in this run and 0.07 in round one's. A production build
  with the flag on carries it, 0.07, because the ordinary page paints first.
  The prerendered page scores 0.

**A visitor who only watches.** The table's largest paint is what a test reads
that ends before the stage moves. A second run left the prerendered page alone
for sixteen seconds, unthrottled, at 1440 and at 412 pixels wide. The stage
moved at nine seconds, and Chrome then counted the heron heading as the largest
paint: its type at 10.0 and 10.8 seconds, its photograph at 10.9. The sky is
drawn as vector shapes, which Chrome does not count, so the first scene's
largest paint is one word of its legend, and any later scene is larger. Field
figures for a visitor who touches nothing would report about eleven seconds.
See decision 5 and request 7.

Frame times through a scene change, on this host, which draws with no graphics
card:

| Processor | Out of the sky, blur on | The next change, after the give-up |
|---|---|---|
| Full speed | Median 49.9 milliseconds, 95th percentile 133.3 | Median 16.7 milliseconds, 95th percentile 33.4 |
| 4 times slower | Median 66.7, 95th percentile 183.3 | Median 16.7, 95th percentile 33.4 |
| 6 times slower | Median 66.7, 95th percentile 233.3 | Median 16.7, 95th percentile 33.4 |
| 20 times slower | Median 216.7, 95th percentile 1,216.6 | Median 33.3, 95th percentile 100 |

The budget was missed at every rate here, so the page gave up its blur and its
drift after the first change, as built. A machine with a graphics card was not
on hand to measure.

### Proof

Run once on November 24, 2026, each step through the host's gates, one at a
time.

| Step | Exit | Result |
|---|---|---|
| The stream's data file against its sources | 0 | Current, 160 items |
| Unit tests | 0 | 45 files, 442 tests |
| svelte-check | 1 | 4 errors, all in `src/lib/flags/tailnet-hint.test.ts`, the 4 that main has |
| Lint | 0 | Clean |
| Production build | 0 | The default page has no stage in its HTML |
| Preview build, `BLOG_HOME_STAGE=on` | 0 | The page has the stage in its HTML |
| e2e with one worker: this lane's spec and the two constellation specs | 0 | 52 passed |
| Layout compare with `3fdff87` | 0 | Largest shift 0.00 pixels |

Two tests were made steadier, and no page code changed for them. The unit test
of the swap reads its module once before any test, because a busy host took
longer than a test's five seconds to compile it. The stream's e2e presses More
from inside the page, because the control moves and then leaves as parts
arrive.

### Not changed, and why

- The wide stream stays one column. She saw it and called the layout
  beautiful.
- Two pictures in old posts are 300 and 534 pixels wide and are drawn at the
  column's 608. Drawing them at their own size would move blocks.
- The sky's own controls and legend are not touched from here. See the
  requests below.
- No `_headers` file. Production answers every file with four hours of browser
  cache today. A rule that keeps hashed files for a year would change every
  page of the site, so it is hers to call.
- No script in the page head to hide the old page before it paints. The
  ground rules forbid a new script on the default page.

### Decisions for her, round two

1. A mouse moving over a scene now holds it. Say so if the stage should move
   on regardless.
2. The sky holds 9 seconds, down from 13.
3. A preview built with `BLOG_HOME_STAGE=on` paints the new page first, as a
   launch will. The preview she saw was a production build, which paints the
   old page for about a second first.
4. The heron needs its original photograph to be sharp.
5. A visitor who only watches gets a largest paint of about eleven seconds in
   Chrome's field figures, because the first scene has nothing Chrome counts.
   The fix belongs in the sky. Say whether it must land before launch.

## Requests for the constellation lane

The stage reaches into the component with two style rules, in one block in
`HomeStage.svelte`. They can go when the component offers the same as props:

1. A way to fill its container, with no fixed height on the sky.
2. A way to set the inset of its legend and controls. The stage overrides
   `--edge`, which the component sets inline.
3. A notice that does not name "Latest and Archive below", which the new home
   page does not have.
4. A prop that tells it when it is off show, so it can rest. With the sky
   blurred on a machine with no graphics card, a frame took a median of 50
   milliseconds at full speed and 67 with the processor six times slower.
5. A prop for the stage that shows Zoom out and Reset only while they can act.
   At rest both are greyed, and they sit just above the stage's own two
   controls.
6. Keep the silhouette until the live stars are opaque. Today the silhouette
   is hidden as the live layer starts to fade in, so the stars blink out for
   about a third of a second as the page opens. An earlier film of the
   prerendered page caught it at 1.13 seconds. The final film's twelve frames
   did not.
7. Give the first scene a paint that Chrome counts as large: the first-paint
   silhouette as a picture at the sky's own size, for one. Chrome does not
   count vector shapes, so today the sky's largest paint is one word of its
   legend, and the next scene takes the largest paint when the stage moves.
8. The spec "the section arrives without a layout shift" fails now and then on
   a busy host. The nodes are the top bar's links, which move 12 pixels, and
   the "Browse the archive" link, which moves 3, both when a type file lands
   late. The score is 0.0001. In eight loads each with the type on time, it
   showed once on this branch, three times at `3fdff87` and twice on the
   constellation branch's own preview at `3319f4b`. It passed in this round's
   proof. Nothing in this lane touches those nodes.
