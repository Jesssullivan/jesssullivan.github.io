# Package Authority Audit — 2026-04-16

As of April 16, 2026, the package story across `Jesssullivan` and `tinyland-inc` is real, useful, and still too ambiguous to call productionized. Some repos already have the bones of authoritative Bazel-backed publishing. Others mostly have the costume.

This audit focuses on the package surfaces most relevant to the blog and the current productionization initiative:

- `Jesssullivan/scheduling-kit`
- `tinyland-inc/scheduling-kit`
- `Jesssullivan/acuity-middleware` (`@tummycrypt/scheduling-bridge`)
- `tinyland-inc/tinyvectors`
- `tinyland-inc/ci-templates`
- `tinyland-inc/bazel-registry`

## Executive Read

The strongest package authority today lives in `Jesssullivan/scheduling-kit` and `Jesssullivan/acuity-middleware`. Both repos have real Bazel package targets and publish workflows that build and publish from Bazel-produced `//:pkg` artifacts.

That said, neither repo is fully done:

- `scheduling-kit` still treats `lint` and `check` as advisory in CI
- `acuity-middleware` has Bazel-backed publishing, but its normal CI lane is still thinner than it should be for a public package
- the org-side Bazel registry does not yet reflect current release truth for these packages

`tinyland-inc/tinyvectors` is the weakest public package surface in this set. It is actively consumed by the blog, but its package metadata, Bazel metadata, registry metadata, and CI posture are all out of alignment.

## Cross-Owner Overlap

There are at least 16 duplicated repo names shared across `Jesssullivan` and `tinyland-inc`:

- `Ansible-DAG-Harness`
- `MassageIthaca`
- `XoxdWM`
- `acuity-admin-skills`
- `fuzzy-crush`
- `outbot-ci`
- `prompt-pulse-tui`
- `remote-juggler`
- `scheduling-kit`
- `tiny-tailscale-mikrotik`
- `tinyclaw`
- `tinyland-cleanup`
- `tinyland-hexstrunk`
- `tinyland-huskycat`
- `tinyland-kdbx`
- `tummycrypt`

This matters because a package consumer cannot safely infer authority from the namespace alone. Some org repos are intentional downstream forks. Some user repos are canonical release lines. Some repos are standalone org-owned packages. The current surface still requires insider knowledge.

## Repo Findings

### 1. `Jesssullivan/scheduling-kit`

Current posture:

- public repo
- default branch `main`
- pushed April 16, 2026 at `15:42:21Z`
- package name: `@tummycrypt/scheduling-kit`
- package version: `0.7.1`

Good signs:

- `package.json`, `MODULE.bazel`, and `BUILD.bazel` all agree on `0.7.1`
- `scripts/check-release-metadata.mjs` enforces version and package-name parity across:
  - `package.json`
  - `MODULE.bazel`
  - `BUILD.bazel`
- `publish.yml` validates `bazel build //:pkg`
- `publish.yml` publishes npm and GitHub Packages from the Bazel-built artifact, not from an ad hoc `pnpm publish`
- README explicitly documents current release authority

Weak signs:

- `ci.yml` still runs `pnpm check` with `continue-on-error: true`
- `ci.yml` still runs `pnpm lint` with `continue-on-error: true`
- publish flow re-runs `pnpm build` after Bazel package validation, which means the repo still carries a mixed truth model instead of a single artifact contract

Bottom line:

`Jesssullivan/scheduling-kit` is the best current example of package authority in this set. It is not soft anymore, but it is not yet clean enough to be called fully authoritative end to end.

### 2. `tinyland-inc/scheduling-kit`

Current posture:

- public repo
- actual GitHub fork: `isFork = true`
- default branch `main`
- pushed April 16, 2026 at `17:02:01Z`
- README explicitly says this repo is a downstream organizational fork

Good signs:

- README now tells readers to use `Jesssullivan/scheduling-kit`
- `scripts/block-fork-publish.mjs` intentionally fails `prepublishOnly`
- `publish.yml` is validation-only and says publish authority lives upstream

Weak signs:

- `package.json` says version `0.7.0`
- `BUILD.bazel` says version `0.5.0`
- `MODULE.bazel` says version `0.5.0`
- README still describes the functional core in `fp-ts` terms, while upstream has moved to `Effect`
- `repository.url` in `package.json` points at `Jesssullivan/scheduling-kit`, which is honest, but also underscores that this fork still carries stale package metadata

Bottom line:

This repo is doing the right social thing and the wrong metadata thing. It tells humans not to publish from here, but it still presents stale Bazel/package truth to any automation or casual reader that inspects the files directly.

### 3. `Jesssullivan/acuity-middleware` / `@tummycrypt/scheduling-bridge`

Current posture:

- public repo
- default branch `main`
- pushed April 16, 2026 at `14:47:23Z`
- package name: `@tummycrypt/scheduling-bridge`
- package version: `0.4.2`

Good signs:

- package naming drift has been acknowledged directly in the README
- `package.json`, `MODULE.bazel`, and `BUILD.bazel` all agree on `0.4.2`
- publish flow validates `bazel build //:pkg`
- npm publish and GitHub Packages publish both happen from the Bazel artifact
- README exposes release tuple and protocol tuple expectations for downstream runtime verification

Weak signs:

- repo name still says `acuity-middleware` while the package identity says `scheduling-bridge`
- standard CI only runs `typecheck` and `build`
- standard CI does not run tests, lint, or release-metadata parity checks
- there is no dedicated metadata parity script comparable to `scheduling-kit`

Bottom line:

This repo has a stronger publish lane than its CI lane. The Bazel artifact story is fairly credible. The naming and verification story is not yet as clean as the package deserves.

### 4. `tinyland-inc/tinyvectors`

Current posture:

- public repo
- default branch `main`
- pushed March 5, 2026 at `05:39:50Z`
- package name: `@tummycrypt/tinyvectors`
- package version: `0.2.3`
- actively consumed by this blog repo

Good signs:

- package has a real public npm identity
- package declares provenance in `publishConfig`
- test files exist
- package has both unit tests and property-based tests

Weak signs:

- there is no `README.md` in the repo root
- there is no normal `ci.yml`, only a tag-driven publish workflow
- publish workflow does `pnpm install --no-frozen-lockfile`
- publish workflow does not run `check`, `lint`, or tests
- publish workflow publishes directly with `npm publish`, not a Bazel-built package
- `package.json` says `0.2.3`
- `MODULE.bazel` says `0.1.0`
- `BUILD.bazel` says `0.1.0`
- Bazel registry also says `0.1.0`
- Bazel registry metadata still points to `tinyland.dev/tree/main/packages/tinyvectors`
- Bazel registry `source.json` still points to a `tinyland.dev` monorepo tarball, not the standalone `tinyvectors` repo
- Bazel registry `source.json` leaves `integrity` blank
- `BUILD.bazel` references `//packages:tsconfig_base`, but this standalone repo has no `packages/` directory

Bottom line:

`tinyvectors` is the clearest candidate for immediate productionization work. Right now it is useful, but not trustworthy. The package surface, Bazel surface, and registry surface disagree with each other in multiple ways.

### 5. `tinyland-inc/ci-templates`

Current posture:

- public repo
- default branch `main`
- pushed April 15, 2026 at `21:52:22Z`

Good signs:

- shared actions exist for Nix setup, greedy caching, and secrets scanning
- reusable `npm-publish.yml` is a useful baseline for small packages
- repo explicitly includes a combined TruffleHog and Gitleaks action path

Weak signs:

- reusable `npm-publish.yml` treats tests as non-blocking
- reusable `npm-publish.yml` has no Bazel artifact support
- reusable `npm-publish.yml` has no release metadata parity enforcement
- reusable `npm-publish.yml` assumes pnpm build truth

Bottom line:

`ci-templates` is a convenience layer, not yet an authoritative release framework for the packages that care about Bazel parity and metadata truth.

### 6. `tinyland-inc/bazel-registry`

Current posture:

- public repo
- default branch `main`
- pushed March 25, 2026 at `03:18:18Z`
- described as a private Bazel Central Registry for `@tummycrypt/*`

Good signs:

- registry layout is present
- module population is broad across the Tinyland package swarm

Weak signs:

- many modules appear pinned only at `0.1.0`
- `tummycrypt_tinyvectors` is stale and still points to `tinyland.dev`
- no `scheduling-kit` module entry was found
- no `scheduling-bridge` module entry was found
- no `tinyland-auth-pg` module entry was found, even though `scheduling-kit` depends on it

Bottom line:

The registry is not yet safe to treat as authoritative package truth. Today it looks more like a generated snapshot of an earlier monorepo worldview than a current source of consumption truth.

## Bazel Authority Read

The cleanest framing I can support from this audit is:

- Bazel is becoming authoritative for `scheduling-kit` and `scheduling-bridge` artifact production
- pnpm still remains authoritative for too much local development and too much CI behavior
- Bazel is not authoritative for `tinyvectors` today, even though Bazel files exist
- the org registry is not authoritative for downstream module consumption yet

So the answer is not "Bazel yes" or "Bazel no."

It is:

- `scheduling-kit`: mostly yes for release artifact shape
- `scheduling-bridge`: partly yes for release artifact shape
- `tinyvectors`: no, not in a trustworthy sense
- `bazel-registry`: no, not yet

## Recommended Authority Matrix

Near-term canonical read:

| Surface | Canonical Now | Notes |
| --- | --- | --- |
| `@tummycrypt/scheduling-kit` | `Jesssullivan/scheduling-kit` | keep org fork validation-only until metadata parity or archival |
| `@tummycrypt/scheduling-bridge` | `Jesssullivan/acuity-middleware` | package identity should eventually converge with repo identity |
| `@tummycrypt/tinyvectors` | `tinyland-inc/tinyvectors` | but only after CI, README, Bazel parity, and registry truth are repaired |
| shared npm publish templates | `tinyland-inc/ci-templates` | use as baseline, not as final truth layer |
| Bazel module distribution | `tinyland-inc/bazel-registry` | only after stale modules are corrected and missing packages are added |

## Recommended 8-Week Workstream

### Weeks 1-2 — Freeze and declare authority

- move `TIN-162` to active execution
- add explicit canonical-home language to every overlapping public package repo that is not authoritative
- remove or block any remaining accidental publish path on downstream forks
- write one authority matrix covering the 16 overlapping repo names

### Weeks 2-4 — Make release metadata single-source

- introduce one release metadata source per package repo
- generate or validate:
  - `package.json` version
  - `MODULE.bazel` version
  - `BUILD.bazel` package/version
  - repo/homepage identity
- port the `scheduling-kit` metadata check pattern to `acuity-middleware`
- create an org-shared action for release metadata parity rather than hand-copying scripts

### Weeks 3-5 — Make CI gating honest

- in `scheduling-kit`, make `lint` and `check` blocking
- in `acuity-middleware`, add test and lint coverage to the normal CI lane
- add a proper `ci.yml` to `tinyvectors`
- make `tinyvectors` publish from a validated build artifact, not direct best-effort `npm publish`

### Weeks 4-6 — Repair `tinyvectors`

- add README
- fix Bazel metadata to `0.2.3` or intentionally cut a new coherent release
- remove broken monorepo references from `BUILD.bazel`
- decide whether the repo remains standalone or is generated from another canonical source
- add release metadata parity checks

### Weeks 5-7 — Repair the Bazel registry

- add current entries for `scheduling-kit`
- add current entries for `scheduling-bridge`
- fix `tinyvectors` source URL and integrity
- add missing modules that current packages depend on
- document registry generation source and update cadence

### Weeks 6-8 — Close the overlap debt

- review the remaining overlapping repo names
- archive, lock, or explicitly route any repo that is no longer meant to receive issue or release traffic
- keep only one canonical planning and release surface per package

## Immediate Next Actions

The highest-value next actions from this audit are:

1. update `TIN-162` with the concrete `tinyvectors` drift list and move it to `In Progress`
2. attach these findings to `TIN-103` and `TIN-104`
3. decide whether `tinyvectors` remains org-owned standalone, or should be rebuilt from another canonical source before more releases
4. make `tinyland-inc/bazel-registry` a tracked follow-up under the same package-truth program instead of treating it as already solved
