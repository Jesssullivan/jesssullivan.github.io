# TinyVectors Standalone Hardening Blueprint — 2026-04-16

This note turns the `tinyvectors` source-of-truth decision into actual repo work.

## Core Call

Keep `tinyland-inc/tinyvectors` as the canonical source for `@tummycrypt/tinyvectors`.

Also keep Bazel first-class there.

The reason is practical, not ideological:

- the blog already consumes the published npm package
- the standalone repo already points its own metadata and publish story at itself
- `scheduling-kit` and `scheduling-bridge` already show a working Bazel-backed package pattern
- removing Bazel from `tinyvectors` would simplify one repo while making the registry and package-authority story less coherent

So the right move is to repair the standalone Bazel and CI surface, not retreat from it.

## Reference Pattern

The strongest donor repo right now is `Jesssullivan/scheduling-kit`.

Useful pieces to copy almost directly:

- `scripts/check-release-metadata.mjs` to verify `package.json`, `BUILD.bazel`, and `MODULE.bazel`
- normal push/PR CI that runs release-metadata verification before install/build
- publish workflow that validates `bazel build //:pkg`
- `npm pack --dry-run ./bazel-bin/pkg`
- artifact publishing from archived Bazel `pkg`, not from the mutable workspace
- `npm_package` that includes `README.md` and `LICENSE`

`Jesssullivan/acuity-middleware` is the smaller donor shape.

Useful pieces there:

- a simpler standalone TypeScript repo that still publishes from Bazel `//:pkg`
- less ceremony than `scheduling-kit`
- a good reminder that `tinyvectors` does not need GitHub Packages publishing unless there is a real consumer for it

## Confirmed TinyVectors Gaps

Current `tinyvectors` gaps relative to those patterns:

- no root `README.md`
- no normal push/PR CI
- tag-only publish workflow does direct `pnpm run build` plus `npm publish`
- no release-metadata parity script
- no `packageManager` field to anchor pnpm version in CI and Bazel parity
- `BUILD.bazel` and `MODULE.bazel` still say `0.1.0` while `package.json` is `0.2.3`
- `BUILD.bazel` still references `//packages:tsconfig_base`
- package artifact cannot include a README because none exists
- dual-license boundary is still ambiguous for downstream consumers

## Concrete Repair Order

### Phase 1 — Metadata and Docs Truth

Goal:

Make the repo self-describing.

Changes:

- add `README.md` with install, usage, exported entry points, and release-truth notes
- add `packageManager` to `package.json`
- add `publint`
- add `scripts/check-release-metadata.mjs`
- clarify the dual-license boundary, or simplify the published package license posture

Acceptance:

- repo is understandable to public consumers
- metadata drift is machine-detectable
- downstream users can tell what is open, what is proprietary, and what artifact is authoritative

### Phase 2 — Repair Standalone Bazel Surface

Goal:

Make `bazel build //:pkg` honest in the standalone repo.

Changes:

- align `BUILD.bazel` and `MODULE.bazel` version with `package.json`
- add standalone-local Node/pnpm/npm-translate-lock setup similar to `scheduling-kit`
- remove `//packages:tsconfig_base`
- include `README.md` and `LICENSE` in `npm_package`
- make `typecheck` and `test` targets resolve entirely inside the standalone repo

Acceptance:

- standalone Bazel targets resolve without monorepo path leakage
- version drift is removed
- packaged artifact contains docs and license files

### Phase 3 — Add Authoritative Normal CI and Publish Lane

Goal:

Make normal CI block on the same truth that publish uses.

Recommended CI posture:

- Node 22 only for now, because `tinyvectors` currently declares `>=22.0.0`
- blocking steps: metadata parity, frozen install, `pnpm check`, `pnpm test`, `pnpm build`, `publint`
- add `bazel build //:pkg` once the standalone Bazel repair lands
- add gitleaks or shared secrets scanning

Recommended publish posture:

- keep npmjs publish only unless a real GitHub Packages consumer appears
- replace direct workspace publish with Bazel-artifact publish
- validate with `npm pack --dry-run ./bazel-bin/pkg`
- archive the Bazel `pkg`
- publish the extracted artifact to npm

Acceptance:

- push/PR CI exists and blocks on intended checks
- publish lane uses the validated Bazel artifact
- repo no longer relies on tag-only optimistic workspace publishing

### Phase 4 — Registry Follow-Through

Goal:

Make `TIN-165` straightforward after the repo is actually authoritative.

Changes:

- regenerate `tummycrypt_tinyvectors` from standalone tags
- update homepage to the standalone repo
- update source tarball to standalone tag tarballs
- populate integrity
- publish current versions, not just `0.1.0`

## What Not To Cargo-Cult

Do not copy every `scheduling-kit` behavior blindly.

Avoid these unless a real need appears:

- dual npmjs and GitHub Packages publishing
- a Node 20/22 CI matrix while engines still require Node 22+
- a lint step with no settled lint contract just to claim lint exists

The right minimal authoritative lane for `tinyvectors` is:

- metadata parity
- frozen install
- `check`
- `test`
- `build`
- `publint`
- Bazel `//:pkg` validation
- npm publish from the Bazel artifact

## Linear Mapping

The work now splits cleanly:

1. `TIN-166` — metadata parity, README, and license truth
2. `TIN-167` — standalone Bazel repair and monorepo path removal
3. `TIN-168` — blocking CI and Bazel-artifact npm publish
4. `TIN-165` — registry regeneration after those land
