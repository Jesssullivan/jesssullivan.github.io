# TinyVectors Extraction And Registry Deep Dive — 2026-04-16

This note follows the broader package authority audit and goes deeper on the specific package that looks most fixable and most confusing right now:

- `tinyland-inc/tinyvectors`

It also covers the two shared layers that currently prevent a clean fix:

- `tinyland-inc/ci-templates`
- `tinyland-inc/bazel-registry`

## Executive Read

`tinyvectors` is not just suffering from stale metadata. It is caught between three different source models:

1. a package still present inside `tinyland-inc/tinyland.dev`
2. a standalone public repo at `tinyland-inc/tinyvectors`
3. a Bazel registry entry still generated from the old monorepo shape

Those three layers disagree on version, publish assumptions, and in one case even package identity strategy.

The fastest safe fix is not "bump a few versions."

It is:

1. declare one canonical source for `tinyvectors`
2. repair the extraction/generation path or retire it
3. make the standalone repo self-describing and self-validating
4. then repair the registry

## Confirmed Lineage

### Standalone Repo: `tinyland-inc/tinyvectors`

Current public standalone state:

- `package.json` version: `0.2.3`
- git tags exist for:
  - `v0.1.0`
  - `v0.2.0`
  - `v0.2.1`
  - `v0.2.2`
  - `v0.2.3`
- GitHub releases: none
- root `README.md`: missing
- normal `ci.yml`: missing
- only workflow: tag-driven `publish.yml`

### Monorepo Package: `tinyland-inc/tinyland.dev/packages/tinyvectors`

Current monorepo package state:

- `package.json` version: `0.2.2`
- repository metadata still points to:
  - `https://github.com/tinyland-inc/tinyland.dev`
  - directory `packages/tinyvectors`
- `CHANGELOG.md` exists
- monorepo integration test exists at:
  - `tests/integration/packages/tinyvectors-standalone.test.ts`

### Registry Entry: `tinyland-inc/bazel-registry`

Current registry state for `tinyvectors`:

- module name: `tummycrypt_tinyvectors`
- only published registry version: `0.1.0`
- homepage points at:
  - `https://github.com/tinyland-inc/tinyland.dev/tree/main/packages/tinyvectors`
- source tarball points at:
  - `https://github.com/tinyland-inc/tinyland.dev/archive/refs/tags/v0.1.0.tar.gz`
- `strip_prefix` points at monorepo path:
  - `tinyland.dev-0.1.0/packages/tinyvectors`
- `integrity` is blank

## What This Means

The registry is not stale by accident. It is faithfully reflecting an old monorepo-centered truth model.

The standalone repo is newer than the monorepo package.

The monorepo package is newer than the registry.

That gives us three different truth layers:

| Surface | Version |
| --- | --- |
| standalone repo | `0.2.3` |
| monorepo package | `0.2.2` |
| Bazel registry | `0.1.0` |

That is not a release lane. That is archeology.

## Extraction Pipeline Findings

Two scripts in `tinyland.dev` are especially revealing:

- `.ci-templates/bootstrap-standalone.sh`
- `scripts/bulk-push-standalone.sh`

### `bootstrap-standalone.sh`

This script still assumes an older standalone package strategy:

- creates GitLab and GitHub repos
- defaults GitHub repo creation to private
- copies only:
  - package source
  - publish workflow
  - `.npmrc`
  - `.gitignore`
- does not add a normal CI workflow
- does not add a README
- does not add release metadata parity checks

It also rewrites package metadata toward a very simple npm-public story, but not a Bazel-backed one.

### `bulk-push-standalone.sh`

This script is older and even more clearly stale relative to current public package reality:

- rewrites scope from `@tummycrypt/*` to `@tinyland-inc/*`
- rewrites publish target to GitHub Packages
- sets publish access to `restricted`
- excludes `BUILD.bazel` and `MODULE.bazel`
- skips packages already considered "populated"

That is not compatible with the current `tinyvectors` standalone repo, which is:

- public
- still scoped `@tummycrypt/tinyvectors`
- published to npmjs
- carrying Bazel files

Bottom line:

The extraction and bootstrap scripts are still carrying at least one older packaging worldview. `tinyvectors` is already past that worldview, but the shared tooling has not caught up.

## The Monorepo "Standalone" Test Is Not Actually A Standalone Test

`tinyland.dev/tests/integration/packages/tinyvectors-standalone.test.ts` sounds reassuring.

But it does not validate:

- the standalone repo
- the published npm artifact
- the Bazel registry artifact
- the extracted package bootstrap flow

It imports directly from the monorepo package source paths:

- `../../../packages/tinyvectors/src/core/schema`
- `../../../packages/tinyvectors/src/themes/index`
- `../../../packages/tinyvectors/src/motion/ScrollHandler`

So the test name implies package extraction truth, while the implementation only validates monorepo-local source availability.

That is a dangerous kind of optimism because it looks like a release safety net and is not one.

## Bazel Findings

### Standalone Repo

The standalone `tinyvectors` repo carries Bazel files, but they do not read like the output of a maintained standalone build lane:

- `MODULE.bazel` still says `0.1.0`
- `BUILD.bazel` still says `0.1.0`
- `BUILD.bazel` references `//packages:tsconfig_base`
- the standalone repo has no `packages/` directory

So the Bazel surface is not merely stale. Part of it still expects monorepo context.

### Monorepo Package

The monorepo `packages/tinyvectors/BUILD.bazel` is cleaner:

- uses `load("//packages:BUILD_DEFS.bzl", "vite_package")`
- packages via the monorepo macro instead of duplicating hand-expanded standalone rules

That suggests the standalone Bazel files were likely copied or expanded from monorepo assumptions and then left behind.

## CI Findings

### Standalone Repo

Current workflow shape:

- one tag-driven `publish.yml`
- no PR or push CI
- no blocking `check`
- no blocking tests
- no lint
- no release metadata parity check
- install uses `pnpm install --no-frozen-lockfile`

This is not enough for a public package that is being consumed outside the repo.

### `ci-templates`

Current shared template strengths:

- reusable npm publish workflow exists
- secrets scan action exists
- Nix setup/cache actions exist

Current shared template gaps:

- no reusable Bazel JS package publish workflow
- no reusable release metadata parity action
- no required test/lint/check contract
- current `npm-publish.yml` treats tests as non-blocking
- current `npm-publish.yml` assumes `pnpm build` truth

That means `ci-templates` cannot yet serve as the shared authority layer for packages like:

- `scheduling-kit`
- `scheduling-bridge`
- `tinyvectors`

without each repo re-implementing the real release logic itself.

## Licensing Problem

`tinyvectors` declares:

- `Zlib AND LicenseRef-Tinyland-Proprietary`

The root `LICENSE` file says proprietary terms apply to portions that are:

- marked as proprietary
- or implement Tinyland-specific business logic

I did not find an obvious marker convention in the repo surface for proprietary files.

That makes the license boundary ambiguous for downstream consumers.

For a public npm package, that ambiguity is a problem even if the intent is reasonable.

This needs one of:

1. a clearly documented file-level or directory-level marker convention
2. a simpler license posture for the published package
3. a deliberate split between open package code and proprietary addon code

## Root Cause Summary

`tinyvectors` looks like the residue of an incomplete transition:

- monorepo package still exists
- standalone repo exists and advanced beyond the monorepo
- registry still points at the monorepo
- extraction tooling still encodes an older package-distribution model
- standalone verification is mostly absent

So the core problem is not "the standalone repo forgot a README."

The core problem is:

- there is no single, enforced production path from source to standalone repo to package artifact to Bazel registry

## Recommended Fix Order

### Phase 1 — Declare canonical source

Pick one of these and write it down explicitly:

1. `tinyland.dev/packages/tinyvectors` is canonical, and the standalone repo is generated output
2. `tinyland-inc/tinyvectors` is canonical, and the monorepo copy becomes downstream mirror or gets removed

Right now the standalone repo looks like the practical canonical source, but the supporting tooling still behaves as if the monorepo owns it.

### Phase 2 — Repair `tinyvectors` standalone repo

Minimum credible package surface:

- add `README.md`
- add normal `ci.yml` for push + PR
- make CI run:
  - install with frozen lockfile
  - build
  - check
  - tests
- add release metadata parity check:
  - `package.json`
  - `MODULE.bazel`
  - `BUILD.bazel`
- fix `MODULE.bazel` version to match actual package version
- fix `BUILD.bazel` version to match actual package version
- remove monorepo-only Bazel references like `//packages:tsconfig_base`
- decide whether Bazel is real in this repo or should be temporarily removed until it is real

### Phase 3 — Repair extraction tooling

If monorepo extraction remains part of the story:

- update `bootstrap-standalone.sh`
- update `bulk-push-standalone.sh`
- stop rewriting package scope to the old org-scoped model
- stop assuming GitHub Packages restricted publish
- add README / CI / parity generation as part of bootstrap
- make extraction aware of Bazel metadata

### Phase 4 — Repair registry generation

Only after the source-of-truth decision:

- regenerate `tummycrypt_tinyvectors` from the chosen canonical source
- add correct current versions
- point `source.json` at the real source tarball
- fill in `integrity`
- stop claiming the registry is authoritative until current package versions actually land there

### Phase 5 — Generalize shared tooling

In `ci-templates`, add shared layers for packages that want real release truth:

- reusable Bazel JS package publish workflow
- reusable release metadata parity action
- stricter blocking checks by default

That shared work should feed:

- `scheduling-kit`
- `scheduling-bridge`
- `tinyvectors`

instead of each repo solving the same authority problem differently.

## Recommended Linear Shape

These findings imply three concrete execution tracks:

1. `TIN-162` owns `tinyvectors` standalone package cleanup
2. a shared tooling issue should own Bazel-capable package publish templates in `ci-templates`
3. a registry issue should own `tinyland.dev bcr/` and `tinyland-inc/bazel-registry` convergence

## Final Read

If I had to pick the single most important conclusion from this deeper pass, it would be this:

`tinyvectors` is not just under-documented. It is standing on top of an unclosed monorepo-to-standalone migration, and the registry is faithfully preserving that old shape.

Fixing the standalone repo alone will help.

Fixing the migration boundary will make the help stick.
