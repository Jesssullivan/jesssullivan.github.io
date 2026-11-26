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
