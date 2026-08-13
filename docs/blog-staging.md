# Cross-Repo Blog Staging Pipeline

Status on 2026-05-19: this is a legacy/static intake path for fallback posts,
migration evidence, and source-repo drafts. It is not the primary authoring path
for the live blog.

The primary content path is:

```text
tinyland.dev blog editor / greymatter
  -> hub.tinyland.dev broker stream
  -> transscendsurvival.org /blog runtime hydration
```

Checked-in posts and snapshots remain useful for first paint, no-JS fallback,
search/index fixtures, and regression tests. New Tinyland-managed blog posts are
authored and edited in `tinyland.dev`, not in this repo's collector flow.

The legacy collector remains a manual, reviewed migration tool. No active or
replacement workflow schedules it, accepts source dispatches, writes branches,
or opens PRs.

```
reviewed source checkout ---> collect-external-posts.mts ---> local diff
                                                           |
                                                   operator-authored PR
                                                           |
                           validate-blog-dates.yml <--- PR to main
                                                           |
                              reviewed operator  ---> manual merge
```

**Five stages:**

1. **Select** -- an operator reviews the exact source repository and revision.
2. **Collect** -- `collect-external-posts.mts` fetches posts and images, normalizes frontmatter, and writes a local diff.
3. **Stage** -- the operator inspects the diff and authors a normal PR with `published: false`.
4. **Validate** -- `validate-blog-dates.mts` checks future-dated posts on every PR to `main`.
5. **Merge** -- an operator reviews and manually merges. The broad scheduled
   auto-merge workflow is retired and must remain disabled.


## Writing a Blog Post

For live Tinyland-managed posts, write or edit the post in the `tinyland.dev`
blog editor. The public site consumes the reviewed broker stream and must not
own mutation APIs, admin credentials, ActivityPub delivery workers, or media
lifecycle state.

Use this collector flow only when intentionally staging a legacy/static fallback
post from another repository.

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
linear_issue: "TIN-171"
linear_project: "Blog + Profile Integration"
---
```

`publish_to: "blog"` is the marker that tells the collector this file is
intended for the blog. If a file is already inside a scanned directory, the
marker is optional.

If you are running a legacy/static fallback post through Tinyland's Linear
surface, add `linear_issue` and optionally `linear_project`. Linear is the
control plane for idea state, review state, and scheduling context, not the
canonical longform content store.

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

2. **Run the collector manually** with ordinary operator GitHub access, inspect
   every generated post/image/provenance change, and author a reviewed PR.
3. **Do not add a notifier or shared PAT.** Source notifications and scheduled
   collection are parked while `tinyland.dev` is the mothership content SSOT.


## How Collection Works

`scripts/collect-external-posts.mts` is parked as a manual reference tool. It is
not called by GitHub Actions. Run it only in an operator-controlled checkout,
then review the working-tree diff before creating a PR.

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

No action automatically opens or updates a branch or PR.


## Scheduling Posts

To publish a post on a future date:

1. Set `date` in frontmatter to the target date.
2. Set `published: true`.
3. Add this line anywhere in the PR body:

   ```
   DO NOT MERGE until 2026-04-01 UTC
   ```

**How it works:**

- `validate-blog-dates.mts` runs on every PR to `main` that touches
  `src/posts/`. It passes future-dated posts only if the PR body contains a
  matching `DO NOT MERGE until` directive (or if `published: false`).
- Once the date arrives and canonical checks pass, an operator reviews and
  manually merges. No workflow holds generic scheduled merge authority.


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
| `editorial_tier`  | no       | string     | `"less-noteworthy"`              |
| `feature_image`   | no       | string     | `"images/hero.png"`              |
| `publish_to`      | no       | string     | `"blog"`                         |
| `linear_issue`    | no       | string     | `"TIN-171"`                      |
| `linear_project`  | no       | string     | `"Blog + Profile Integration"`   |
| `excerpt`         | no       | string     | Alias for `description`          |
| `categories`      | no       | string[]   | Legacy free-form categories      |
| `reading_time`    | no       | number     | Computed at build time           |
| `thumbnail_image` | no       | string     | Thumbnail URL                    |
| `featured`        | no       | boolean    | `true` to pin                    |
| `author_slug`     | no       | string     | Default: `jesssullivan`          |
| `original_url`    | no       | string     | WordPress source URL             |
| `source_repo`     | no       | string     | Set by collector                 |
| `source_path`     | no       | string     | Set by collector                 |

`editorial_tier` is the reader-weight contract from
[`blog-editorial-taxonomy-2026-07-03.md`](./blog-editorial-taxonomy-2026-07-03.md).
Allowed blog values are `less-noteworthy` and `noteworthy`; Pulse stays in the
Pulse snapshot/broker stream and must not be written as blog frontmatter.

`slug` defaults to a slugified version of the title if omitted. `source_repo`
and `source_path` are set automatically by the collector -- do not set these
manually. `linear_issue` and `linear_project` are optional control-plane links
for authoring and publication tracking.


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
