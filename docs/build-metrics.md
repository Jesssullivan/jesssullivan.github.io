# Build Metrics Baseline

- **Status:** STALE — superseded 2026-08-28. Vite 8 shipped and the toolchain
  below no longer exists in this repo. The numbers are kept as the Vite 6.4.1
  comparison point, not as a description of the current build.
- **Captured:** 2026-02-11 on branch `feature/sprint3-week8` (commit `9aac474`)
- **Checked by:** `scripts/truth-surfaces.mjs`. The toolchain table below is
  machine-compared against `package.json`. If the versions match again this
  page must drop the STALE marker; while they differ it must carry it. A
  metrics page cannot silently keep presenting itself as current (TIN-161).

## Toolchain At Capture

Declared ranges read from `9aac474:package.json`, the commit that added this
file — not the resolved versions, so the comparison is like-for-like against
`package.json` today.

| Package | Declared at capture |
| --- | --- |
| `vite` | ^6.4.1 |
| `svelte` | ^5.19.0 |
| `@sveltejs/kit` | ^2.16.0 |

## Build Time

| Metric | Value |
|--------|-------|
| Full build (`vite build` + pagefind) | **9.7s** |
| Unit tests (73 tests, 4 files) | **0.7s** |
| E2E tests (100 tests, Chromium) | **19.1s** |
| `svelte-check` | ~5s |

## Bundle Sizes

| Category | Size |
|----------|------|
| Total build output | **71 MB** (294 static pages + assets) |
| `_app/` JS total | **7.6 MB** (pre-compression, code-split) |
| Entry JS (`app.js`) | **6.2 KB** (2.3 KB brotli) |
| `_app/immutable/chunks/` | 5.9 MB |
| `_app/immutable/nodes/` | 276 KB |
| `_app/immutable/entry/` | 28 KB |
| Total files | 1,409 |

## Largest Chunks (lazy-loaded)

| Chunk | Size | Contents |
|-------|------|----------|
| `BDqp7cfw.js` | 748 KB | mermaid |
| `iPv1065A.js` | 488 KB | shiki syntax highlighter |
| `BQaXIfA_.js` | 436 KB | shiki themes/languages |
| `Du3a5-Wc.js` | 368 KB | shiki WASM |
| `CBSAILhF.js` | 260 KB | pagefind UI |

All heavy chunks are lazy-loaded — they don't affect first-load performance.

## Dependencies

| Metric | Count |
|--------|-------|
| npm audit vulnerabilities | 10 (3 low, 7 moderate) |
| All in transitive deps | mermaid → chevrotain → lodash-es, @sveltejs/kit → cookie |
| Outdated (major) | vite (6→7), skeleton-svelte (1→4) |
| Outdated (minor) | sharp (0.33→0.34) |

## Vite 8 / Rolldown Status

**NOGO at capture** — Vite 8.0.0-beta.13 (Feb 2026). Dead code elimination
broken for `esm-env` conditions. No stable SvelteKit support. See
[issue #16](https://github.com/Jesssullivan/jesssullivan.github.io/issues/16).
**Overtaken by events:** `package.json` declares `vite ^8.0.14` as of
2026-08-28, so this row records what was true in February and not a current
posture.

## Recapture

There is no measured replacement for this page yet. Producing one needs a real
build, which is the rest of TIN-161; until then the STALE marker and the
machine check are what keep the page honest. When it is recaptured, update the
toolchain table in the same commit as the numbers — the check pairs them
deliberately, so metrics cannot land without the toolchain that produced them.
