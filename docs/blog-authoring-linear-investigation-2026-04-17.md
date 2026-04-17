# Blog Authoring + Linear Investigation

## Current reality

The blog already has two working authoring lanes:

1. direct repo-native authoring in `jesssullivan.github.io`
2. cross-repo staging through `collect-posts.yml` and `collect-external-posts.mts`

Both lanes are GitHub- and markdown-native. That is good. The post body, media,
frontmatter, provenance, review comments, and publication timing all already
live in places that are durable, reviewable, and automation-friendly.

Linear currently exists beside that flow, not inside it.

## What is missing

There is no durable identity bridge between:

* a Linear issue or planning thread
* a draft post in git
* the PR that reviews and schedules that post

That means the management surface and the content surface can drift apart
quietly. A post can be fully reviewable in GitHub while still being invisible
from the planning surface, or vice versa.

## Recommendation

Keep **git-backed markdown** as the canonical content store.

Do **not** move the actual post body into Linear documents as the source of
truth. Linear docs are useful for:

* outlines
* angle/positioning notes
* rollout checklists
* publication coordination

But the durable longform artifact should stay in repo markdown, where the build
pipeline, collector, prose review, scheduling, and provenance machinery already
work.

Use **Linear as the control plane**, not the body store.

## Minimal contract

The smallest useful bridge is optional frontmatter metadata:

```yaml
linear_issue: "TIN-171"
linear_project: "Blog + Profile Integration"
```

Why this is the right first seam:

* it survives direct repo authoring
* it can be preserved by the external-post collector
* it can be surfaced in review comments and future build/reporting tools
* it does not force a premature decision about Linear docs as content storage

## Recommended lifecycle

1. Create or choose a Linear issue for the post-sized unit of work.
2. Draft the actual post in repo markdown, locally or in a source repo.
3. Carry `linear_issue` in frontmatter from the first meaningful draft onward.
4. Let GitHub PRs remain the review and scheduling surface.
5. Use the Linear issue for readiness, editorial coordination, and narrative grouping.

## Near-term implementation slices

### Slice A — identity bridge

Land the optional frontmatter contract and preserve it through the collector.

This pass is low risk and unlocks future reporting.

### Slice B — agent ergonomics

Add a slash command like:

```text
/link-linear TIN-171
```

That should update the target post frontmatter in-place and comment back with
the linked issue.

### Slice C — review visibility

Make the review bot warn when a publishable post lacks a `linear_issue`.

This should be advisory first, not blocking.

### Slice D — management sync

Add a lightweight report or script that can answer:

* which open blog PRs map to which Linear issues
* which future-scheduled posts do not have a matching Linear issue
* which collected posts arrived without a control-plane link

## Linear-specific observations

As of 2026-04-17:

* `Presence And Narrative` is the right initiative container
* `Blog + Profile Integration` is the right project container
* there is not yet a dedicated authoring/control-plane issue in that project
* some merged execution issues from the week-one productionization pass still
  appear open or in progress and should be closed out so the planning surface
  stops understating what already landed

## Recommended next issue

Create one explicit issue under `Blog + Profile Integration`:

**Define and implement the blog authoring control-plane contract**

Scope:

* optional `linear_issue` / `linear_project` frontmatter
* collector preservation
* advisory surfacing in review comments
* follow-on decision on whether `/link-linear` should exist

That is the smallest next slice that materially improves authoring truth
without turning Linear into a second CMS.
