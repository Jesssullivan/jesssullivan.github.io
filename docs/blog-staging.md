# Cross-Repo Blog Staging Pipeline

Blog posts can live in any repo. A collection pipeline pulls them into
`jesssullivan.github.io`, normalizes frontmatter, rewrites links and images,
and stages them as draft PRs for review before publication.

```
Source repo push        repository_dispatch        Collector script
  (blog/**)       --->  collect-posts.yml    --->  collect-external-posts.mjs
                                                         |
                                                    Draft PR (published: false)
                                                         |
                          validate-blog-dates.yml   <--- PR to main
                                                         |
                    auto-merge-scheduled.yml  --->  Merge on scheduled date
```

**Five stages:**

1. **Notify** -- Source repo pushes to `main`, triggers `repository_dispatch` on the blog repo.
2. **Collect** -- `collect-external-posts.mjs` fetches posts and images, normalizes frontmatter, writes files.
3. **Stage** -- A draft PR is opened on `auto/collect-posts` with `published: false`.
4. **Validate** -- `validate-blog-dates.mjs` checks future-dated posts on every PR to `main`.
5. **Auto-merge** -- `auto-merge-scheduled.yml` merges PRs whose `DO NOT MERGE until` date has passed.


## Writing a Blog Post

Put a markdown file in one of the scanned directories (`blog/`, `posts/`, or
`docs/blog/`) in any configured source repo.

### Frontmatter template

```yaml
---
title: "Your Post Title"
date: "2026-03-15"
description: "One-sentence summary."
tags: [networking, tailscale]
published: true
category: "software"
feature_image: "images/diagram.png"
publish_to: "blog"
---
```

`publish_to: "blog"` is the marker that tells the collector this file is
intended for the blog. If a file is already inside a scanned directory, the
marker is optional.

### Image conventions

Place images in an `images/` subdirectory alongside your posts:

```
blog/
  part-1-intro.md
  images/
    diagram.png
    screenshot.jpg
```

The collector copies images to `static/images/posts/` and rewrites all
relative references (`images/foo.png`, `./images/foo.png`,
`blog/images/foo.png`) to `/images/posts/foo.png`. If no `feature_image` is
set in frontmatter, the first collected image is assigned automatically.

### Inter-post links

Link to other posts using their markdown filename:

```markdown
See [part 1](part-1-intro.md) for background.
```

The collector resolves these to `/blog/<slug>` based on the target file's
frontmatter title/slug.


## Adding a Source Repo

Checklist:

1. **Register the repo** in `.github/blog-sources.json`:

   ```json
   {
     "repos": ["Jesssullivan/aperture-bootstrap", "Jesssullivan/your-repo"],
     "scan_paths": ["blog/", "posts/", "docs/blog/"],
     "frontmatter_marker": "publish_to",
     "frontmatter_value": "blog"
   }
   ```

2. **Propagate the dispatch secret** so the source repo can trigger collection:

   ```bash
   echo "ghp_your_pat" | ./scripts/propagate-dispatch-secret.sh
   ```

   This sets `BLOG_DISPATCH_TOKEN` as a GitHub Actions secret on all your
   public repos. The token needs `contents:write` on `jesssullivan.github.io`.

3. **Add the notify workflow** to the source repo. Copy
   `.github/workflows/notify-blog-template.yml` to the source repo as
   `.github/workflows/notify-blog.yml`. It fires on pushes to `main` that
   touch `blog/**`, `posts/**`, or `docs/blog/**`.

4. **Test** by pushing a post to the source repo and confirming a draft PR
   appears on `jesssullivan.github.io`.

Optional: set the repo variable `BLOG_DISPATCH_ENABLED=false` to temporarily
disable notifications without removing the workflow.


## How Collection Works

`scripts/collect-external-posts.mjs` runs inside the `collect-posts.yml`
workflow. It can be triggered three ways:

- **repository_dispatch** -- a source repo pushed new content (collects only that repo).
- **schedule** -- weekly Monday 09:00 UTC (collects all repos in `blog-sources.json`).
- **workflow_dispatch** -- manual run, optionally scoped to specific repos.

For each repo, the script:

1. Lists files in each `scan_path` via `gh api`.
2. Fetches `.md`/`.mdx` files, parses frontmatter.
3. Skips files without a title, files with `publish_to` set to something other
   than `"blog"`, and files whose slug already exists locally.
4. Fetches images from `images/` subdirectories alongside posts.
5. Normalizes frontmatter to the `PostFrontmatter` schema (see below),
   setting `published: false` and adding `source_repo`/`source_path` provenance.
6. Strips duplicate H1 headings, rewrites image paths, resolves inter-post
   `.md` links to `/blog/<slug>`, and substitutes unsupported code block
   languages (e.g. `dhall` -> `haskell`).
7. Writes posts to `src/posts/YYYY-MM-DD-slug.md`.
8. Updates the manifest at `.github/external-posts.json` for dedup tracking.

The `peter-evans/create-pull-request` action then opens (or updates) a draft
PR on the `auto/collect-posts` branch.


## Scheduling Posts

To publish a post on a future date:

1. Set `date` in frontmatter to the target date.
2. Set `published: true`.
3. Add this line anywhere in the PR body:

   ```
   DO NOT MERGE until 2026-04-01 UTC
   ```

**How it works:**

- `validate-blog-dates.mjs` runs on every PR to `main` that touches
  `src/posts/`. It passes future-dated posts only if the PR body contains a
  matching `DO NOT MERGE until` directive (or if `published: false`).
- `auto-merge-scheduled.yml` runs daily at 05:00 UTC. It scans open PRs for
  `DO NOT MERGE until YYYY-MM-DD UTC`, and squash-merges any whose date has
  arrived and whose CI checks all pass.


## Frontmatter Reference

| Field             | Required | Type       | Example                          |
|-------------------|----------|------------|----------------------------------|
| `title`           | yes      | string     | `"Bootstrapping Aperture"`       |
| `date`            | yes      | string     | `"2026-03-15"`                   |
| `description`     | yes      | string     | `"How we solved X."`             |
| `tags`            | yes      | string[]   | `[networking, tailscale]`        |
| `published`       | yes      | boolean    | `true`                           |
| `slug`            | no       | string     | `"bootstrapping-aperture"`       |
| `category`        | no       | string     | `"software"`                     |
| `feature_image`   | no       | string     | `"images/hero.png"`              |
| `publish_to`      | no       | string     | `"blog"`                         |
| `excerpt`         | no       | string     | Alias for `description`          |
| `categories`      | no       | string[]   | Legacy free-form categories      |
| `reading_time`    | no       | number     | Computed at build time           |
| `thumbnail_image` | no       | string     | Thumbnail URL                    |
| `featured`        | no       | boolean    | `true` to pin                    |
| `author_slug`     | no       | string     | Default: `jesssullivan`          |
| `original_url`    | no       | string     | WordPress source URL             |
| `source_repo`     | no       | string     | Set by collector                 |
| `source_path`     | no       | string     | Set by collector                 |

`slug` defaults to a slugified version of the title if omitted. `source_repo`
and `source_path` are set automatically by the collector -- do not set these
manually.


## Valid Categories

From `src/lib/types.ts`:

- `hardware`
- `software`
- `ecology`
- `music`
- `photography`
- `personal`
- `tutorial`
- `devops`
