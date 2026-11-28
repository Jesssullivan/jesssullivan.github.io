# The home page as a heading stage and one mixed stream (TIN-8657)

Authority: rulings RM47 to RM50, Linear TIN-8594, the comment headed "Rulings
from the sixth interview" (`be2bf135`), November 23, 2026. Receipt under
R-HOOK-CONVERGENCE-20261004 (R-N13). Ticket: TIN-8657. The branch is
`feat/tin-8657-home-stage-stream`, stacked on the constellation branch
`feat/tin-8628-constellation-acceptance` (pull request 323).

Everything here sits behind one flag, `?flags=home`. With the flag off the site
behaves as it does on main.

## Her words

Her direction, verbatim, with one name left out:

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
| Files the page brings with it: the heron in the banner's frame, posters of her four dated videos | `src/lib/assets/home/`, resolved by `src/lib/home/assets.ts` |
| What the layout and the page share: the flag, and the new page once it has loaded | `src/lib/flags/home-state.svelte.ts` |

Recipes: `just home-stream` rewrites the data file, and `just home-stream-check`
fails when it is stale. Since round four the prebuild of `npm run build` rewrites
it too, and CI checks the committed copy. See "The stream at build time" under
round four.

### The stage

- **The sky** is `ReaderConstellation`, used through its props, as the
  constellation branch ships it at `0ebd70f`: full bleed, its legend and
  controls laid over it, nothing printed above it. The stage gives it the room
  with two style rules: it fills the stage, and its legend and controls line up
  with the page's edge. A plain wheel and a one-finger swipe scroll the page.
- **The heron** shows the frame of `static/images/header.png`, which is 672 by
  219 pixels. Rounds one and two said the repository held no larger original.
  That was wrong, and round three corrects it: `static/images/posts/img_8694.jpg`
  is the same photograph at 1200 by 1000 pixels, and the stage now serves the
  banner's frame cut from it. See "The heron photograph" under round three. The
  photograph is drawn as wide as the window, the size the site has always drawn
  it, and never taller than that shape. On a phone it is cropped to the bird.
  The brightness filter is gone.
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
- A post that has photographs in the gallery holds them: the post and its
  photographs are one item. Until round five the photographs were an item of
  their own straight after the post. See "The join rule" under round five.
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
- The play control of a recording is the bare sign in the accent, with no
  filled square behind it. Since round five a video's poster is its play
  control, with the same sign lying on it.
- Since round five the stream runs on two lines from 1100 pixels wide. See
  "The wide screen" under round five.
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
| The heron file | A lossy WebP of 32 kilobytes | An AVIF and a WebP made from the PNG at 672 by 219 pixels. Round three replaced both |
| The heron on a phone | The bill ran off the frame | The frame holds the head, the whole bill, the neck and the near wing |
| The heron's top falloff | The head, at the very top of the photograph, was half faded | A little shorter, so the head keeps its light |

One fault was found and fixed on the way. A fade on the whole stream section
laid it over the stage's controls for a second, and it took their presses.
The fade is on the flow now.

### The heron photograph

Round two wrote here that no larger original was in the repository or on this
host. That was wrong. The verifier found `static/images/posts/img_8694.jpg`,
the same photograph at 1200 by 1000 pixels, and round three uses it. The
figures of round two, for the record: the 672 pixel file was drawn at up to 2.9
times its size on a wide screen and up to 1.8 times on a phone.

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
4. Answered in round three: the heron is served from the 1200 pixel
   photograph the repository holds.
5. A visitor who only watches gets a largest paint of about eleven seconds in
   Chrome's field figures, because the first scene has nothing Chrome counts.
   The fix belongs in the sky. Say whether it must land before launch.

## Round three: the verifier's findings

Authority: her words on the restart, typed on November 25, 2026, verbatim:
"please fully reattach" and "(please reassert the extant lanes / dialogs /
reattach all worktrees, workstreams, subagents ...)  usage has been reset".
Receipt under R-HOOK-CONVERGENCE-20261004 (R-N13). The layout stays frozen at
`3fdff87`: no fix here moves a block.

An independent verifier read the head `e419602` and found five faults. All five
were real.

| Finding | Cause | Fix |
|---|---|---|
| The heron used a 672 pixel file while a 1200 pixel original sat in the repository | The photograph is in the repository under its camera name, and the earlier rounds did not find it | The stage serves the banner's frame cut from `static/images/posts/img_8694.jpg` |
| With the flag off every route asked for one more script, and the home page for three | The layout and the home page both imported the flag, so the bundler gave it a file of its own. The new page and the ordinary page both imported `$app/state`, so the bundler put it in one file with the sky | The layout alone imports the flag and hands it to the page in its context. The new page takes the address query as a prop |
| A key pressed on Pause or Next did not stop the play, and a step left it running | The stage listened for input on its scenes only | The stage listens on itself. A step stops the play |
| One constellation spec failed on a production build | Not traced. This branch held the sky as of `7cc315d` | It passes after the merge at `fafbe6c`, with no code changed for it |
| The constellation branch had moved and was not merged | The earlier run stopped on a usage limit before the merge was pushed | The signed merge `08f78f5` is pushed. The branch moved again during this round, to `d641158`, which takes in main at `8ae5ff2`. That is merged too, as `cb4e6d9` |

### The heron photograph

`static/images/posts/img_8694.jpg` is the photograph at 1200 by 1000 pixels.
The banner is that photograph scaled to 672 pixels wide and cut to 219 rows.
The cut was found by laying the banner over the scaled photograph at every
offset: the best match is 120 rows down, with a root-mean-square difference of
8.0 on a scale of 255. In the original that is all 1200 columns and rows 214 to
604.

| File | Size | Made with |
|---|---|---|
| `src/lib/assets/home/heron-1200.avif` | 1200 by 391 pixels, 52,375 bytes | sharp 0.34.5, quality 58, full chroma |
| `src/lib/assets/home/heron-1200.webp` | 1200 by 391 pixels, 58,240 bytes | sharp 0.34.5, quality 78 |

The two files of round two were 60,671 and 56,548 bytes, so the page is no
heavier. The frame and the focal point are the banner's, on a wide screen and
on a phone. `static/images/header.png` stays the fallback for a browser with
neither format.

No copy larger than 1200 pixels is in the repository. So the photograph is
still spread on a wide window, less than before:

| Window | Before | Now |
|---|---|---|
| 1440 pixels wide | 2.21 times | 1.24 times |
| 1920 pixels wide | 2.94 times | 1.65 times |
| A phone 390 pixels wide, density one | 1.86 times | 1.04 times |

The figures hold the drift's starting scale of 1.03. A phone screen of density
two or three spreads the file two or three times more.

### The flag off

Measured on November 25, 2026 in one headless Chromium, flag off, against a
production build of main at `8ae5ff2` and of the constellation branch at
`fafbe6c`. The same counts were measured earlier that day against main at
`7743096`. Requests, and scripts among them:

| Route | Main | Constellation branch | This head |
|---|---|---|---|
| `/` | 42, 20 scripts | 43, 21 scripts | 43, 21 scripts |
| `/blog` | 42, 18 scripts | 43, 19 scripts | 43, 19 scripts |
| `/music` | 32, 16 scripts | 33, 17 scripts | 33, 17 scripts |
| `/about` | 34, 16 scripts | 35, 17 scripts | 35, 17 scripts |
| `/photography` | 61, 16 scripts | 62, 17 scripts | 62, 17 scripts |

This lane now adds no request to any of the five. The one script both branches
ask for above main is an empty file of 22 bytes that the bundler writes for the
constellation branch: its whole text is one import of the router's own file.
The error page's code and the two constellation files name it. It comes with
the constellation branch and is request 10 at the end of this note.

JavaScript on the home page, gzip, counted from the files each load asked for:

| Load | Files | Bytes gzip |
|---|---|---|
| Main at `8ae5ff2`, flag off | 20 | 173,238 |
| This head, flag off | 21 | 165,179 |
| This head, flag on | 25 | 192,328 |

The flag on is 19,090 bytes above main. The limit was 40 kilobytes. The flag
off is 8,059 bytes below main, because the constellation branch moves the sky
out of the home page's own file.

An e2e test now reads every script the default home page asks for. It fails if
the flag's code is in any file but the layout's, or if a file holds the sky's
or the stage's code.

### Input on the stage

The stage now listens on itself, so its controls count as the stage.

| Input | Result |
|---|---|
| A press, a wheel or a touch on a scene | The play stops for the visit |
| Any key while a scene or a control has focus | The play stops for the visit |
| An arrow key on a control | Steps one scene, and the play stops there |
| A press on Next or Previous | Steps one scene, and the play stops there |
| A press on Pause, or Enter or Space on it | Pauses until Play |
| A press on Play, or Enter or Space on it | Plays again, and lifts a stop |
| Tab reaching a control | Nothing. The play runs on, so a keyboard can reach Pause |
| A mouse moving over a scene | Holds the scene, as before. See decision 1 of round two |

The rule is one function with no DOM, `inputStops` in
`src/lib/home/stageClock.ts`, with its own unit tests.

### Found on the way

- **A visitor who kept the older sky flag as well.** The constellation branch
  now keeps the sky's room from the first paint, by a script in the page head
  that reads the older flag. With both flags kept, a production build painted
  the ordinary page with that room, took the room away, and then changed pages:
  two moves. It also asked the hub for the older flag's two files before the
  layout had read this flag. Now the home page waits for the layout's answer,
  the room stays until the two pages change places, and the new page keeps no
  room above it. A preview build never shows the room. An e2e test holds this.
- **Play after a stop.** A visitor who stopped the stage, pressed Play, read a
  post and came back found the stage stopped. Play now lifts the stop for the
  rest of the visit.

### Measured

Measured on November 25, 2026 on a production build of the final tree, after
the second merge, in one headless Chromium. The contrast was measured one
build earlier, before a merge that changed two dependencies and no style.

| What | Result |
|---|---|
| Layout against the frozen build | 15 comparisons: the four scenes and the whole stream at 1440, 1920 and 390 pixels wide. 120 to 1,306 blocks each. Largest difference 0.00 pixels |
| Lowest contrast of the heron's type over what lies under it, glyphs and halo taken off | 10.54 to 1, pine light at 1440 and 1920. 30 measurements: 5 themes, 2 modes, 3 widths |
| Sideways scroll at 1440, 1920 and 390 pixels | None |
| A visitor with both flags kept | The room stays until the pages change places. No request leaves the site |

The frozen build is `e419602`, which the verifier measured at 0.0 pixels
against `3fdff87`. The compare ran with reduced motion, so no arrival offset or
drift is in the boxes. The sky's own insides are the constellation lane's and
are not compared. The contrast figure is the verifier's own for the same theme
and mode, so the sharper file changed nothing under the type.

### Proof

Each step ran through the host's gates on November 25, 2026, one at a time, on
the merged head `cb4e6d9`, after a fresh `npm ci`.

| Step | Exit | Result |
|---|---|---|
| Lint | 0 | Clean |
| Unit tests, `npx vitest run --config vitest.bazel.config.ts` | 0 | 45 files, 451 tests |
| svelte-check | 1 | 4 errors, all in `src/lib/flags/tailnet-hint.test.ts`, the 4 that main has. None added |
| The stream's data file against its sources | 0 | Current, 160 items |
| Production build, `MERMAID_PRERENDER=optional npm run build` | 0 | |
| e2e with one worker: this lane's spec and the two constellation specs, first run | 1 | 58 of 60 passed |
| The same, second run | 0 | 60 passed |

The e2e step ran six times in this round, and the failures are told here in
full.

| Run | Tree | Result | What failed |
|---|---|---|---|
| 1 | The fixes, before the test of the two flags | 59 of 59, exit 0 | |
| 2 | With that test | 59 of 60, exit 1 | The new test, and it was right. See below |
| 3 | With the fix it asked for | 59 of 60, exit 1 | The constellation spec at line 215: it waits five seconds for 30 animation frames and saw 17 |
| 4 | The same tree | 60 of 60, exit 0 | |
| 5 | The merged head | 58 of 60, exit 1 | Line 215 again, with 27 frames of 30, and the constellation spec at line 425, where the test read the star in focus before focus had come back to the map |
| 6 | The merged head | 60 of 60, exit 0 | |

Runs 3 and 5 took 4.7 and 6.9 minutes with the host's load between 35 and 60.
The runs that passed took 3.6 to 3.9. Both specs are the constellation lane's
and time the sky's own frames and focus. This lane's 25 tests passed in every
run but run 2. The cause is not proven beyond that timing.

The spec the verifier saw fail, "the picked post docks as a slim bar", passed
in all six runs. No code changed for it.

Run 2: the ordinary page read the older flag before the layout had read this
one, and asked the hub for the older flag's two files. The page now waits for
the layout's answer.

### The verifier's notes on the look

| Note | What was done |
|---|---|
| The heron is soft | Fixed, as above |
| The sky's legend and controls sit straight above the stage's own line of filters, progress, Pause and Next, so the stage's foot carries two rows | Not changed. Both rows were there at `3fdff87`, which she called beautiful, and the upper row is the sky's own. See request 9 at the end of this note |
| The stream opens with ten titles before its first picture | Not changed. It follows from the cover rule: none of those posts uses its cover in its own text. See decision 1 of round one |
| "Morning Metal 4.22.21" shows three times in a row: the post, its video and its recording | Not changed. Folding the three into one would move every block below them |
| Each set of photographs carries "N photographs" | Not changed. The count says the post holds more photographs than the row shows, and taking it off would move blocks |

### Decisions for her, round three

1. A press on Next now stops the play, as a key does. Say so if Next should
   step and let the play run on.
2. Tab reaching Pause leaves the play running. Many carousels stop when focus
   arrives. Say so if this one should.
3. The photograph is 1200 by 1000 pixels and the heading shows a band of it
   391 rows tall. The heron scene could show far more of the bird and fill the
   stage. That would change the layout she froze, so it waits on her word.
4. A larger original of the heron, if she has one, would be sharp at every
   width. The stage takes it with no code change beyond the file.
5. Whether a post, its video and its recording with one title should fold into
   one item in the stream.
6. Whether the count under a set of photographs should go.

Two more requests for the constellation lane are at the end of this note, as
9 and 10.

## Round four: the second verifier's findings

Authority: her words on the restart, typed on November 25, 2026, verbatim:
"please fully reattach" and "(please reassert the extant lanes / dialogs /
reattach all worktrees, workstreams, subagents ...)  usage has been reset".
Receipt under R-HOOK-CONVERGENCE-20261004 (R-N13). The layout stays frozen at
`3fdff87`.

A second independent verifier read the head `d464102`. Of its eleven checks
eight passed and two failed. Both faults were real. The eleventh was the proof
run, where one e2e test timed out once on a busy host.

| Finding | Cause | Fix |
|---|---|---|
| The stream was not built when the site builds | The data file was a committed snapshot. The prebuild never ran its generator. The one test of its freshness is skipped in the sandbox CI uses | The prebuild runs the generator. The CI build gate checks the committed file first. A unit test that runs in every sandbox checks the file against the posts |
| "N photographs" showed under sets whose photographs are all on screen | The count showed under every set of two or more | The count shows only where the post holds more photographs than the set shows |
| One e2e test hit its 30 second limit while the host's load was 85 | It held three page loads and three waits of four seconds | It is three tests, each with its own 30 seconds |

The constellation branch had not moved: it is at `d641158`, which `cb4e6d9`
already merged. No merge was needed.

### The stream at build time

| Where | What runs |
|---|---|
| `npm run build` | The prebuild rewrites the data file from the posts, the gallery, the Pulse snapshot and the Music page, after the gallery step. The production, parity and rollback workflows all build this way |
| The CI build gate, `//:sveltekit_vite_build_smoke` | The generator with `--check` runs before any step that writes a file, so a committed file that is not what the committed sources give fails the gate. The rewrite then runs before the build |
| The CI e2e gate, `//:playwright_chromium_e2e` | The same rewrite before its build |
| Unit tests, in every sandbox | Every published post is in the committed file with its date, title, summary and reading time, and no other post is |
| Unit tests where the gallery and the images are on disk | The whole file, byte for byte, as before |

So a built site never ships a stale stream, and a stale committed copy fails
CI. The gate was shown working: with one published post added to `src/posts`,
the generator's `--check` exited 1 and the unit test exited 1. With the post
removed both passed.

A new, withdrawn, renamed, redated or retitled post now needs
`just home-stream` and a commit of the data file. The constellation branch
asks the same for its projection with `just posts-projection`. See decision 1.

The two Bazel targets were not run on this host. Their runner scripts gained
the steps above, and CI runs them on the pull request.

### The count under photographs

Nine sets hold two or more photographs.

| Sets | Count before | Count now |
|---|---|---|
| Six whose photographs are all on screen: `research-year-two-three-photos`, `solar-upgrades`, `840-watts-of-solar-power`, `birding-at-plumb-island`, `gallery-of-warblers-in-the-hand`, `mega-langdon` | "3 photographs", "3", "3", "4", "3" and "2" | None |
| Three whose post holds more than the five on screen: `gallery-of-my-proper-photos-nh-warbler-research`, `rugby-morning-2`, `example-photo-work` | "22 photographs", "9" and "9" | The same |

The rule is one function, `setTotal` in `src/lib/home/stream.ts`, with a unit
test. An e2e test reads every set under the Photos filter: a count is always
larger than the number of photographs on screen.

Under its own writing a set's caption held only the count. The room that
caption took, 26 pixels, stays as blank space under those six sets, so no
block below them moved. See decision 2.

Under the Photos filter a caption also holds the post's title. On a phone two
captions had wrapped the count onto a second row. That row went with the
count, so the filtered page at 390 pixels wide is 36 pixels shorter. Nothing
else moved.

### The layout check

Measured on November 25, 2026 on the final build, with reduced motion, in one
headless Chromium. Every block outside the sky's own insides and outside a
set's caption was measured.

| Compared with | Views | Result |
|---|---|---|
| The frozen build `3fdff87` | The four scenes and the whole stream at 1440, 1920 and 390 pixels wide: 15 views, 120 to 1,288 blocks each | Largest difference 0.00 pixels. Every page height is the same |
| The last head `d464102` | The same 15 views | Largest difference 0.00 pixels. Every page height is the same |
| Both | The Photos filter at 1440 and 1920 pixels, 165 blocks | Largest difference 0.00 pixels |
| Both | The Photos filter at 390 pixels, 157 blocks | The page is 36 pixels shorter, as said above |

### The verifier's notes on the look

| Note | What was done |
|---|---|
| On a wide screen the stream is one narrow column, about 40 percent of the width is empty, and ten titles come before the first picture | Not changed. This is the layout she saw and called beautiful. Decision 3 |
| The heron at 1920 pixels is a soft strip 391 rows tall, with bare ground above and below | Not changed. This round's direction keeps the banner's frame. Decision 3 of round three |
| The sky's own legend and controls sit above the stage's filters and controls | Not changed. They are the sky's own. Request 9 |
| A post, its video and its recording with one title run back to back | Not changed. Folding them moves every block below. Decision 5 of round three |
| On a production build with the flag on, the layout shift is 0.03 to 0.06 and the largest paint is the old banner | Not changed. The ordinary page paints first, and it scores the same shift with the flag off. A preview build paints the new page first. Decision 7 of round one |
| The heron falls back to the 672 pixel `header.png` | Only in a browser with neither AVIF nor WebP. Not changed |

### Measured

| What | Result |
|---|---|
| JavaScript on the home page, flag on | 25 scripts, 192,397 bytes gzip: 28,398 above the branch point with the flag off, and 27,209 above this head with the flag off |
| JavaScript on the home page, flag off | 21 scripts, 165,188 bytes gzip. The branch point has 21 scripts and 163,999 bytes |
| Requests the flag-off home page makes | 44, the same as the branch point. None leaves the site |
| The stream's data file | 160 items: 140 writing, 13 sets of photographs, 3 recordings and 4 videos. The build left it unchanged |

The branch point is the constellation branch at `d641158`, built by the
verifier. The limit for the flag on was 40 kilobytes above the flag off.

### Proof

Each step ran through the host's gates on November 25, 2026, one at a time, on
the final tree.

| Step | Exit | Result |
|---|---|---|
| Lint | 0 | Clean |
| Unit tests, `npx vitest run --config vitest.bazel.config.ts` | 0 | 45 files, 453 tests |
| svelte-check | 1 | 4 errors, all in `src/lib/flags/tailnet-hint.test.ts`, the 4 that main has. None added |
| The stream's data file against its sources | 0 | Current, 160 items |
| Production build, `MERMAID_PRERENDER=optional npm run build` | 0 | The prebuild ran the generator and left the file unchanged |
| e2e with one worker: this lane's spec and the two constellation specs | 0 | 63 passed in 4.0 minutes |

The e2e step ran twice. The first run stopped moving at test 18 of 63, a
constellation spec. It was stopped by hand 28 minutes later, with no test
failed and none passed after that point. Another lane's Bazel build held 5.5 GiB in the host's shared slice for
heavy jobs, which slows every job in it at 6 GiB. The second run waited for
room in that slice and passed all 63. The count is 63 where round three had
60: one test became three, and one is new.

### Decisions for her, round four

1. A post that is new or changed now fails CI until `just home-stream` is run
   and the data file committed. The built site is right either way, because
   the build rewrites the file. Say so if this gate should go and the build
   alone should keep the stream current.
2. The 26 pixels of room under six sets of photographs can close. It stays
   only so that nothing she saw moved.
3. Whether the stream on a wide screen should use more of the width, or bring
   a picture into its first screen. Either changes the layout she froze.

## Round five: fold duplicates and the wide screen

Authority: ruling RM66, Linear TIN-8594, the comment headed "Rulings from the
tenth interview" (`f3addd06`), November 26, 2026. Ruling RM64, in the comment
headed "Rulings from the ninth interview" (`08b21293`), lifts the layout
freeze: her praise was for another page. Receipt under
R-HOOK-CONVERGENCE-20261004 (R-N13).

Her words, verbatim:

| Id | The question, as put | Her answer |
|---|---|---|
| RM66 | Which of four things should home page round three change, pick any | "One row of controls, Fold duplicates, Use the wide screen" |
| RM64 | Which page "in chrome, the layout is beautiful!" meant | "The xoxd.ai sky" |
| On the restart, November 26, 2026 | | "(please reassert the extant lanes / dialogs / reattach all worktrees, workstreams, subagents, review the current ouputs and states and plans and goals etc)  usage has been reset, apologies for the interuption/status" |

She did not pick the fourth choice, "More of the heron". The heron scene is as
it was.

This round did two of her three picks. The third, one row of controls in the
sky scene, needs changes inside the sky's own files, which another lane holds.
The two rows are as they were. Request 11 at the end of this note lists the
props it needs.

The interview calls this round three. It is the fifth section of this note,
after two rounds of verifier fixes, so it is round five here.

An earlier run of this round stopped on an account usage limit. It left the
join rule half built and three sketches drawn. This run went on from both.

### The join rule

A post, its photographs, its video and its recording show as one item. The
stream builder joins them at build time, in `foldStream` in
`src/lib/home/stream.ts`, from data the site has.

1. A set of photographs joins the post whose address it carries. The set is
   built from that post's own text, so the link is certain.
2. A recording or a video joins a post when three things hold. Both titles
   open with the same words before a day written in the title. The day its
   title states is its own date. That day is the post's date or the day the
   post's title states. If two posts answer, it joins neither.
3. Recordings and videos that no post answers join each other when their
   titles state the same words and the same day.

A title that states no day joins nothing by rules 2 and 3, so a shared series
name joins nothing. The words must be the same words: "Shortest Morning Metal"
is not "Morning Metal". A day is month, day and year with one separator used
twice, and the year has two digits or lies from 1990 to 2099.

The folded item keeps the post's title, summary, address and date. Each
recording and video keeps its own title, day, address and note on its media,
so its play control and its tooltip name it.

Every group the rule forms today:

| Lead | Holds | Why |
|---|---|---|
| `post:morning-metal-4-22-21`, "Morning Metal 4.22.21 “Sleepish”", April 23, 2021 | The recording `track:morning-metal-42221` and the video `video:JVusudpKTF8` | Rule 2. The recording's title states April 22, the day the post's title states. The video's title states April 23, the post's date |
| `video:jrxJHwmtwak`, "Shortest Morning Metal 7 8 20" | The video `video:nVkjCMmpUII` | Rule 3. One title, one day, and no post answers |
| 13 posts | Each its own set of photographs | Rule 1 |

The 13 posts: `week-notes-indeterminism-passkeys-and-spring`,
`week-notes-cyborgs-servers-and-sending`,
`xram-injection-bypassing-usb-bridge-whitelists-to-recover-nvme-drives`,
`research-year-two-three-photos`, `solar-upgrades`,
`840-watts-of-solar-power`, `birding-at-plumb-island`,
`signs-of-thoughts-of-possible-spring`,
`gallery-of-my-proper-photos-nh-warbler-research`,
`gallery-of-warblers-in-the-hand`, `rugby-morning-2`, `mega-langdon` and
`example-photo-work`.

So 16 parts fold into 15 items: 13 sets of photographs, 1 recording and 2
videos.

| | Items | Writing | Photographs | Recordings | Video |
|---|---|---|---|---|---|
| Before | 160 | 140 | 13 | 3 | 4 |
| After | 144 | 140 | 13 | 3 | 3 |

After the fold a count says how many items hold that kind, so a folded item is
counted under each kind it holds. The counts add up to 159 for 144 items. The
video count falls by one because two videos are now one item.

A filter shows the whole folded item under every kind it holds. Under
Recordings the post "Morning Metal 4.22.21 “Sleepish”" shows with its title,
its recording and its video. The generator prints every group it forms, so a
wrong join shows in the log of the run that made it.

Unit tests hold the near misses:

| Case | Result |
|---|---|
| The same words with another year in the title | Not joined |
| The very same title on a recording whose own date is another day | Not joined |
| A title with no day, the same on a post and a recording of one date | Not joined |
| A video whose title only contains a post's title, before or after it | Not joined |
| Two posts that both answer | Joined to neither |
| Two videos of one title and one day, beside one of the next day | The two joined, the third not |
| The sources in reverse order | The same bytes |

Left alone, and why:

- "...In other news..." links the recording "Evening Metal 9.14.20" in its
  text, and "some boilerplate code, ?, etc" links "Morning Metal 12.17.20".
  Neither title shares words and a day with its recording, so neither is
  joined. See decision 2.
- The video "Morning Metal 10/28/20" has the date of the post "...In other
  news...". The post's title states no day, so they are not joined.

### The wide screen

Three compositions were drawn first as one page of plain HTML over the real
stream data, and shot at 1440 and 1920 pixels wide, light and dark.

| Sketch | The idea | What the screenshots showed |
|---|---|---|
| A, two lines | Words on a first line down the page. What there is to see starts on a second line and runs to the edge of the screen. A piece with nothing to show sets its summary on the second line | Every photograph whole. A run of posts with no picture still fills the width, as title and summary side by side. One order, top to bottom |
| B, two banks | Pieces step from the left bank to the right and back, each a little lower | Titles start at four different places. Pictures change sides. Two posts side by side read as tiles, and the order is hard to follow |
| C, plates | One column of large type. A picture comes in from the right, and its near edge dissolves into the page under the type | The largest type and the deepest feather. But a third of every photograph fades away, and a title ran onto a busy picture. A run of posts with no picture still left half the screen empty |

A was built. It is the only one that answers the plain list: 115 of the 140
posts have no picture of their own, and A gives those a form that uses the
width. It keeps her photographs whole. It keeps one reading order. From C it
takes the larger type and the feather, used only where type does lie on a
picture, which is a video's poster.

What was built, from 1100 pixels wide:

- Two lines run down the stream. Every title starts on the first. The second
  starts at the same place for every item.
- A piece with nothing to show sets its summary on the second line. The
  summary's first line stands on the baseline of the title's first line.
- A picture, a set of photographs or a video starts on the second line, level
  with the top of its title, and runs out to the right edge of the screen.
- A picture is never drawn wider than its file. Its lead is never taller than
  72 percent of the screen, so a tall or square one is narrower.
- The summary keeps a measure of 29 ems, about 70 characters. The title is
  larger on a wider screen, up to 40 pixels.
- A run of words alone sits close. Something to see takes more room above and
  below it, and a new month takes the most. There is no rule and no box.
- A video's poster is its play control. The sign, and the day when the video
  is held by a post, lie straight on the poster on a feather of the page's
  ground: near solid as far as they reach, then a long falloff.
- A recording a post holds has its play control and its own day under the
  post's words. A recording of its own hangs its play control in the month's
  rail, so its title starts where every title starts.
- A tooltip on a held play control gives the name of what plays.
- The first picture is in the first screen of the stream. See "Measured".

Below 1100 pixels the stream is one column, as before, with the picture under
the words. What changed on a phone:

- A post and its photographs were two items, 1.5 rems apart. They are one
  item, 1.1 rems apart.
- A summary above a picture may run four lines where it ran two.
- A video's play control lies on its poster. It sat under it.
- A picture is not drawn wider than its file. Two small ones in old posts
  were.

Gone with the freeze: the 26 pixels of spare room under six sets of
photographs, and the separate form a set of photographs had.

The new motion is one thing: a player fades in out of a short blur where it
lands, on the page's soft curve. With reduced motion it just shows.

### Three passes

Each pass was a production build, shot whole and in parts through one
headless Chromium, then read.

| Pass | Shot | Seen | Changed |
|---|---|---|---|
| 1 | 1440 pine light and catppuccin dark, 1920 rose light and pine dark, 390 pine light and rose dark | A summary stood on its title's last line, not its first. A square lead filled a 1080 pixel screen. The first picture showed only 130 pixels in the first screen | The summary stands on the first baseline. Every lead is capped at 72 percent of the screen's height. The month's room is a rem less |
| 2 | The same six | On a phone the feather covered half a poster and the day wrapped onto two lines. The summary sat a little low | A smaller feather below 1100 pixels, and the day on one line. The rise corrected |
| 3 | The six, and 1440 rose dark, 1920 catppuccin light, 390 catppuccin dark, 1100 and 1024 pine light | 1100 pixels, the first width with two lines, and 1024, the widest with one column, both hold. On a poster with no day the feather reached far past the sign | A smaller feather where the sign stands alone |

The screenshots of the three passes and of the sketches are on the build host
under `/srv/fast-local/jess/previews/blog-home/shots-work/round3/`.

### Measured

Measured on November 26, 2026 on a production build of this round's tree, in
one headless Chromium.

| What | Result |
|---|---|
| The first picture of the stream, with the stream's top at the top of the screen | 649 pixels down a 900 pixel screen at 1440 wide, and 758 down a 1,080 pixel screen at 1920. Before, it was below ten titles |
| The same on a phone of 390 by 844 pixels | 949 pixels down, as before. The newest three posts have no picture of their own |
| Sideways scroll at 1440, 1920, 1100, 1024 and 390 pixels wide | None |
| Layout shift down the whole stream, every part pressed open, at 1440, 1920 and 390 pixels wide, in three themes | 0 |
| The page's height with every part pressed open | 39,586 pixels at 1440 wide, 46,605 at 1920 and 38,532 at 390 |
| JavaScript on the home page, flag on | 25 scripts, 193,109 bytes gzip |
| JavaScript on the home page, flag off | 21 scripts, 165,523 bytes gzip |
| The flag's cost | 27,586 bytes above the flag off on this build. 19,871 above main's 173,238, measured in round three at `8ae5ff2`, where main still is. The limit is 40 kilobytes |
| Requests on the home page | 44 with the flag off, as at round four. 54 with it on. None leaves the site |
| The stream's data file | 73,197 bytes, 21,212 gzip. Round one measured 75,942 and 21,335 |
| Lowest contrast of a video's day over its poster, with the glyphs and their halo taken off | 9.39 to 1, pine dark. 30 measurements: 5 themes, 2 modes, 3 widths |
| Lowest contrast of the play sign over its poster | 3.81 to 1, catppuccin light. It is the accent, as in round one, and a sign needs 3 to 1 |

The first contrast run found a fault. On a phone the day's last letter stood
where the feather had begun to fall off: 4.80 to 1 over a white poster in pine
dark. The ground now holds further on a small poster, and the figure above is
the second run's.

The throttled load figures of round two were not measured again. The first
screen's code, type and pictures are the same files.

### Proof

Each step ran through the host's gates on November 26, 2026, one at a time.

| Step | Exit | Result |
|---|---|---|
| Lint | 0 | Clean |
| Unit tests, `npx vitest run --config vitest.bazel.config.ts` | 0 | 45 files, 463 tests. Ten are new, for the join rule |
| svelte-check | 1 | 4 errors, all in `src/lib/flags/tailnet-hint.test.ts`, the 4 that main has. None added |
| The stream's data file against its sources | 0 | Current, 144 items |
| Production build, `MERMAID_PRERENDER=optional npm run build` | 0 | The prebuild ran the generator and left the file unchanged |
| e2e with one worker: this lane's spec and the two constellation specs, first run | 1 | 63 of 65 passed |
| The same, second run | 0 | 65 passed in 4.6 minutes |

The first e2e run failed two of this lane's own tests, and both were right to
fail. One still asked every play control for the tooltip "Play", where a held
recording now names what plays. The other found no heading by its name: a
title's tooltip is drawn by the style sheet, and the browser counted it in
the link's name. The tooltip now carries empty alternative text, and the test
finds a title by its text. The 40 constellation tests passed in both runs.

Lint, the unit tests and the data check ran before the last two style
changes. Lint and svelte-check ran again after them, with the build.

Two tests are new. One reads a post, its video and its recording as one item
under each of its three filters, and presses each player. One reads the two
lines at 1440 and 1920 pixels wide: one start for every title, one for every
picture and summary, a picture in the first screen, and no summary wider than
640 pixels.

The hosted gate is red on this branch for constellation tests that another
lane is fixing. This lane did not wait for hosted checks.

### Decisions for her, round five

1. The video "Morning Metal 04.23.21" is folded into the post "Morning Metal
   4.22.21 “Sleepish”" because the day in its title is the post's date. If
   that video is of another morning, say so, and the rule will ask for the
   same day in both titles.
2. Two posts link a recording in their text and are not joined to it:
   "...In other news..." and "some boilerplate code, ?, etc". A rule that
   joins a recording to any post that links it would join both, and would put
   a recording of September under a post of October.
3. The two videos named "Shortest Morning Metal 7 8 20" are one item with two
   posters.
4. On a wide screen a picture runs to the right edge of the screen, and the
   left margin stays.
5. The newest three posts still show no cover, by the cover rule. So the
   first picture of the stream is the fourth item's.
6. One row of controls in the sky scene is not done. It waits on the
   constellation lane and request 11.

## Round six: one row of controls

Authority: ruling RM66, Linear TIN-8594, the comment headed "Rulings from the
tenth interview" (`f3addd06`), November 26, 2026. Receipt under
R-HOOK-CONVERGENCE-20261004 (R-N13). The workflow that ran this round calls it
round four, and its screenshots are in a folder named `round4`. It is the sixth
section of this note.

Her words, verbatim:

| Id | The question, as put | Her answer |
|---|---|---|
| RM66 | Which of four things should home page round three change, pick any | "One row of controls, Fold duplicates, Use the wide screen" |
| RM59 | Which model does design work on the home page and the constellation | "fable is back.  execute UX, devlpoment ooin human facing "wow" woth fable andopus for non UX" |
| RM46, as this lane's brief quotes it | What the constellation needed | "full bleed, tooltips, and removing undeeded headers / descirioptions  / labining thngs that are self ev eident" |

Round five did "Fold duplicates" and "Use the wide screen". This round does
"One row of controls". She did not pick "More of the heron", and the heron
scene is as it was.

The constellation merged to main as pull request 323, at `759c1e80`. No other
lane holds its files now, so this round changes them. The branch took main
first, in the signed merge `c2464fbb`.

### The design in ten lines

1. One row at the foot of the stage, in every scene, on the page's ground.
2. The stream's filters stand at its left end, on the page's left edge.
3. At its right end stand the progress line, Pause and Next. They never move.
4. While the sky shows, the sky's controls stand just before them: Zoom in,
   the list and the help.
5. Reset and Zoom out are there only while they can act. They stand to the
   left of Zoom in, outside the run of the row, so nothing else moves.
6. The sky draws no control of its own on this page. Its legend lies along the
   top edge of the stage, under the site bar, as one quiet line.
7. The stars take the room the legend and the controls left at the foot.
8. The help and the list open from the row. The help opens just above it.
9. On a narrow screen the filters show as the current word. On a phone the
   zoom pair is in the help and the progress line lies under Pause and Next.
10. The constellation's own page is the same pixels as on main.

### What the sky offers now

Four props on `ReaderConstellation.svelte`. Each default leaves the
constellation's own page and its `?flags=constellation` view as they are.

| Prop | Values | What it does |
|---|---|---|
| `legend` | `'foot'`, the default, `'head'` or `'none'` | `'head'` lays the legend along the top edge at the same inset. The strip the stars keep clear of moves to the head with it, and the map fades out under it there. On a phone a picked post docks at the top, over the legend, as it docks over it at the foot today |
| `controls` | `'own'`, the default, or `'none'` | `'none'` draws no control. The page calls `toggleList()`, `zoomIn()`, `zoomOut()`, `resetView()` and `toggleHelp()`, and `onviewstate` reports `canZoomIn`, `canZoomOut`, `canReset`, `listOpen` and `helpOpen` when one of them changes |
| `inset` | A CSS length, or left out | The inset of the legend and the controls from the sides. It replaces the stage's style rule that overrode `--edge` |
| `lists` | `true`, the default, or `false` | `false` on a page with no Latest and Archive under the sky. No notice then points at them |

`SKY_CONTROLS`, exported from the same file, holds the name and the icon of
each control: "Show as a list", "Show the map", "Zoom in", "Zoom out", "Reset"
and "How it works". The sky draws its own five from it, and the stage draws
its row from it, so both say the same words as label and as tooltip.

`helpActions` is a snippet the page may hand over. The sky draws it at the head
of the help. The stage uses it for the zoom pair on a phone.

Opened from a control outside the sky, the help takes focus, and Escape or a
second press gives focus back to that control. The list does the same: focus
lands at its head, Tab reaches its first post, and Escape goes back to the
control. Both are for a keyboard: the row comes after the list in the page.

With the legend at the head and no control of its own, nothing lies along the
foot of the sky. The field keeps its size and moves down one and a half rems
on a wide screen, so the stars are the size they are on the constellation's
own page.

### The row

| Width | The left end | The right end, in the sky scene |
|---|---|---|
| Above 900 pixels | The five words | Reset and Zoom out while they can act, Zoom in, the list, the help, the progress line, Pause, Next |
| 561 to 900 pixels | The current word. A press lays the five words out across the row, in place of the controls | The same |
| Up to 560 pixels | The same | Reset while it can act, the list, the help, Pause, Next. The progress line lies under Pause and Next |
| Up to 350 pixels | The same | The list, the help, Pause, Next. Reset is in the help |

In the heron scene and in a placed scene the sky's controls are not there. The
filters, the progress line, Pause and Next stand where they stood: a test
holds their places to the pixel.

Reset alone stands next to Zoom in. When Zoom out joins it, Reset moves one
place out, by a transform. Both arrive from under Zoom in, on the stage's
quick curve, in half a second. With reduced motion they just show. No control
is greyed: one that cannot act is not drawn, cannot take focus and has no
tooltip. If focus was on it as it left, focus goes to a control beside it that
still can act.

What is folded on a phone, and why. At 390 pixels the row has 361 pixels
between its paddings. The five words alone need 351, and seven controls need
308. So two things fold:

- The filters fold to the current word, at every width up to 900 pixels. The
  words are one press away, they fill the row, and each is a target 44 pixels
  high and at least 44 wide.
- Zoom in and Zoom out fold behind the help, up to 560 pixels. They are the
  least used there: two fingers zoom on a touch screen, and the help says so.
  They are in the help by name, 44 pixels high, so one finger can still zoom.
  Reset stays in the row, because one press of it is the quickest way back
  to the whole map.

At 390 pixels the legend is two lines at the top, not one. Eight words with
their dots are 520 pixels wide at their size, and no control may ask for a
sideways scroll.

### Earlier claims this round changes

- The row comes after the scenes in the page. So Tab reaches the legend and
  the map before Pause in the sky scene, and focus that lands in a scene stops
  the play, as it did. In the heron scene Tab still reaches Pause with the
  play running.
- Up to 900 pixels wide the filters were a second row of words under Pause and
  Next. They are in the row, and the stream starts 44 pixels higher.
- The two style rules by which the stage reached into the sky are one rule
  now. It gives the sky its height.
- A press on a filter word does not stop the play. It did not before either,
  when the filters were the stream's.

### Two small fixes in the same files

- The notice "The map did not load. Latest and Archive below have every
  post." reads "The map did not load." on the home stage. The two other
  notices lose their pointer to Latest the same way.
- The star "Succession, Warblers, and GIS." is the first star Tab reaches. Its
  ring was drawn on the canvas only, so its link had no outline of its own.
  The link now draws a real outline exactly on that ring: the same centre,
  radius, width and colour. While the keyboard is on a star, its link follows
  the map frame by frame. Every star has it, on both pages.

### The passes

Each pass was a production build, shot through one headless Chromium and
read. The sky scene, each other scene and the join were shot whole and in
parts at 1440, 1920 and 390 pixels wide, light and dark, in pine, rose and
catppuccin. The states were shot too: a star picked, zoomed in, the help open,
the list open, a tooltip, a star reached by Tab, the words open on a phone.

| Pass | Shot | Seen | Changed |
|---|---|---|---|
| 1 | 1440 and 390 pine light, every state | The legend's first dot stood 8 pixels right of the first filter word: the site's style sheet pads anything named `legend`. A control's tooltip lay over the open help | With an inset given the legend has no padding of its own. An open help has no tooltip. The star's outline went in with these |
| 2 | 1440 pine light and catppuccin dark, 1920 rose light and pine dark, 390 pine light and rose dark | The legend's words were darker than the filter words under them, so the top line was the louder of the two. On a phone the sky's pair and the stage's pair stood evenly, as one run of four | Along the top edge the legend's words step back to 72 percent ink until one is pointed at or picked. The two pairs stand 6 pixels apart |
| 3 | The six, and 768, 1024 and 320 pixels wide and 390 catppuccin light. The row, the legend, the focus ring and a tooltip cut out and enlarged | The row holds at every width. The outline and the canvas's ring read as one ring. The icons of the sky and of the stage are one weight | Nothing |

Up to 350 pixels Reset is in the help by arithmetic, not by a look: at 320
pixels the row has 301 pixels, and Reset beside the word "Recordings" would
need 316.

The screenshots are on the build host under
`/srv/fast-local/jess/previews/blog-home/shots-work/round4/`.

### Measured

Measured on November 26, 2026 on a production build of this round's tree and
on a build of main at `759c1e80`, in one headless Chromium.

| What | Result |
|---|---|
| The constellation's own view at rest, `?flags=constellation`, main against this head | The same pixels. Eight cases a run: 1440 by 900 and 390 by 844, light and dark, with motion allowed and with it reduced. The sky's own picture was identical in all 48 comparisons of six runs. Its markup and the place, size and colour of every control, legend word and name were the same too |
| The whole screen in those runs | Identical in 46 of 48. See the two below the table |
| The site's moving background in that comparison | Taken out of both pictures. It is drawn afresh on every load. In the first run, with it in, main against main differed in 207,442 to 566,951 pixels of the sky's picture |
| The row | 44 pixels high at every width. One line. Every icon control in it is 44 pixels square, and every word is 44 pixels high and at least 44 wide |
| Sideways scroll at 320, 390, 768, 1024, 1440 and 1920 pixels wide, in the sky scene | None |
| The row on a phone of 390 pixels | 361 pixels between its paddings. The one word "All", the list, the help, Pause and Next take 244 with the room between the two pairs, and 288 with Reset |
| Lowest contrast of a legend word along the top edge | 5.77 to 1, pine light on a phone. 20 pages: 5 themes, 2 modes, 1440 and 390 pixels wide, with the glyphs and their halos taken off |
| Lowest contrast of a filter word that is not the current one | 5.63 to 1, pine light |
| Lowest contrast of a row icon and of the current filter word | 11.59 to 1, pine light |
| The home page, flag off, on main | 44 requests, 21 scripts, 164,340 bytes of script gzip |
| The home page, flag off, on this head | 44 requests, 21 scripts, 165,552 bytes. The same count as main, and 1,212 bytes more, which is the cost of reading the flag since round one |
| The home page, flag on | 54 requests, 25 scripts, 195,810 bytes. That is 31,470 above main with the flag off. The limit is 40 kilobytes. Round five measured 193,109, so the row cost 2,701 |
| `?flags=constellation` on main and on this head | 46 requests and 24 scripts at 182,248 bytes on main. 45 requests and 23 scripts at 184,432 bytes here. One request fewer, and 2,184 bytes more for the props |
| `/blog` on main and on this head | 43 requests and 19 scripts on both |
| Requests that leave the site, flag on | None |

The two whole-screen differences. In one run 12 pixels differed by 2 steps at
most. A later run, which records the place, found the same 12 pixels in main
against main: columns 1101 and 1102, rows 4 to 11, in the site bar. In another
run 133,004 pixels differed by 8 steps at most at 1440 pixels wide, dark, with
motion reduced. The sky's own picture, taken a moment earlier in that run, was
identical. Where those pixels lay was not recorded, and the three runs after
it showed none.

The throttled load figures of round two were not measured again. The first
screen's pictures and type are the same files.

### Proof

Each step ran through the host's gates on November 26, 2026, one at a time.

| Step | Exit | Result |
|---|---|---|
| Lint | 0 | Clean |
| Unit tests, `npx vitest run --config vitest.bazel.config.ts` | 0 | 45 files, 470 tests. Seven are new, for the sky's props, and one has two new lines for the view helper |
| svelte-check | 1 | 4 errors, all in `src/lib/flags/tailnet-hint.test.ts`, the 4 that main has. None added, and no warning added |
| The stream's data file against its sources | 0 | Current, 144 items |
| Production build, `MERMAID_PRERENDER=optional npm run build` | 0 | The prebuild ran the generator and left the file unchanged |
| e2e with one worker: this lane's spec and the two constellation specs | 0 | 78 passed in 3.9 minutes, twice in a row, at `4fc2b999`. The runs before those are in the table below |

Lint, the unit tests, svelte-check, the data check and the build ran at
`68a1cd90`. The commits after it change only this lane's e2e spec and this
note. The e2e runs below used that build.

Both constellation specs are as main has them: no line of either changed.
Thirteen e2e tests are new, all in this lane's spec. They hold the one row,
the legend's place, Reset and Zoom out coming and going with nothing else
moving, the order of focus, the help and the list by keyboard, the other
scenes, the star's outline on both pages, the notice on both pages, the
constellation's own five controls and legend, and three for a phone.

The e2e step ran seven times. The first five failed and the last two
passed. Each failure is named here.

| Run | Result | What failed, and why |
|---|---|---|
| 1, this lane's spec alone | 38 of 43 passed | Five new tests. Three for a phone waited to see Zoom in, which is not in the phone's row. One read two places while a control still slid. One opened the home flag before the constellation's own page, and the flag is remembered |
| 2 | 77 of 78 passed | One new test read Zoom in's place in the last frames of its slide, one pixel off |
| 3 | 75 of 78 passed | A constellation test, "every star has at least 3 to 1 against the sky as drawn": the map's links were not in the page after five seconds on one of its four loads. It passed in the five other runs that held it. This lane's older self-play test: at twelve times the pace the sky shows for three quarters of a second, and a look once a second missed it twice. It now writes each scene down as the stage changes it. One new phone test: two controls side by side rounded to share a pixel |
| 4 | 77 of 78 passed | The same new test as run 2, at a later line |
| 5 | 77 of 78 passed | The same test. The browser driver tries a press again when its target still moves, and on the third try it scrolls the target to the middle of the screen. Reset was pressed in the tail of its slide, and the page scrolled 298 pixels. The tests now wait for the row's transitions to end before such a press |
| 6 | 78 passed in 3.9 minutes | |
| 7 | 78 passed in 3.9 minutes | |

The hosted gate fails now and then for a dropped local file fetch that
another lane is fixing under TIN-8867. This lane did not wait for hosted
checks.

### Decisions for her, round six

1. On a phone the filters show as one word, and a press lays the five out.
   The other way to fit 390 pixels is two rows.
2. On a phone Zoom in and Zoom out are in the help. Reset is in the row.
3. Reset stands to the left of Zoom out, and both to the left of Zoom in:
   Reset, Zoom out, Zoom in, the list, the help.
4. The legend along the top edge is quieter than at the foot of the
   constellation's own page: 72 percent ink until pointed at.
5. A star reached by Tab draws a real outline on the constellation's own page
   too. It lies on the canvas's ring, so the page looks the same.

## Round seven: the wide stream, with pictures

Authority: ruling RM70, Linear TIN-8594, the comment headed "Rulings from the
eleventh interview" (`33157987`), November 26, 2026. Receipt under
R-HOOK-CONVERGENCE-20261004 (R-N13). The workflow that ran this round calls it
round five, and its screenshots are in a folder named `round5`. It is the
seventh section of this note.

Her words, verbatim:

| Id | The question, as put | Her answer |
|---|---|---|
| RM70 | Which weak points should the next home page round take on? | "Wide stream with pictures,  lets try to remove dated / gated blockers to motor ahead!  I think a larer original is available somewhere" |

She did not pick sharpening the heron by capping its size, a change to what
paints first, or stopping here. The stage, its four scenes and its one row of
controls are as they were. The heron scene is as it was.

The problem, in the last verifier's words: below the stage, on a wide screen,
the stream reads as a typeset index of mostly text-only rows, with long runs of
old excerpts that begin with stray marks, and few pictures to break them.

### The design in ten lines

1. Every picture a post's own text shows joins its item, in the post's order.
   The cover rule stays.
2. From 1100 pixels wide a picture takes its form from what it is and how it is
   shaped. Nothing is placed by hand, and nothing by chance.
3. One of her photographs, wide, is a plate. It starts on the first line, where
   every title starts, and runs toward the right edge of the screen.
4. A plate carries its title, at its foot, on a feather of the page's ground:
   near solid exactly as far as the title reaches, then a long falloff.
5. Any other picture stays beside its words on the second line, as before: a
   tall or square one, a drawing, a screenshot, a video's poster.
6. A post's other pictures stand in one row under the lead, at one height. No
   picture is drawn larger than its file.
7. Words stay words. A title set as words is a step smaller than a title on a
   plate, and a run of words sits closer.
8. An excerpt is her own text cut shorter, or it is absent. It is cut where
   the stream is built, at a sentence end.
9. A plate's photograph drifts a little inside its frame as it crosses the
   screen. The browser reads the scroll for it. With reduced motion it is
   still.
10. Pictures load lazily, with their sizes set, in AVIF and WebP, and a small
    size serves a row, a picture beside its words and a narrow screen.

### The pictures

The builder reads every picture a post's own text shows: a Markdown image or an
image tag, in the order of the text, each once. A picture named inside a code
block is not shown by the post, so it is not read.

| Rule | What it does today |
|---|---|
| The cover rule, kept | A cover shows only when the post's text uses that file. 115 posts show no cover |
| A drawing the text shows as SVG counts for its cover | Two posts gain their drawing, in the format the site serves: "Little Zig Libraries for Fruit-Shaped Escape Hatches" and "Smol DarwinNicUtil Has Docs and installers now, yay" |
| A moving picture stays out | One GIF of 1.2 megabytes, in the newest post. It would play on this page with no way to stop it |
| A picture another site holds stays out | Three pictures. This page asks no other site for anything |
| A picture file that more than one post shows stays out of all of them | One file, `unnamed.jpg`. See below |
| Five pictures of a post at most | The rest are in the post. A set of photographs still says how many it holds |

The file `unnamed.jpg` is a photograph of 3D printers. Three posts show it:
"Purple Prius Parts" of August 2020, "This, That, etc" of July 2020 and "Wolf
Pine @ Fox Park #11" of April 2017. The old export gave three uploads one name,
and one file is left. It cannot be the picture of a walk in the snow in 2017.
The builder cannot tell whose it is, so it shows it with none of them, as it
does a shared cover. Before this round it showed twice.

What the stream has to show now:

| | Before this round | Now |
|---|---|---|
| Items that show a picture of their own | 25 | 26 |
| Items that show a video and no picture | 3 | 3 |
| Items that are words alone | 116 | 115 |
| Pictures in all | 49 | 71 |

Three posts gained a picture and two lost the shared one. Seven posts show more
of their own pictures than before: 22 more in all.

So 115 of 144 items stay words. The pictures are not there to show: 37 of the
113 posts that are words alone carry a note from the export that a picture or
a file of theirs was lost, such as "Some images from the original WordPress
post are no longer available." The others never had one. The builder reads the
posts' text, so a picture that comes back into a post shows in the stream with
no change here.

Not read, and why:

- Videos that a post embeds from YouTube: 13 in 5 posts. No poster for them is
  in this repository, and the page fetches none.
- The 13 gallery photographs that no public post uses, as before.

### The forms on a wide screen

Two lines run down the stream, as in round five. Every title set as words
starts on the first. From 1100 pixels wide:

| Form | What takes it | Where it stands | Today |
|---|---|---|---|
| Plate | One of her photographs: a picture the photo gallery holds, 900 pixels wide or more, at least 1.2 times as wide as it is tall | From the first line toward the right edge of the screen, with its title on it | 9 |
| Beside | A tall or square picture, a smaller one, a drawing, a screenshot, a picture from elsewhere, a video's poster | From the second line to the right edge of the screen, beside its words | 19 |
| Small | Pictures under 600 pixels wide | One row of them on the second line, none larger than its file | 1 |
| Words | Nothing to see | The title on the first line, the excerpt on the second | 115 |

The photo gallery's own rule tells a photograph from a screenshot or a
drawing, so the stream asks the gallery and does not guess. No title is laid on
a screenshot, a drawing or a picture she did not take.

A plate:

- It is as wide as the room from the first line to the right edge, as its file
  and as 80 percent of the screen's height allow. At 1440 by 900 pixels a
  photograph of three to two is 1,080 pixels wide. Round five drew it 654 wide.
- Its title is set a step larger than a title set as words, at its lower left.
- Behind the title lies the page's ground at 94 percent, exactly as far as the
  title reaches. From there it falls off into the photograph, up and across,
  over 5.5 to 9.5 rems. A halo of the ground lies under every letter as well.
- The lead is the first picture at least 600 pixels wide, so a small first
  picture does not decide the form.
- Under it stand the row of its other pictures, the count of a set, and her
  excerpt.

The row under a lead: every other picture at one height, each as wide as its
shape asks. The row is as wide as the lead when its files allow, and never
taller than 17 rems or the shortest file in it.

A title set as words went from 1.7 to 2.5 rems to 1.55 to 2.2 rems. The room
between two items of words went from 3.75 to 3 rems, and before a new month
from 7.5 to 4.5 rems. The rail for the month went from 9.5 to 10.25 rems: at
1100 pixels "SEPTEMBER 2020" touched the play control that hangs there.

Below 1100 pixels the stream is one column, as before, and it gains the new
pictures and the clean excerpts. A phone shows an excerpt whole. Before, it
cut every excerpt at two lines, in the middle of a sentence.

### The excerpts

An excerpt is her own text cut shorter, or it is absent. The builder writes no
word, joins no two sentences that stood apart and mends none. The code is
`src/lib/home/excerpt.ts`.

The posts have two kinds of summary:

- One she wrote. It stands whole when it is short, and is cut at a sentence
  end when it is over 240 characters.
- One the old export cut from the top of the post, by count of letters, with
  three dots. It runs headings, list items and link words together. The
  builder knows it because it stands at the top of the post letter for letter.
  It is not used. Her first whole sentences of prose are read from the post
  itself.

Reading a post, the builder passes over a heading, a list, a table, code, a
picture, a frame and a link that stands alone. Then:

| What goes | Example from her posts |
|---|---|
| Stray marks at the start of a sentence | "?:Organization for Flask + React..." and "…Despite being a chilly & wintery March..." |
| A sentence that only points at a link that is gone, or at the day of an edit | "Find this project on my github here!" and "Edit 07/26/2020: Check out the expanded GIS notes page here!" |
| The same before a colon | "Check out this project here: Tetrahedron.gay is..." keeps what follows the colon |
| A sentence that holds an address | "View the tools here: http://..." |
| The trace of a player | "Jess S. · Morning Metal 12.17.20" |
| A sentence that is cut off | Anything that does not end as a sentence ends |
| A note the export wrote where something was lost | "This image has been lost to time. The original was hosted on WordPress." It is not her text. The export set these in asterisks, in about twenty wordings |
| A quotation that runs over sentences or paragraphs | The post "Addendum to "Secret Beach Area"..." opens with a classmate's words. The excerpt is her answer to them |
| A label set whole in italics | "In other tangents..." |
| A line of code that stands as a paragraph | `REPO_PATH="./" OVMF_DIR="."` |
| The title, set again above the text | "Solar upgrades! Incredibly, the hut..." |

A row of dots is her pause and ends no sentence: "If you happened to be working
with.... KML data". An initial and a short form end none either: "Dr. Leonard
Reitsma", "Jess S. photography".

What is kept is one run of whole sentences that stand next to each other in
her text, up to 240 characters. A first sentence may run to 300. An excerpt
that tells a reader of the title nothing more is absent.

| The excerpts of the 140 posts | Posts |
|---|---|
| Her summary, whole | 22 |
| Her summary, cut at a sentence end | 3 |
| Her first sentences, read from the post | 101 |
| Absent | 14 |

A test reads the committed stream and holds four things for every excerpt. It
starts with a letter, a figure or an opening quote. It ends where a sentence
ends, or as her own summary ends. It holds no address, markup, export note or
trace of a player. It stands word for word in her summary or in her post.

### Depth by light and motion

- The feather under a plate's title, as on the stage.
- A plate's photograph is drawn 4.5 percent larger than its frame and travels
  1.9 percent of its height up and down as it crosses the screen. The browser
  reads the scroll for it with `animation-timeline: view()`, so no script
  runs. The frame is that much narrower than the file, so no pixel is
  stretched. A browser without scroll timelines shows the photograph still.
- With reduced motion, and on a device that missed the stage's frame budget,
  the photograph is still.
- The arrival out of a short blur is as it was.

### The small size

The site keeps each picture of a post at one size, 1200 pixels wide at most.
The stream draws many far smaller. `scripts/generate-home-pictures.mts` writes
each picture of the stream that is 880 pixels wide or more again at 720
pixels, under `static/images/home`: 57 pictures, 101 files,
3,719,931 bytes, committed like the site's other sizes. It uses `sharp`,
which the site already has. The build gate fails when one is missing, stale or
of no use.

Each picture names both sizes and how wide it is drawn, so the browser takes
the file the layout needs. 720 pixels is as wide as a picture beside its words
on a screen up to about 1550 pixels wide.

### The tooltip after a touch

At 390 pixels the Next tooltip stayed up after a tap and covered the end of
the scene's headline. A tooltip is for a mouse over a control and for a
control reached by keyboard. The page now keeps what the visitor last used: a
mouse, the keyboard or a finger. After a touch no tooltip shows. After a press
with a mouse, one shows only while the mouse is over its control.

### The passes

Each pass was a production build, shot whole through one headless Chromium and
read as sheets of screens.

| Pass | Shot | Seen | Changed |
|---|---|---|---|
| 1 | 1440 pine light, 1920 pine dark, 390 rose light | A meme, a screenshot and a product rendering were plates, with a title laid on them. The printer photograph stood as a plate under two posts. A row of small screenshots broke into three lines. On a phone every excerpt was cut at two lines, in the middle of a sentence. A plate's drift drew its photograph past its file | A plate is a photograph the gallery holds. A shared file shows with no post. Small pictures stand in one row. An excerpt shows whole. The frame is narrower than the file by the drift |
| 2 | 1440 pine light and catppuccin dark, 1920 rose light, 1100 catppuccin light, 768 pine light, 390 pine dark | At 1440 the first three screenfuls fetched whole files where the small size would do. At 1100 "SEPTEMBER 2020" touched a play control. An excerpt read "See a need, fill a need! \| An exciting new venture!", the cells of a table. Her opening sentence in italics was passed over | The small size is 720 pixels. The rail is wider. Table cells and a quotation over paragraphs are not shown. Her own sentence in italics is kept, a label in italics is not |
| 3 | The same, and 1920 pine dark | The forms hold at every width. Layout shift down the whole stream is 0. One new e2e test did not wait for a cold page | The test waits. The sizes a plate states match its frame |
| Final | All ten sets below | See "Measured" | Nothing |

The ten sets: 1440 by 900 in pine light and catppuccin dark, 1920 by 1080 in
rose light and pine dark, 1100 by 800 in catppuccin light and rose dark, 768
by 1024 in pine light and catppuccin dark, 390 by 844 in rose light and pine
dark. The screenshots are on the build host under
`/srv/fast-local/jess/previews/blog-home/shots-work/round5/`.

A stranger landing on the page meets a picture in every screenful for the
first eight screens at 1440 pixels wide, and again through 2018 and 2017,
where her bird photographs are. Two stretches are words alone: about three
screens of posts from 2019 and 2020, and the last five screens, the Fox Park
field notes of spring 2017. Those posts have no picture in this repository.

### Measured

Measured on November 26, 2026 on a production build of `69ab1235`, in one
headless Chromium, with no graphics card.

| What | Result |
|---|---|
| Image bytes in the first three screenfuls of the stream at 1440 by 900 | 5 pictures of the stream, 134,664 bytes, all in the small size. With the stage and the site's own files, 671,340 bytes over 17 files, of which 536,676 arrive before any scrolling |
| The same at 1920 by 1080 | 5 pictures, 270,511 bytes: at that width four of them are drawn wider than 720 pixels, so the whole files are right. 807,187 bytes in all |
| The same at 1440 by 900 at two device pixels | 5 pictures, 276,604 bytes, all whole files |
| The same on a phone of 390 by 844 at three device pixels | 5 pictures, 134,568 bytes. 586,480 bytes in all |
| The longest way down the stream with no picture | 5.4 screens at 1440 wide, 5.2 at 1920, 7.5 at 1100, 6 at 768 and 10 on a phone. It is the last stretch, the field notes of spring 2017 |
| The page's height with every part shown | 38,887 pixels at 1440 wide, 44,598 at 1920, 38,572 at 1100, 43,566 at 768 and 43,192 at 390 |
| Layout shift down the whole stream, in ten sets | 0 |
| Layout shift at load, flag on | 0.0620 at 1440 wide, 0.0321 at 1920, 0 at 390. It is the ordinary page's own, before the two change places: main measured 0.0621 to 0.0686 with the flag off in round six |
| Sideways scroll at 1440, 1920, 1100, 768 and 390 pixels wide | None |
| A picture drawn larger than its file, in ten sets | None |
| JavaScript on the home page, flag off | 21 scripts, 165,558 bytes gzip. Round six measured 165,552 |
| JavaScript on the home page, flag on | 25 scripts, 196,957 bytes gzip: 32,617 above main's 164,340 with the flag off. The limit is 40 kilobytes. This round cost 1,147 bytes |
| Requests on the home page | 44 with the flag off and 54 with it on, as before. None leaves the site |
| The stream's data file | 79,397 bytes, 20,864 gzip. It was 73,197 and 21,212: it names more pictures, and its excerpts are shorter |
| Lowest contrast of a plate's title over its photograph, with the letters and their halo taken off | 9.24 to 1, pine dark at 1920 wide, on "XRAM Injection". 270 titles: 9 plates in 5 themes, 2 modes and 3 widths |
| A tooltip after a tap on Next and on Pause, at 390 pixels with touch | Not shown |
| A tooltip with a mouse | Shown over the control, and gone once the mouse has left after a press. Shown again on a control reached by keyboard |
| A plate's drift at 1440 by 900 | The photograph is drawn 1,033 pixels wide in a frame of 989, from a file of 1,200. With reduced motion it is 989 wide and still |

The flag off: all 770 prerendered pages of this build were compared with the
build of the verified head `4974c948`. 768 are the same byte for byte once the
names the build gives its own files are set aside. The other two are the two
copies of `/pulse/lab`, which print the time of the build on main too. The home
page names 21 script and style files with the flag off. 15 are the same bytes
as before. The other 6 are the same but for the build's own stamp and the
names that follow from it.

One fault was found by that comparison and fixed. The site's stylesheet build
scans every source file for class names. It read a negated variable in the
excerpt code as a style class and added eight rules, 966 bytes, to the
stylesheet every page loads. The variables have other names now.

One thing was not explained. In the third pass one screenshot set, 1100 pixels
wide in rose dark, did not finish in 25 minutes and was stopped. The same set
ran in 45 seconds in the final pass, and the script that drives it had a fault
of its own in between. The page was not shown to be at fault, or cleared.

### Proof

Each step ran through the host's gates on November 26, 2026, one at a time, on
the tree of `69ab1235`.

| Step | Exit | Result |
|---|---|---|
| The stream's data file against its sources | 0 | Current, 144 items |
| The small pictures against the stream | 0 | 57 pictures, none missing, stale or of no use |
| Lint | 0 | Clean |
| Unit tests, `npx vitest run --config vitest.bazel.config.ts` | 0 | 47 files, 506 tests. Round six had 470 |
| svelte-check | 1 | 4 errors, all in `src/lib/flags/tailnet-hint.test.ts`, the 4 that main has. None added |
| Production build, `MERMAID_PRERENDER=optional npm run build` | 0 | The prebuild ran both generators and changed no file |
| e2e with one worker: this lane's spec and the two constellation specs | 0 | 83 passed in 5.9 minutes. Five are new |

An earlier e2e run on the third pass's build passed 82 of 83. The one that
failed was a new test of this round, which looked for a plate five seconds
after opening a fresh browser context on a busy host. It now waits for the
stream first.

The 36 new unit tests: 17 for the excerpt, 7 for the forms, and the rest for
the pictures a post shows, the shared file, and the excerpts and small sizes
of the committed stream. The new e2e tests: no picture larger than its file
and none twice, every excerpt, the drift with and without reduced motion, and
the tooltip after a touch and with a mouse. The test of the two lines on a
wide screen is rewritten for the plate.

The hosted gate was not waited for.

### The heron

Not changed. No larger original of the photograph was found in this
repository while working: the files named for it are the 1200 by 1000 pixel
`static/images/posts/img_8694.jpg` and its other formats, and the two cuts
under `src/lib/assets/home`.

### Decisions for her, round seven

1. A plate is one of her photographs, 900 pixels wide or more and wider than
   tall. Nine posts have one. A lower bar would add the three photographs of
   "Research Year Two" at 734 pixels wide, drawn small.
2. `unnamed.jpg` shows with none of its three posts. If she says which post it
   belongs to, the two other posts lose the line and it shows again.
3. A moving picture stays out of the stream. The newest post has one, and so
   has no picture here.
4. The 13 videos that five posts embed have no poster in this repository. One
   fetch at build time would get them. It is not done: nothing here fetches.
5. Fourteen posts show no excerpt, where no whole sentence of hers stands near
   the top. "This and That!" and "...In other news..." are two.
6. The small pictures add 3.7 megabytes to the repository and to each deploy.
7. Below 1100 pixels the stream is still one column. A plate there would lay a
   title over a photograph 336 pixels wide.

## Round eight: the six points she ruled on

Authority: rulings RM93 to RM98, Linear TIN-8594, the comment headed
"Thirteenth interview" (`e893a506`), and ruling RM99 (`e48aaddf`), both of
November 27, 2026 by the ticket's clock. Receipt under
R-HOOK-CONVERGENCE-20261004 (R-N13). The workflow that ran this round calls it
round six, and its screenshots are in a folder named `round6`. It is the
eighth section of this note.

Her words, verbatim. She opened with: "inetview on these in phases then exec".

| Id | The point, as put | Her answer |
|---|---|---|
| RM93 | Heron scene, a 1200 pixel file stretched to 1920 | "tue size, feathered, run anothe rpzm, neo exploration for full size version/" |
| RM94 | Excerpt of a word-only post on a wide screen | "Under its title (Recommended)" |
| RM95 | Long runs of word-only posts, pick any | "Tighter word rows (Recommended), Fold older years, Video posters" |
| RM96 | `unnamed.jpg`, shown by three posts | "Purple Prius Parts (Recommended)" |
| RM97 | The moving picture in the newest post | "Play it, with a pause" |
| RM98 | First paint at launch | "Stage from first paint (Recommended)" |
| RM99 | The posters for the 13 videos | "excited for golive.  we can use the 13 videos preemptively." |

RM99 was written to the ticket while this round ran.

The round ran in three parts. An account usage limit stopped the first at
about 04:25Z on November 27, 2026, with five commits pushed and the small
posters uncommitted. The second part committed them, made the third and
fourth passes and ran the proof, and stopped before this section was written.
The third part read every screenshot again, ran the whole proof once more on
the same tree and wrote this section. It changed nothing of the look. It
found and fixed one fault in the build with the stage on, under "First paint
at launch".

The search for a larger original of the heron on her other machines is not
part of this lane. Nothing outside this repository was read for it.

### The design in ten lines

1. The stage stays as wide as the window. The heron photograph stands in it at
   its own size, and all four of its edges fall off into the page.
2. The photograph is the whole file the banner was cut from, 1200 by 1000
   pixels. The type keeps its place, and the slow drift closes on the bird's
   head.
3. A post that is words alone is a tight row: a smaller title and a short
   excerpt under it, in the one left column.
4. The second line of the stream is for pictures only. Beside a row of words
   it stays empty.
5. A short excerpt is her first sentences, ended at a sentence end. Nothing
   cuts a line.
6. A year before 2020 is one line, the year and its count. It opens in place
   on a press, with no script.
7. A video a post gives a line of its own shows by its poster, in rows. A
   video a post only points at shows small, after the post's own pictures.
8. The printer photograph shows with "Purple Prius Parts" and with no other
   post.
9. The moving picture rests as its first frame, plays while it is on the
   screen, and has one control that pauses and plays it.
10. A visitor fetches nothing from another site until they press play. A
    build with the stage on is held ready by a test that runs by itself.

### The heron (RM93)

The code is in `HomeStage.svelte`, under `.plate.heron`, and the file is named
in one line of `src/lib/home/scenes.ts`.

**The rule.** One pixel of the file never covers more than one pixel of the
page. The frame is as wide as the stage or as the file allows, whichever is
less, and as tall as the stage or as the file allows. The slow drift draws the
photograph up to 7.5 percent larger than its frame, so the frame is that much
smaller than the file: 1,116 by 930 pixels at most.

| Window | Stage | Frame | Where | One file pixel covers |
|---|---|---|---|---|
| 2560 wide | 2560 by 980 | 1,116 by 930 | 924 pixels in, 25 from the stage's head | 0.96 of a page pixel |
| 1920 by 1080 | 1920 by 916 | 1,116 by 916 | 514 pixels in | 0.96 |
| 1440 by 900 | 1440 by 736 | 1,116 by 736 | 207 pixels in | 0.96 |
| 1280 by 720 | 1280 by 556 | 1,116 by 556 | 105 pixels in | 0.96 |
| 1100 by 800 | 1100 by 636 | 1,100 by 636 | Edge to edge | 0.94 |
| 768 by 1024 | 768 by 860 | 768 by 516, above the type | Edge to edge | 0.66 |
| 390 by 844 | 390 by 680 | 390 by 394, above the type | Edge to edge | 0.41 |

The last column is the photograph at the far end of its drift, its largest.

**The whole photograph.** Until this round the scene showed the banner's cut:
rows 214 to 604 of the file, with the bird's head on the top edge. A feather
on that edge would take the head. The scene now shows the file whole, so the
head stands a fifth of the way down and the feather at the top lies on leaves.
On a screen 1080 pixels high the frame holds the splash, the lilies and the
reflection. The old cuts `heron-1200.avif` and `heron-1200.webp` are removed.
The scene reads `/images/posts/img_8694.jpg` and the AVIF and WebP the site
already makes of it.

**A screen of two device pixels.** The cap is counted in the page's own
pixels, at every density. On a laptop of two device pixels the frame is still
1,116 page pixels wide, so one file pixel covers four device pixels. That is
as sharp as the same photograph at the same size on an ordinary screen, and
no sharper. The other choice was to count device pixels: 558 page pixels wide
on that laptop, a heading the size of a postcard in a stage of 1,440. The
stream's plates follow the same rule since round seven. On a phone of 390
pixels at three device pixels the frame is 1,170 device pixels wide, under
the file.

**The feathers.** Each is the mask of the photograph itself, so the page's
ground shows through in every theme and mode.

| Edge | Length | Why |
|---|---|---|
| Left | Up to 24 rems, and 2.2 times the bare stage beside the photograph | It lies under the type. The band of ground under the type holds as before, and the falloff beyond it is 11 to 20 rems |
| Head | 3 to 7 rems, 12 percent of the stage's height | The head starts below it |
| Foot | 6 to 14 rems, 24 percent of the stage's height | The long one: the water gives way to the page |
| Right | Up to 7 rems | The bill reaches to within 60 pixels of the file's right edge. A longer feather takes the tip of the bill |
| The two far corners | One wide ellipse about the height of the bill | The right edge is a curve that closes toward the foot, so the lower right corner of a rectangle does not show. The bill lies in its solid part |

The feathers at the sides are as long as the bare stage beside the photograph
allows. On a stage narrower than 1,116 pixels there is none: the photograph
runs from edge to edge of the window, under its file's size, and only its
head and foot fall off. The ellipse grows as the bare stage shrinks, and does
nothing there.

**The drift.** The photograph grows from 3 to 7.5 percent larger than its
frame over 46 seconds and back. Until the third pass it grew about its middle
and travelled 2.1 percent to the right, so at the far end the tip of the bill
stood on the frame's right edge, inside the feather. The drift now turns about
the tip of the bill and travels 0.2 percent sideways. The bill keeps its
place at every width, and the camera closes on the bird's head.

**Back to full bleed in one line.** `HERON.image` in `src/lib/home/scenes.ts`
names the file and its size. The stage reads the size from there. A file
2,400 pixels wide fills a stage of 1,920 from edge to edge, and the side
feathers close by themselves.

**A stage that is narrow and tall**, as a tablet held upright: from 721 to
1,000 pixels wide and at least 44 rems high, the photograph stands above and
the type under it, as on a phone. Beside each other, the type covered the
bird.

**Measured.** In five themes, two modes and five widths, 50 sets in all, with
the letters and their halo taken off. The lowest contrast of the type over
what lies under it is 10.46 to 1, at 1100 wide in pine dark. The pixel just
inside each edge of the frame differs from the page's ground by 8 of 255 at
most, at 390 wide in rose light, at the head. At 1440 wide the left edge differs
by 0 and the right by 3 at most.

One thing was read and left. From the frame's bare left edge inward, the
ground is one level of 255 off the ground beside it: 215, 218, 211 against
216, 219, 212 in pine light at 1440 wide, and 28, 33, 23 against 29, 34, 24 in
pine dark at 1920. By the numbers the photograph is under 2 percent there and
the blend rounds to the ground itself, so it is likely the software
renderer's rounding of a mask in eight bits. It shows in a screenshot with
its contrast stretched eight times and not at its own. It was not checked on
a machine with a graphics card.

### Tight rows of words (RM94, RM95)

| | Before | Now |
|---|---|---|
| Where the excerpt of a word-only post stands, from 1100 pixels wide | On the second line, beside its title | Under its title, in the left column |
| What the second line holds beside it | The excerpt | Nothing. It is for pictures |
| Title of a word-only post | 1.55 to 2.2 rems | 1.22 to 1.5 rems. 1.24 rems below 1100 pixels |
| Its excerpt | Up to 240 characters at 1.16 to 1.3 rems | Up to 140 characters at 1.06 to 1.16 rems |
| Room between two word rows | 3 rems | 1.75 rems. A new month takes 3.25 |
| A line clamp on an excerpt | 8 lines, as a floor | None |

The short excerpt is chosen where the stream is built, in
`src/lib/home/excerpt.ts`. It is the same run of her sentences as the longer
one, ended sooner. One first sentence may run to 215 characters, so a summary
she wrote as one sentence still stands. A longer first sentence is not cut:
that post shows no excerpt. A post with a picture or a video keeps the longer
excerpt beside it.

| The excerpts of the 140 posts | Round seven | Now |
|---|---|---|
| Her summary, whole | 22 | 21 |
| Her summary, cut at a sentence end | 3 | 4 |
| Her first sentences, read from the post | 101 | 95 |
| Absent | 14 | 20 |

Six posts lost their excerpt to the short length. Their first sentence runs
from 228 to 277 characters.

### The folded years (RM95)

A year before 2020 is a `details` element. Its line is its `summary`: a sign
in the accent that hangs in the rail, the year in the title's face, and the
count small beside it. The items of the year are inside it from the first
paint.

| Year | Items | Of which show a picture |
|---|---|---|
| 2019 | 11 | 1 |
| 2018 | 24 | 8 |
| 2017 | 39 | 5 |
| 2016 | 11 | 2 |

59 items stand open, from 2020 to 2026, and 17 of them show a picture or a
poster. 85 are in the four years.

- It opens on a press, and by keyboard with Enter or Space. The browser does
  this, so it works with no script.
- The line stays where it is and the items show under it. They come out of
  the same short blur once. With reduced motion they just show.
- Inside a year a month is named alone: "November", not "November 2018".
- A filter cuts first. A year counts and shows only what matches, and a year
  with nothing is absent. Under Recordings no year line shows. The address
  keeps the filter as before.
- The tooltip says Open or Close. A screen reader hears the year, the count
  and the word "items", and the browser says whether it is open.
- A picture inside a closed year is not fetched.

How long the stream is, from its first item to its end, in screens of the
window's height:

| Window | Round seven | Now, years closed | Now, every year open |
|---|---|---|---|
| 1440 by 900 | 42.2 | 18.5 | 41.6 |
| 1920 by 1080 | 40.3 | 18.0 | 39.1 |
| 1100 by 800 | 47.2 | 18.8 | 44.1 |
| 768 by 1024 | 41.5 | 18.3 | 37.0 |
| 390 by 844 | 50.2 | 20.0 | 42.2 |

The round seven column is that round's page height with every part shown,
less the height above the stream.

The fold is what halves the stream. With every year open it is as long as it
was on a wide screen, and a sixth shorter on a phone. Two things weigh against
each other there. A row of words is shorter on a phone, where its excerpt was
up to 240 characters under its title. On a wide screen round seven set the
excerpt beside the title, and RM94 sets it under, so by the totals a row is no
shorter. And
this round adds nine posters, the moving picture, the printer photograph and
four year lines.

A row of words takes, with the room under it: 123 pixels at 1440 wide, 129 at
1920, 134 at 1100, 126 at 768 and 153 at 390. The longest run of word rows
with the years closed is 6. It was 35.

The longest way down the open stream with no picture:

| Window | Round seven | Now, years closed | Now, every year open |
|---|---|---|---|
| 1440 by 900 | 5.4 screens | 1.14 | 2.17 |
| 1920 by 1080 | 5.2 | 0.96 | 1.98 |
| 1100 by 800 | 7.5 | 1.41 | 2.79 |
| 768 by 1024 | 6 | 1.11 | 1.93 |
| 390 by 844 | 10 | 1.70 | 3.16 |

### Video posters (RM95, RM99)

**What the posts hold.** The question put to her said five posts embed 13
YouTube videos and show no picture. Read closely, the posts differ from that
in three ways, so they are set down here.

- No post embeds a video. All 13 are links.
- Nine are a list in one post, "Merlin AI Demos!": each a line of its own,
  her own screen recordings. Four of those nine no longer have a poster at
  YouTube: the video is gone or private.
- The other four are each a link inside a sentence, in four posts, and by the
  posts' own words they are other people's videos. Two of those four posts
  already show pictures.

| Video | Post | The words the post links | Poster | In the stream |
|---|---|---|---|---|
| `dxnAx0CXUqU` | Merlin AI Demos! (2021-02-17) | handling multiple annotator clients- Vue UI, 2/17/21 | 1280 by 720 | A poster in the post's rows |
| `8aoNftMP4w8` | Merlin AI Demos! | handling multiple annotator clients- Leaflet UI, 2/7/21 | 480 by 360 | A poster in the post's rows |
| `E1WcZ2yOC10` | Merlin AI Demos! | Jest x Puppeteer, testing annotator UI | 1280 by 720 | A poster in the post's rows |
| `xdog2U2-c04` | Merlin AI Demos! | Bits from 1.21.21 | None at YouTube | Not shown |
| `uxrnf8oPsF8` | Merlin AI Demos! | preformance updates to core leaflet annotator, 1/17/21 | None at YouTube | Not shown |
| `5rsRts7-_Xs` | Merlin AI Demos! | mongodb, trust schema, drag & drop 12/7/20 | None at YouTube | Not shown |
| `TKKjo1ypSPY` | Merlin AI Demos! | web tools, bbox classify, ridiculous CLI 12/1/20 | 1280 by 720 | A poster in the post's rows |
| `rKzl5aQmJ-Y` | Merlin AI Demos! | audio & photo annotators 11/23/20 | None at YouTube | Not shown |
| `3btWzARKYKM` | Merlin AI Demos! | what this swiftui thing 10/26/20 | 640 by 480 | A poster in the post's rows |
| `UgnuMd7HaNw` | Week Notes: Indeterminism, Passkeys, and Spring (2026-03-21) | YoungArts Week performance | 1280 by 720. A young drummer at a kit | A small poster under the post's photographs |
| `Igg__Pmj-nk` | Week Notes: Cyborgs, Servers, and Sending (2026-03-04) | Firestarter mixtape | 1280 by 720. A record sleeve | A small poster under the post's photographs |
| `02kRossyKMw` | pt. 1: Reflecting On Stunt Culture (Theories and Frisbee) (2017-04-08) | some french dudes doing unicycle ballet | 1280 by 720. A unicyclist on a stage | A small poster, inside the folded year 2017 |
| `QmhMnQBMZ10` | Develop A Limitless & Habitual "SoIThen_SoICould_" Ethos (2016-12-21) | bigger flower pot | 480 by 360. A potter at a large pot | A small poster, inside the folded year 2016 |

The channel each video belongs to was not read. That needs a request to
youtube.com, and this round was allowed i.ytimg.com alone. The table gives
the post's own words and what each poster shows.

**The rule the builder follows.** It reads every YouTube link in a post's
text. A video shows only by a poster the repository holds.

- A video the post gives a line of its own, as the whole of a paragraph or of
  a list item, or as a frame, is the post's own. Its posters stand in rows of
  two or three, on the second line beside the post's words: five are two and
  three, and on a phone one, two and two. The post then also stands under the
  Video filter.
- A video the post only points at from inside a sentence stands small: one
  poster 18 rems wide at most, after the post's own pictures and its excerpt.
  It does not put the post under Video.
- Every poster is a play control. A press loads the YouTube no-cookie frame
  in the poster's own box, as the Music page's videos do. Its name and its
  tooltip are the words the post links.
- A video the Music page lists keeps its own item.

**To strike one.** Delete its files under `src/lib/assets/home/video`, then
run `just home-pictures` and `just home-stream`. The builder leaves out a
video with no poster.

**The fetch.** Done once, by hand, on November 26, 2026, from i.ytimg.com
only, one request at a time, a second apart. The largest size was asked for
first, then the next where it was missing: 13 requests for `maxresdefault`, 7
for `sddefault`, 6 for `hqdefault`, 26 in all. Nine videos have a poster and
four have none at any size. The JPEG files are committed as they came. Beside
each, `scripts/generate-home-pictures.mts` writes a WebP, and a WebP 640
pixels wide of a poster 1000 wide or more, for a row and a narrow screen. No
build step and no visit fetches one.

### The printer photograph (RM96)

`static/images/posts/unnamed.jpg` now shows with "Purple Prius Parts" alone.
The lines removed from the two other posts, and nothing else:

```
src/posts/2020-07-15-this-that-7-15.md
-![](/images/posts/unnamed.jpg)

src/posts/2017-04-02-wolf-pine-fox-park-10-4117-it-is-a-snow-show-debunking-the-melanistic-dogamount.md
-[![](/images/posts/unnamed.jpg)](/images/posts/unnamed.jpg)
-![unnamed](/images/posts/unnamed.jpg)
```

That is three lines, not two. The Wolf Pine post showed the photograph twice,
once above the words "Big Dog" and once above a caption for a cougar's paw.
With one of the two left in, the file would still be shared and the stream
would show it with no post. Both captions stay.

Both posts still name the file as `feature_image` in their front matter. That
line is not an image line of the text and was left. The stream's cover rule
does not show it. The card of each post on `/blog` still does.

### The moving picture (RM97)

The newest post shows `/images/posts/notdeadyet.gif`: 540 by 289 pixels, 24
frames, 2.4 seconds, 1,199,569 bytes.

- `scripts/generate-home-pictures.mts` writes two files of it under
  `static/images/home`: its first frame, 13,578 bytes, and the whole of it as
  an animated WebP, 236,940 bytes. Both are committed and checked by the
  build gate. The GIF itself is never asked for by the home page.
- The page shows the first frame, with its width and height set, so nothing
  moves. It is lazy, so it is asked for as it nears the screen.
- When two fifths of the picture are on the screen it plays. The moving file
  is asked for then, and shown once it is decoded. Off the screen it goes
  back to the first frame.
- One control lies on the picture at its lower left, 44 pixels or more each
  way, on a feather of the page's ground. Its name is "Pause" or "Play" and
  the picture's own words, and its tooltip says Pause or Play. It works by
  keyboard.
- A pause the visitor made holds. Scrolled away and back, it is still paused
  until they play it.
- With reduced motion it does not start by itself. It is the first frame
  with a play control, and the visitor may play it.
- With no script it is the first frame, which links to the post.

This meets WCAG 2.2.2: what moves by itself can be paused, at any time, by a
control that is always there while it moves.

| A visitor who scrolls past it | Fetches |
|---|---|
| At a reader's pace | 250,518 bytes: the first frame and the moving file |
| With reduced motion | 13,578 bytes: the first frame |
| Before this round | Nothing. The picture was not in the stream. The post itself serves the GIF, 1,199,569 bytes |

The stage does not take a moving picture as a scene: it holds photographs
still.

### First paint at launch (RM98)

The default build is as it was: the flag is off. A build made with
`BLOG_HOME_STAGE=on` was made and measured on one headless Chromium with no
graphics card. The local server answered once plain and once with brotli, as
production does.

| What | Result |
|---|---|
| The page as built | 181,715 bytes, 26,101 gzip. It holds the stage, 97 items of the stream and the 4 year lines. 12 items stand open before More, and 85 are inside the years. It holds no banner, no "Writing and notes.", no side column and no footer |
| With no script, at 1440 by 900 | The stage shows, and the 12 open items take 4,912 pixels, 5.5 screens |
| The old banner and the old sections, from before the first paint to the end | Never in the page, in every run. The page goes from empty to the stage and then the stream |
| First paint, 1440 by 900, three runs | 220 to 456 milliseconds |
| Largest paint, 1440 by 900 | 568 to 896 milliseconds |
| First and largest paint, 1920 by 1080 | 260 to 328 and 672 to 740 milliseconds |
| First and largest paint, 390 by 844 at three device pixels | 164 to 192 and 488 to 536 milliseconds |
| The same phone with the processor four times slower, 1.6 megabits a second and 150 milliseconds of delay, brotli | First paint 1,020 to 1,032 milliseconds, largest paint 1,476 to 1,512, alive after 3.3 to 3.4 seconds. Served plain, the first paint is at 6.1 seconds and the page is alive after 8.5 |
| What the largest paint is | In the stage in 21 runs of 24: one word of the sky's legend. In the three slowed runs served plain it is the site's name in the top bar, which paints first and is as large. Request 7 to the constellation lane stands |
| Layout shift | 0 in 20 runs of 24. 0.0001 once at 1440 wide, the top bar's links as a type file lands. 0.0016 in the three slowed runs with brotli, the sky's legend as the sky comes alive |

**One fault found and fixed.** In one slowed run of this part the page fell
to the site's error page: "404. This page doesn't exist." The host changed
network as the page opened, and Chromium dropped every request in flight
with `ERR_NETWORK_CHANGED`. One of them was the stream's data file. With the
stage on, that read is part of the page coming alive, and SvelteKit answers a
failed load by emptying the prerendered page and drawing the error page. A
second probe caught it again, once in three goes, with the failed requests
written down.

A phone that leaves a wireless network as the page opens does the same. The
read is now tried up to three times, 300 and then 1,200 milliseconds apart, in
`src/lib/home/retry.ts`. A new e2e test fails the first two requests for the
file on a stage-on build and expects the stage alive and the stream in place.
It failed on the build made before the fix and passes on the build made
after. With the flag off nothing asks for the file, so nothing changes there.

A script file that fails to arrive is another matter and is the same on every
page of the site today: the page stays as built and does not come alive.

**The test that holds it.** `e2e/home-stage-first-paint.spec.ts`, four tests.
It reads the page to learn which build it is on, so it is skipped on the
default build and runs by itself once the build setting is on. The first
test reads the page as built, with no script: the stage, the first screens of
the stream and the folded years. Two tests, at 1440 by 900 and at 390 by 844,
hold that no banner and no old section is in the page at any moment, that the
layout shift is under 0.02 and that the largest paint is in the stage. The
fourth fails the first two asks for the stream and expects the page to
stand.

### The passes

Each pass was a production build, shot whole through one headless Chromium and
read as sheets of screens.

| Pass | Seen | Changed |
|---|---|---|
| 1 | Her newest summary, one sentence of more than 180 characters, was absent from its row. The long names of the Merlin demos were cut off in their tooltips. "SEPTEMBER 2020" touched a play control | A first sentence may run to 215 characters. A poster's tooltip wraps inside the poster. The rail is 10.75 rems. The heron's head feather is a little longer and the feather beyond the type a little shorter |
| 2 | Four videos that a post only points at had no place. RM99 came in while the pass ran | A small poster after the post's own pictures |
| 3 | At the far end of its drift the photograph had slid 1.6 percent to the right, and the tip of the bill stood inside the right feather. The lower right corner of the photograph read as the corner of a rectangle | The drift turns about the tip of the bill. One wide ellipse rounds the two far corners |
| 4 | The first screenshot showed the heron as a bare rectangle: Chromium drops a radial gradient sized as a percentage plus a length, and the whole mask with it. An excerpt of a word row took a line more than it needed | The ellipse is sized in lengths alone. A word row takes the whole left column |
| 5 | Every screenshot of pass four read again, and a fresh set from a new build of the same tree: the stream's top is the same pixels. The dark heron's edges were read pixel by pixel. The slowed first paint fell to the error page once | The stream's read is tried three times. No change to the look |

The sets: 1440 by 900 in pine light and catppuccin dark, 1920 by 1080 in rose
light and pine dark, 1100 by 800 in catppuccin light and rose dark, 768 by
1024 in pine light and catppuccin dark, 390 by 844 in rose light and pine
dark. The heron also at 1440 in pride light and trans dark, at 1280 in rose
light and at 2560 in pine light. Each set holds the heron at both ends of its
drift, the stream's top, the moving picture playing and paused, the posters,
a run of word rows, the years closed and one open, the small posters and the
whole page. The screenshots are on the build host under
`/srv/fast-local/jess/previews/blog-home/shots-work/round6/final/`.

A stranger landing on the page meets the sky, then the heron whole, sharp and
with no edge. Under them a picture or a poster comes within a screen and a
quarter all the way to 2020, and four lines carry the 85 older items.

### Measured

Measured on November 27, 2026 on production builds of this tree, in one
headless Chromium with no graphics card.

| What | Result |
|---|---|
| Items that stand open, and inside the four years | 59 and 85. 17 of the 59 show a picture or a poster, and 2 more a player |
| Sideways scroll at 1440, 1920, 1100, 768 and 390 pixels wide | None |
| A picture drawn larger than its file, in ten sets | None |
| Layout shift down the open stream, and on opening a year and reading on, at four widths | 0 |
| Layout shift at load with `?flags=home` on the default build | 0.0685 at 1440 wide, 0.0321 at 1920, 0 at 768 and 390. It is the ordinary page's own, before the two change places. A stage-on build has none of it |
| The moving picture, a visitor who scrolls past | 250,518 bytes: the first frame, 13,578, and the moving file, 236,940. With reduced motion 13,578 |
| Image bytes of the stream in the first three screenfuls at 1440 by 900 | 6 files, 371,604 bytes, of which the moving file is 236,940. Round seven had 5 files and 134,664 bytes |
| The same at 1920 by 1080 | 6 files, 507,451 bytes |
| The same at 1440 by 900 at two device pixels | 6 files, 513,544 bytes |
| The same on a phone of 390 by 844 at three device pixels | 6 files, 371,508 bytes |
| Every file of the page in those three screenfuls | 1,008,198 bytes over 19 files at 1440 by 900, of which 636,594 arrive before any scrolling. 923,329 over 14 files on the phone |
| JavaScript on the home page, flag off | 21 scripts, 165,599 bytes gzip. Round seven measured 165,558 |
| JavaScript on the home page, flag on | 25 scripts, 199,629 bytes gzip: 35,289 above main's 164,340 with the flag off. The limit is 40 kilobytes. This round cost 2,672 bytes |
| Requests on the home page | 44 with the flag off, as before. 55 with it on, one more than before. None leaves the site |
| The stream's data file | 78,037 bytes, 19,415 gzip. It was 79,397 and 20,864 |
| Posters and other new pictures in the repository | 32 files, 1,553,198 bytes. The two old cuts of the heron, 110,615 bytes, are removed |

### Proof

Each step ran through the host's gates on November 27, 2026, one at a time, on
the tree of `d56f60c5`, the round's last code commit.

| Step | Exit | Result |
|---|---|---|
| The small pictures against the stream | 0 | Current |
| The stream's data file against its sources | 0 | Current, 144 items |
| Lint | 0 | Clean |
| Unit tests, `npx vitest run --config vitest.bazel.config.ts` | 0 | 49 files, 533 tests. Round seven had 47 and 506 |
| svelte-check | 1 | 4 errors, all in `src/lib/flags/tailnet-hint.test.ts`, the 4 that main has. None added |
| Production build, `MERMAID_PRERENDER=optional npm run build` | 0 | The prebuild ran both generators and changed no file |
| The same build with `BLOG_HOME_STAGE=on` | 0 | Kept beside the default build |
| e2e with one worker on the default build: this lane's two specs and the two constellation specs | 0 | 93 passed and 4 skipped in 4.5 minutes. The 4 are the stage-on spec, which this build does not answer to |
| e2e on the stage-on build: `e2e/home-stage-first-paint.spec.ts` | 0 | 4 passed in 10.5 seconds |
| The new test on the stage-on build made before the fix | 1 | Failed, as it should: the stage was gone |

The second part of the round ran the same steps on `c7637a60` with the same
results: 48 files and 529 unit tests, 93 e2e tests passed and 3 skipped, and 3
passed on the stage-on build. The third part ran them again on that tree
before the fix, with the same counts, and then on the fixed tree.

The 27 new unit tests of the round hold the short excerpt, the folded years,
a post's own videos and the ones it points at, the moving picture, the shared
file and the retry. The e2e count is 97 where round seven had 83. This lane
added 13: the heron at its own size, the tight rows, the years by press and
by keyboard, the years under a filter, the rows of posters, the small poster,
the printer photograph, the moving picture with and without reduced motion,
and the four of the stage-on build. One came with main.

The hosted gate was not waited for.

### Earlier claims this round changes

- Round seven's "The heron": not changed then. It is now the whole
  photograph at its own size, and the two cuts under `src/lib/assets/home`
  are gone.
- Round seven's decisions 2, 3 and 4 are answered by RM96, RM97, RM95 and
  RM99 and done.
- Round seven, "An excerpt shows whole": a word row now shows the short
  excerpt. No line is cut.
- Round five, "The wide screen": the excerpt of a word-only post stood on the
  second line. It stands under its title, and the second line is for
  pictures.
- Round two said a preview built with the stage on "paints the new page
  first". It is now measured, and held by a test.

### Not changed, and why

- The stage's scenes, the one row of controls, the plates and the pictures
  beside their words. She has seen them, and the round's brief kept them.
- The default build. The flag is off, and `BLOG_HOME_STAGE` is not set
  anywhere in the repository.
- The sky's own files. Nothing in them was touched this round.
- `feature_image` in the two posts that lost the printer photograph. It is
  front matter and not an image line of the text.
- The four Merlin demo videos with no poster at YouTube. They show nowhere.
- The channel of each video. It was not read.
- The one level of 255 at the dark heron's bare edge. See "The heron".
- A row of words on a wide screen is no shorter than in round seven. Shorter
  means a row with no excerpt.
- The search for a larger original of the heron. It is not this lane's.

### Decisions for her, round eight

1. Four of the nine Merlin demos have no poster at YouTube at any size: the
   video is gone or private. They show nowhere in the stream. The post still
   links them.
2. The four small posters are other people's videos, by the posts' own
   words. RM99 lets them show. The table above says how to strike one.
3. The channel of each video needs one request for each to youtube.com. Say
   so and the table gains the column.
4. The printer photograph is still the `/blog` card of "This, That, etc" and
   "Wolf Pine @ Fox Park #11", through `feature_image`.
5. "Ligature Test Fixture", December 2024, is a test post with `published:
   true`. It stands in the stream between her posts, as it does on `/blog`.
6. With the years open, a wide screen's stream is as long as in round seven.
   A word row with a title and no excerpt would take about half the height.
7. On a build with the stage on, the stream's data file is a second request
   the page needs before it comes alive. It is now tried three times. The
   other way is to write the stream into the page itself, about 19 kilobytes
   more gzip in the HTML and one request fewer.
8. The site's error page says "404. This page doesn't exist." for every
   failure, a failed load among them.
9. The posters and the moving picture add 1.55 megabytes to the repository.
10. Whether the dark heron's edge shows on a real screen was not checked on a
    machine with a graphics card.

## Requests for the constellation lane

The constellation is on main since `759c1e80`, and round six did requests 2,
3, 5, 9 and 11 below in the sky's own files. The others stand.


The stage reached into the component with two style rules, in one block in
`HomeStage.svelte`. One is left, for request 1:

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
9. On a wide screen, place the sky's own controls at its head, as on a phone,
   or offer a prop for it. At its foot they sit straight above the stage's
   Pause and Next.
10. With the flag off, the constellation branch asks for one more script than
    main on every route: an empty 22 byte file, named by the error page's code
    and by the two constellation files. In a build of the constellation
    branch at `fafbe6c` it is `chunks/DTKcyXcV.js`. The name changes with each
    build.
11. For one row of controls in the sky scene (RM66). Today the sky draws its
    legend and its five controls in a row at its foot, and the stage draws the
    stream's filters, the progress line, Pause and Next in a second row under
    it. The stage needs three props:
    - `legend: 'foot' | 'head' | 'none'`, default `'foot'`. `'head'` draws the
      legend along the top edge of the sky at the same inset.
    - `controls: 'own' | 'none'`, default `'own'`. With `'none'` the sky draws
      no control of its own and gives its actions to the stage: the exported
      functions `toggleList()`, `zoomIn()`, `zoomOut()`, `resetView()` and
      `toggleHelp()`, and a callback
      `onviewstate(state: { canZoomIn: boolean; canZoomOut: boolean; canReset: boolean; listOpen: boolean; helpOpen: boolean })`
      called whenever one of the five changes. The names and tooltips of the
      five as exported constants, so both rows say the same words.
    - `inset: string`, the length that request 2 asks for, in place of the
      stage's override of `--edge`.
    The stage then draws one row: the filters at one end, and at the other the
    sky's five while the sky is on show, the progress line, Pause and Next.
    Zoom out and Reset show only while they can act, as request 5 asks.
12. On a build with the stage on, on a phone with the processor four times
    slower, the sky's legend moves as the sky comes alive, about 3.3 seconds
    in. The score is 0.0016, in three runs of three with brotli. The nodes
    are the legend and two of its words.
