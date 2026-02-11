# Changelog

All notable changes to [jesssullivan.github.io](https://github.com/Jesssullivan/jesssullivan.github.io) are documented in this file.

## Sprint v3 — Production Hardening & Polish

### Week 10 — [#28](https://github.com/Jesssullivan/jesssullivan.github.io/pull/28)

#### Features

- Content Security Policy meta tag (frame-src for SoundCloud, YouTube, Giscus)
- Referrer policy header (strict-origin-when-cross-origin)

#### Tests

- Visual QA test suite across 4 breakpoints (320, 768, 1024, 1440px)
- Expand E2E suite to 168 Playwright tests

#### Docs

- CHANGELOG covering all 3 sprints (PRs #1–#28)

### Week 9 — [#27](https://github.com/Jesssullivan/jesssullivan.github.io/pull/27)

#### Features

- Add reading progress indicator
- Add related posts component
- Full-content RSS feed

#### Tests

- Expand E2E suite to 122 Playwright tests

### Week 8 — [#26](https://github.com/Jesssullivan/jesssullivan.github.io/pull/26)

#### Performance

- Dead code removal pass
- Add build metrics reporting

#### Fixes

- Dependency audit and cleanup

### Week 7 — [#25](https://github.com/Jesssullivan/jesssullivan.github.io/pull/25)

#### Performance

- Image optimization pipeline
- Lighthouse CI integration

#### Fixes

- Accessibility remediation pass

### Week 6 — [#24](https://github.com/Jesssullivan/jesssullivan.github.io/pull/24)

#### Features

- JSON-LD structured data for blog posts
- Open Graph image generation
- Enhanced sitemap

#### Fixes

- Content accuracy corrections

### Week 5 — [#23](https://github.com/Jesssullivan/jesssullivan.github.io/pull/23)

#### Features

- TypeScript strict mode audit and fixes
- ESLint + Prettier configuration
- Svelte 5 runes optimization

#### Tests

- Add Vitest unit test suite

### Week 4 — [#22](https://github.com/Jesssullivan/jesssullivan.github.io/pull/22)

#### Features

- Animated blob background effect
- 3-way theme switcher (light / dark / system)
- Featured posts section on homepage

### Week 3 — [#21](https://github.com/Jesssullivan/jesssullivan.github.io/pull/21)

#### Features

- New `/music` page with audio/video embeds

### Week 2 — [#20](https://github.com/Jesssullivan/jesssullivan.github.io/pull/20)

#### Features

- Profile sidebar component
- Tag cloud navigation
- Blog layout integration with sidebar

### Week 1 — [#19](https://github.com/Jesssullivan/jesssullivan.github.io/pull/19)

#### Fixes

- Banner display fix
- Remove hallucinated content from generated pages

#### Features

- Add Fira Sans + Fira Code font family

---

## Sprint v2 — Hemingway Theme & CI (PRs [#12](https://github.com/Jesssullivan/jesssullivan.github.io/pull/12)–[#18](https://github.com/Jesssullivan/jesssullivan.github.io/pull/18))

#### Features

- Hemingway WP theme replication with parallax hero and sidebar ([#14](https://github.com/Jesssullivan/jesssullivan.github.io/pull/14))
- Pagefind search integration ([#15](https://github.com/Jesssullivan/jesssullivan.github.io/pull/15))
- FOSS section with categorized projects and client badges ([#17](https://github.com/Jesssullivan/jesssullivan.github.io/pull/17))
- Responsive images with WebP via rehype plugin ([#12](https://github.com/Jesssullivan/jesssullivan.github.io/pull/12))
- Tinyland schema alignment with categories ([#14](https://github.com/Jesssullivan/jesssullivan.github.io/pull/14))

#### Performance

- Lighthouse optimization pass ([#15](https://github.com/Jesssullivan/jesssullivan.github.io/pull/15))
- Build-time reading time computation ([#14](https://github.com/Jesssullivan/jesssullivan.github.io/pull/14))

#### Tests

- Vitest unit tests for posts and types ([#13](https://github.com/Jesssullivan/jesssullivan.github.io/pull/13))
- E2E tests for parallax hero, sidebar, reading time, pagination ([#15](https://github.com/Jesssullivan/jesssullivan.github.io/pull/15))
- CI pipeline with type check, build, link audit, and E2E ([#15](https://github.com/Jesssullivan/jesssullivan.github.io/pull/15))

#### Fixes

- Repair 9 broken links across 8 posts ([#14](https://github.com/Jesssullivan/jesssullivan.github.io/pull/14))
- Rewrite about page from profile README source of truth ([#13](https://github.com/Jesssullivan/jesssullivan.github.io/pull/13))
- Resolve Svelte warnings, remove legacy artifacts ([#18](https://github.com/Jesssullivan/jesssullivan.github.io/pull/18))

#### Docs

- Repository README with architecture and authoring guide ([#17](https://github.com/Jesssullivan/jesssullivan.github.io/pull/17))

---

## Sprint v1 — Initial Build (PRs [#1](https://github.com/Jesssullivan/jesssullivan.github.io/pull/1)–[#11](https://github.com/Jesssullivan/jesssullivan.github.io/pull/11))

#### Features

- SvelteKit 5 + Skeleton UI Pine theme scaffold
- Migrate 148 WordPress blog posts via mdsvex pipeline ([#1](https://github.com/Jesssullivan/jesssullivan.github.io/pull/1))
- AppBar, pagination, and typography polish ([#2](https://github.com/Jesssullivan/jesssullivan.github.io/pull/2))
- Giscus comments integration ([#3](https://github.com/Jesssullivan/jesssullivan.github.io/pull/3))
- CV page with PDF embed and TeX sources ([#4](https://github.com/Jesssullivan/jesssullivan.github.io/pull/4))
- Search, Mermaid diagrams, dark mode, LaTeX CI ([#5](https://github.com/Jesssullivan/jesssullivan.github.io/pull/5))
- SEO meta tags, sitemap, robots.txt, precompression ([#6](https://github.com/Jesssullivan/jesssullivan.github.io/pull/6))
- Reading time, code copy, heading anchors, prev/next nav ([#7](https://github.com/Jesssullivan/jesssullivan.github.io/pull/7))
- Photography, music, hospitality content sections ([#9](https://github.com/Jesssullivan/jesssullivan.github.io/pull/9))
- WP redirects, enhanced-img, CC0 license ([#11](https://github.com/Jesssullivan/jesssullivan.github.io/pull/11))
- Localize WordPress images with EXIF scrub and optimization
- Playwright E2E test suite

#### Fixes

- Slug collision resolution ([#8](https://github.com/Jesssullivan/jesssullivan.github.io/pull/8))
- Tailwind v4 + Skeleton 4.12 dark mode toggle ([#10](https://github.com/Jesssullivan/jesssullivan.github.io/pull/10))
- Alt text remediation and WP image URL rewrites
- Content accuracy and feed completeness
