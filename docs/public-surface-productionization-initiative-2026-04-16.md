# Public Surface Productionization Initiative

Captured: 2026-04-16  
Primary repo: `Jesssullivan/jesssullivan.github.io`  
Related packages: `Jesssullivan/scheduling-kit`, `Jesssullivan/acuity-middleware`, `tinyland-inc/tinyvectors`  
Relevant Linear initiatives: `Presence And Narrative`, `Public FOSS Stewardship`, `Practitioner Kit Platform`

## Objective

Turn the blog and adjacent public package surface into something that is pleasant to operate, trustworthy to publish from, easier to review, and cleanly mapped onto the existing Tinyland Linear operating model.

This is not just a blog refresh. It is a surface-hardening pass across:

- blog runtime and UI
- content intake, draft review, and scheduled publication
- CI, linting, secrets hygiene, and review automation
- package authority, publish truth, and repo cleanliness for shared libraries
- Linear and docs discipline around public work

## Executive Summary

The repo is already much further along than a typical personal site. It has a real content pipeline, a useful blog-agent, static validation scripts, content collection from external repos, scheduled publication, search indexing, image processing, bundle reporting, and deploy automation.

The problem is not lack of machinery. The problem is that some of the most important parts are still soft:

- the site builds, but build warnings and soft-fail paths hide real drift
- linting is advisory instead of authoritative
- security tooling is incomplete
- the authoring workflow is clever but not fully trustworthy
- the package story across `Jesssullivan` and `tinyland-inc` is still split between canonical repos and downstream mirrors
- Linear already has the right projects and initiatives, but the blog/package work is not yet expressed there as an intentional execution program

The right move is not a giant rewrite. It is an 8-week productionization push with four parallel workstreams:

1. blog runtime and UI hardening
2. authoring and management-surface hardening
3. CI, security, and policy hardening
4. package authority and release-surface cleanup

## Current State

### Blog repo strengths

- SvelteKit static site with a mature prebuild/postbuild pipeline in [package.json](/Users/jess/git/jesssullivan.github.io/package.json).
- Cross-repo blog collection is already documented in [docs/blog-staging.md](/Users/jess/git/jesssullivan.github.io/docs/blog-staging.md).
- `packages/blog-agent` already uses Effect-style services for schema validation, prose review, slash commands, and GitHub API interactions.
- CI covers lint, typecheck, unit tests, build, redirect validation, frontmatter validation, link audit, Playwright, bundle reporting, and Lighthouse in [.github/workflows/ci.yml](/Users/jess/git/jesssullivan.github.io/.github/workflows/ci.yml).
- Scheduled publication exists today through [scripts/validate-blog-dates.mts](/Users/jess/git/jesssullivan.github.io/scripts/validate-blog-dates.mts) and [.github/workflows/auto-merge-scheduled.yml](/Users/jess/git/jesssullivan.github.io/.github/workflows/auto-merge-scheduled.yml).

### Blog repo weaknesses

- `npm audit` currently reports 20 vulnerabilities across the workspace, including a direct `@sveltejs/kit` advisory that is fixable by updating beyond `2.57.0`.
- direct dependency drift is measurable:
  - `@skeletonlabs/skeleton` and `@skeletonlabs/skeleton-svelte`: `4.13.0` -> `4.15.2`
  - `@sveltejs/kit`: `2.55.0` -> `2.57.1`
  - `svelte`: `5.53.x` -> `5.55.x`
  - `pagefind`: `1.4.0` -> `1.5.2`
  - several lint/test/tooling minors
- linting is intentionally weak:
  - `npm run lint` only targets `src/`
  - the config carries a large ignore list
  - current warnings do not fail CI
- build correctness is uneven:
  - Mermaid pre-rendering currently fails because `@mermaid-js/mermaid-cli` cannot find `puppeteer`
  - two post images are unreadable by `sharp`
  - Pagefind ignores `/` and `/consultancy.html`
  - build output shows very large chunks and post import warnings
- several generated or reference surfaces are stale:
  - [src/routes/THIRD-PARTY-LICENSES/+page.svelte](/Users/jess/git/jesssullivan.github.io/src/routes/THIRD-PARTY-LICENSES/+page.svelte) hardcodes outdated package versions
  - [docs/build-metrics.md](/Users/jess/git/jesssullivan.github.io/docs/build-metrics.md) is a snapshot, not a maintained baseline
  - [Justfile](/Users/jess/git/jesssullivan.github.io/Justfile) still carries old branding and uses `npm install` instead of `npm ci`

### Authoring workflow strengths

- blog posts can be collected from external repos into draft PRs
- the review bot validates schema, posts prose feedback, suggests links, and supports useful slash commands
- draft and schedule concepts already exist as repo labels and workflow conventions

### Authoring workflow weaknesses

- the scheduling path is not fully trustworthy:
  - `/schedule` computes the desired PR body change in [packages/blog-agent/src/agents/commands.ts](/Users/jess/git/jesssullivan.github.io/packages/blog-agent/src/agents/commands.ts), but it never actually updates the PR body
  - scheduled publication checks depend on the PR body directive, not just the label
  - this means a user can believe a PR is scheduled when it is only labeled and commented
- there is no Linear writeback, issue creation, or document/status linkage from the draft intake pipeline
- content review is GitHub-native but not yet management-surface aware

### UI and accessibility strengths

- theme switching already exists in a Skeleton Popover
- site theming is centralized in [src/lib/theme.svelte.ts](/Users/jess/git/jesssullivan.github.io/src/lib/theme.svelte.ts)
- TinyVectors already gives the site a distinct visual layer

### UI and accessibility weaknesses

- the current theme switcher trigger icon is mode-reflective instead of action-representative, which is why it reads as misleading
- the mobile and desktop theme controls are duplicated
- several theme-related controls lack explicit accessible labeling
- build output still reports a non-trivial set of a11y warnings

## Package and Org Surface Assessment

### `Jesssullivan/scheduling-kit`

State:

- This looks like the canonical public repo for the package, not the fork in `tinyland-inc`.
- It already uses Bazel, Bzlmod, Nix, modern Svelte packaging, Effect 3, and a publish lane that validates and publishes from the Bazel-produced package artifact.
- The package surface is ambitious and already closer to a real platform library than a one-off app package.

Gaps:

- CI still has soft spots, especially `continue-on-error: true` around `pnpm check` and `pnpm lint`.
- The repo has a serious platform shape, but its review and release discipline does not yet match that ambition.
- Release truth is better than the older docs imply, but not yet fully normalized across all related repos and docs.

Conclusion:

- Treat `Jesssullivan/scheduling-kit` as canonical.
- Keep `tinyland-inc/scheduling-kit` explicitly downstream-only.
- Focus next work on authoritative CI, release metadata truth, stricter checks, and docs that match the current Bazel artifact reality.

### `Jesssullivan/acuity-middleware` / `@tummycrypt/scheduling-bridge`

State:

- Also has Bazel, Bzlmod, Nix, and a Bazel-produced package artifact publish path.
- Depends on `@tummycrypt/scheduling-kit`.
- Already aligns conceptually with the `Practitioner Kit Platform` initiative.

Gaps:

- CI is notably thinner than `scheduling-kit`.
- Build and typecheck are present, but linting and test execution are not enforcing confidence in the same way.
- The repo feels more like a functional delivery vehicle than a fully productionized library surface.

Conclusion:

- Keep this repo in the `Practitioner Kit Platform` umbrella.
- Bring its CI and release discipline up to the standard desired for `scheduling-kit`.

### `tinyland-inc/tinyvectors`

State:

- The package is used directly by the blog.
- The repo has Bazel metadata, but the publish story still looks much weaker than the scheduling packages.
- Metadata is rougher than it should be for a public package: thin description, outdated homepage, and a minimal publish workflow.

Gaps:

- publish workflow is tag-only and minimal
- no strong release verification lane
- no obvious provenance or multi-registry discipline
- public package identity is underspecified

Conclusion:

- `tinyvectors` is the cleanest candidate for a public-library polish pass inside the 2-month window.
- It should move from “works for my repos” to “public package with authoritative identity and trustworthy release automation.”

### `tinyland-inc` vs `Jesssullivan`

State:

- The current operating model in Linear already points toward `Jesssullivan` as canonical for active public package work, with `tinyland-inc` keeping downstream-only forks and infra surfaces where appropriate.
- That direction matches the actual repo state better than trying to preserve dual authority.

Conclusion:

- Do not create new authority ambiguity.
- Use this initiative to finish the cleanup:
  - canonical code and releases live in the canonical repo
  - forks are explicitly downstream mirrors or organizational projections
  - docs and Linear records should say this plainly

## Key Findings

### 1. Skeleton upgrade is low-risk and already wanted

The site is on Skeleton `4.13.0` and npm currently reports `4.15.2` as available. The official Skeleton Svelte docs still use the same main installation path and Popover mental model, so this is a routine compatibility pass, not a framework migration.

Practical implication:

- upgrade Skeleton first
- verify `Popover` behavior and any styling drift
- remove stale compatibility cruft if no longer needed

### 2. The theme switcher needs product thinking, not just a new icon

The current trigger swaps sun and moon icons based on the active mode in [src/lib/components/ThemeSwitcher.svelte](/Users/jess/git/jesssullivan.github.io/src/lib/components/ThemeSwitcher.svelte). That means the icon reads like a status badge, while the control is really a settings entrypoint for both mode and palette.

Better direction:

- use a neutral settings or palette icon for the trigger
- show current mode/theme inside the popover, not in the trigger metaphor
- unify desktop and mobile theme controls behind shared markup or a shared component

### 3. The scheduling workflow has a real correctness bug

`/schedule` in [packages/blog-agent/src/agents/commands.ts](/Users/jess/git/jesssullivan.github.io/packages/blog-agent/src/agents/commands.ts) calculates a new PR body string but only posts a comment and label. The actual validation and auto-merge workflow still require the `DO NOT MERGE until YYYY-MM-DD UTC` text to exist in the PR body.

This is a genuine trust break:

- operator thinks the post is scheduled
- the automation can still refuse to honor it

This should be fixed early in the initiative.

### 4. Effect is present, but not yet strategic

Effect is used meaningfully inside `packages/blog-agent`, but it is not yet the organizing abstraction for the blog repo as a whole.

Recommendation:

- keep Effect in the authoring/automation surface
- do not force Effect into the static Svelte app runtime just to be ideologically consistent
- align versions and style with the scheduling packages only where it buys reliability and shared patterns

### 5. Greptile and gitleaks are the obvious missing hardening pieces

The Tinyland ecosystem already shows Greptile adoption in other repos and custom context in `ci-templates`. This blog repo does not yet reflect that same posture.

Immediate opportunities:

- add Greptile config and repo-specific instructions
- add `gitleaks` scanning in CI and pre-merge review
- pin action SHAs and tighten workflow permissions/timeouts
- stop treating policy as something only package repos deserve

### 6. The package surface is closer to “normalize and document” than “invent”

The old story was “scheduling-kit and scheduling-bridge still need to adopt Bazel artifact truth.” The current reality is better than that. Both repos already publish from Bazel-produced artifacts. The real remaining job is to make CI, docs, version truth, and repo authority match the state that already exists.

## 8-Week Initiative

## Workstream A — Blog Runtime and UI

### Week 1

- upgrade `@skeletonlabs/skeleton` and `@skeletonlabs/skeleton-svelte` to `4.15.2`
- upgrade `@sveltejs/kit`, `svelte`, `pagefind`, Playwright, and small lint/tooling minors
- run compatibility pass on:
  - `src/app.css`
  - `vite.config.ts`
  - `src/lib/components/ThemeSwitcher.svelte`
  - `src/routes/+layout.svelte`

### Week 2

- redesign the theme switcher trigger to use a neutral icon
- add clearer mode/theme labeling and keyboard affordances
- deduplicate desktop/mobile theme controls
- resolve the current a11y warnings around theme, search, table of contents, and sidebar controls

### Week 3

- address build-size and route-indexing issues:
  - stop importing all posts eagerly unless still justified
  - verify Pagefind can index `/` and any intended landing pages
  - capture a new build metrics baseline after the dependency pass

### Week 4

- convert stale reference surfaces into generated ones where practical:
  - third-party licenses page
  - bundle/build metrics artifact
- decide whether TinyVectors remains always-on or becomes route-aware for performance and readability reasons

## Workstream B — Authoring, Draft Intake, and Linear Surface

### Week 1

- fix `/schedule` so it truly updates the PR body
- add tests for slash-command behavior in `packages/blog-agent`
- make scheduled publication state observable in the review comment body

### Week 2

- add a `blog draft intake` management pattern in Linear:
  - imported draft PRs link to a Linear issue or document
  - PR body carries the Linear reference
  - review states map to a lightweight workflow such as `imported`, `editing`, `scheduled`, `ready`

### Week 3

- define one authoritative document for blog operations:
  - draft intake
  - style review
  - scheduling rules
  - publish checklist
  - provenance expectations for cross-repo posts

### Week 4

- extend the blog-agent to help with management-surface operations only where it is worth it:
  - optional Linear issue creation on collected posts
  - optional status summary comment showing GitHub + Linear state together
  - optional draft provenance summary

Guardrail:

- do not turn Linear into a shadow GitHub review system
- use Linear for planning and status, GitHub for content and code review

## Workstream C — CI, Security, Linting, and Policy

### Week 1

- add `gitleaks` to CI and local/pre-PR guidance
- add Greptile config modeled after the stronger repo surfaces
- tighten workflow permissions and add `timeout-minutes`
- start pinning major actions to full SHAs

### Week 2

- harden ESLint:
  - expand scope beyond `src/`
  - decide what should be linted in `scripts/` and `packages/blog-agent`
  - convert the highest-signal warnings to blocking errors
  - remove ignore entries that are hiding real drift rather than false positives

### Week 3

- decide what build warnings are tolerated versus release-blocking
- fail CI on the warnings that represent real correctness risk:
  - broken Mermaid pre-render
  - stale or unreadable source media
  - genuinely broken internal links

### Week 4

- adopt a reusable CI hardening baseline informed by `tinyland-inc/ci-templates`
- align blog repo policy with package repo policy:
  - job permissions
  - shell strictness
  - artifact retention
  - review-tool expectations

## Workstream D — Package Authority, Publishing, and Cleanliness

### Week 1

- document current authority clearly:
  - `Jesssullivan/scheduling-kit` is canonical
  - `Jesssullivan/acuity-middleware` is canonical
  - `tinyland-inc/scheduling-kit` is downstream-only
- update the relevant Linear docs so they stop describing outdated publish reality

### Week 2

- raise `scheduling-kit` CI from “helpful” to “authoritative”
- remove `continue-on-error` from checks that should gate release confidence
- ensure release metadata, package exports, and publish verification are treated as first-class

### Week 3

- strengthen `acuity-middleware` CI:
  - add lint and tests to the main CI lane
  - align publish checks with `scheduling-kit`
  - ensure release truth is documented and visible

### Week 4

- polish `tinyvectors` as a public package:
  - fix homepage and public metadata
  - strengthen the publish lane
  - add release verification
  - decide whether Bazel is truly authoritative there or merely present

## Linear Mapping

No new top-level initiative is necessary. The current Linear shape is already good enough.

Recommended mapping:

- `Presence And Narrative`
  - use `Blog + Profile Integration` for:
    - blog runtime hardening
    - theme switcher redesign
    - content pipeline and blog draft workflow
    - profile/blog narrative cleanup
- `Public FOSS Stewardship`
  - use `Libraries` for:
    - `tinyvectors`
    - Greptile/gitleaks/policy hardening on public repos
    - release-surface cleanup for shared libraries
- `Practitioner Kit Platform`
  - keep `scheduling-kit` and `acuity-middleware` normalization here
  - link the package authority and publish-truth work to existing issues such as `TIN-89`, `TIN-103`, and `TIN-104`

Recommended Linear artifacts during this initiative:

- one planning document that mirrors this file
- one issue cluster per workstream
- weekly status updates on the relevant project or initiative instead of scattered notes

## Recommended Issue Breakdown

### Blog repo

- upgrade Skeleton and adjacent frontend/tooling dependencies
- fix blog-agent `/schedule` so scheduled publication is authoritative
- redesign theme switcher trigger and unify mobile/desktop theme controls
- harden linting and reduce ignore debt
- add Greptile and gitleaks to repo policy
- repair Mermaid pre-render and classify build warnings by severity
- generate or refresh third-party license and build metrics surfaces

### Package repos

- normalize CI authority between `scheduling-kit` and `acuity-middleware`
- update package authority docs to match Bazel publish reality
- polish `tinyvectors` metadata and release automation
- verify downstream-only fork status and docs in `tinyland-inc`

## Exit Criteria

By the end of the 2 months:

- the blog builds cleanly enough that warnings are meaningful rather than ambient noise
- the theme switcher is understandable, accessible, and visually honest
- scheduled publication works end-to-end without hidden manual steps
- blog draft intake has a lightweight but real Linear management story
- Greptile and gitleaks are part of the review posture
- major workflows are better pinned, permissioned, and time-bounded
- the package authority story is explicit and documented
- `tinyvectors`, `scheduling-kit`, and `acuity-middleware` each have a clearer release and CI posture

## Risks

- trying to “Effect-ify” the whole site will waste time and add complexity where the static app does not need it
- over-rotating on old content warnings may stall higher-value work
- mixing blog polish and package stewardship without a management split will blur priorities
- creating too many new Linear containers will recreate the ambiguity the current initiative structure already solved

## First 72 Hours

- take the dependency pass in the blog repo, starting with Skeleton `4.15.2`
- fix the scheduling correctness bug in `packages/blog-agent`
- add a minimal hardening PR for gitleaks, Greptile config, and workflow policy tightening
- create or update the matching Linear planning document and link it from the relevant project surfaces
- split follow-up issues across:
  - blog runtime/UI
  - blog operations/Linear
  - security/lint/CI
  - package authority

## Notes

- The build currently succeeds, but too much of the pipeline is still best-effort.
- The package ecosystem is not chaotic so much as half-normalized.
- The correct theme for this initiative is operational truth: fewer soft assumptions, fewer stale docs, fewer “I think this is scheduled,” and more surfaces that say exactly what is real.
