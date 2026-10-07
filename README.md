# Acceptance evidence: reader similarity map (TIN-5680)

This branch holds evidence only. It shares no history with `main`, it is never
merged, and no workflow runs on it.

- `pr-295/`: the RS9 acceptance pack for PR #295. It was captured on
  2026-10-07 from a local static build of `feat/tin-5680-posts-tsne-20261006`
  at `fe89416`, served by `vite preview` on loopback and driven by headless
  Google Chrome 154 (new headless) through Playwright.
  - `capture.mjs` takes the screenshots and writes `report.json`.
  - `perf-baseline.mjs` compares frame rate on `/` against
    `/?flags=constellation` and writes `perf-baseline.json`.
- File names give the viewport (`desktop` is 1440x900; `phone` is 390x844 at
  2x with touch) and the step:
  - `01`: default view, flag off
  - `02`: flag on, initial view
  - `03`: similarity map
  - `04`: densest cluster, cropped
  - `05`: hovered post
  - `06`: keyboard focus
  - `07`: similar-posts list
- The local build used `MERMAID_PRERENDER=optional`, because this host has no
  Puppeteer Chrome for three uncached diagrams. That affects three post pages,
  not the home page.

Authority: operator ruling RS9 (Linear TIN-3692 comment bdf1028b).
