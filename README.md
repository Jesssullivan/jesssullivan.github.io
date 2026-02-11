# transscendsurvival.org

Personal blog and portfolio by Jess Sullivan. Built with SvelteKit 2, pre-rendered with adapter-static, and deployed to GitHub Pages.

## Tech Stack

- **SvelteKit 2** with **Svelte 5** (runes) -- static adapter for fully pre-rendered output
- **Tailwind CSS v4** with **Skeleton UI v4.12** (Pine theme)
- **mdsvex** -- Markdown/Svelte hybrid for blog posts
- **Shiki** -- syntax highlighting (github-dark theme, 18 languages)
- **Mermaid** -- diagrams rendered client-side from fenced code blocks
- **Pagefind** -- static search index generated at build time
- **Playwright** and **Vitest** -- E2E and unit testing
- **@sveltejs/enhanced-img** -- responsive image optimization with Sharp

## Quick Start

Prerequisites: Node.js 22+ and npm.

```sh
npm install
npm run dev
```

Or using the [Justfile](https://just.systems/):

```sh
just setup   # npm install
just dev     # start dev server
```

## Project Structure

```
src/
  routes/
    +layout.svelte          # app shell: nav, sidebar, footer
    +page.svelte            # homepage
    blog/
      +page.svelte          # paginated post listing
      [slug]/+page.svelte   # individual post
      tag/[tag]/             # posts filtered by tag
    about/                  # about page
    cv/                     # CV / resume
    feed.xml/               # RSS feed
    feed.json/              # JSON feed
    sitemap.xml/            # sitemap
  lib/
    components/             # Search, TableOfContents, BlogSidebar, etc.
    posts.ts                # post loading and metadata helpers
    types.ts                # shared TypeScript types
  posts/                    # ~149 Markdown blog posts
scripts/
  generate-redirects.mjs    # WordPress-era URL redirect generation
  validate-frontmatter.mjs  # frontmatter schema validation
  validate-redirects.mjs    # post-build redirect checks
  audit-links.mjs           # link auditing
e2e/                        # Playwright E2E specs (7 spec files)
static/                     # images, favicons, CNAME
```

## Blog Posts

Posts live in `src/posts/` as Markdown files. Each file needs YAML frontmatter at the top:

```yaml
---
title: "Post Title"
date: "2026-01-15"
description: "A short summary for SEO and previews."
tags: ["sveltekit", "meta"]
published: true
slug: "post-title"
---
```

Key fields:

- **published** -- set to `false` to hide from listings and feeds
- **slug** -- determines the URL at `/blog/{slug}`
- **tags** -- used for tag filter pages at `/blog/tag/{tag}`
- **original_url** -- (optional) WordPress-era URL, used for redirect generation

Images for posts go in `static/images/posts/` and are referenced as `/images/posts/filename.jpg`. WebP variants are automatically served via `<picture>` elements when available.

Mermaid diagrams are written as fenced code blocks with the `mermaid` language tag and rendered client-side.

## Development Commands

All commands are available through the Justfile (`just --list`):

| Command | Description |
|---|---|
| `just setup` | Install dependencies |
| `just dev` | Start dev server |
| `just build` | Production build (redirects + Pagefind index) |
| `just preview` | Build then preview |
| `just check` | Type-check with svelte-check |
| `just test-unit` | Run Vitest unit tests |
| `just test-e2e` | Run Playwright E2E tests |
| `just test` | Run all tests (unit + redirects + E2E) |
| `just ci` | Full CI pipeline locally |
| `just validate-frontmatter` | Validate post frontmatter |
| `just clean` | Remove build artifacts |
| `just analyze` | Build with bundle size visualization |

## Testing

- **Unit tests** -- 56 tests via Vitest covering post loading, type validation, and utilities (`just test-unit`)
- **E2E tests** -- 57 tests across 7 Playwright spec files covering navigation, blog functionality, feeds, SEO, dark mode, redirects, and layout (`just test-e2e`)
- **Type checking** -- `svelte-check` with strict TypeScript (`just check`)
- **Frontmatter validation** -- ensures all posts have required fields (`just validate-frontmatter`)
- **Redirect validation** -- confirms WordPress-era redirects resolve after build (`just test-redirects`)

## Deployment

The site uses `@sveltejs/adapter-static` to pre-render all pages into `build/`. Output is pre-compressed (gzip + brotli).

Two GitHub Actions workflows handle CI/CD:

- **CI** (`.github/workflows/ci.yml`) -- runs on push to `main`/`dev` and on PRs to `main`. Runs type checking, unit tests, build, frontmatter/redirect/link validation, and E2E tests.
- **Deploy** (`.github/workflows/deploy-pages.yml`) -- runs on push to `main`. Builds the site and deploys to GitHub Pages.

## License

[CC0 1.0 Universal](LICENSE) -- public domain.
