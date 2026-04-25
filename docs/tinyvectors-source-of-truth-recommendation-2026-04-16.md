# TinyVectors Source Of Truth Recommendation — 2026-04-16

This note narrows `TIN-163` down to the actual decision that needs to get made before more cleanup work happens.

## Recommendation

`tinyland-inc/tinyvectors` should become the canonical source of truth for `@tummycrypt/tinyvectors`.

The monorepo copy in `tinyland.dev` should be treated as a downstream mirror, temporary staging surface, or removal candidate. It should not remain a competing authority.

The Bazel registry should be regenerated from the standalone repo only after that source decision is explicit and the standalone repo is repaired enough to deserve being authoritative.

## Why This Is The Right Call

The most important reason is simple:

The public consumption path already runs through the standalone repo and the npm artifact published from it.

That is true in this blog repo today.

`package.json` depends on `@tummycrypt/tinyvectors` at `^0.2.3`, and `package-lock.json` resolves that to the published npm tarball for `0.2.3`. The site imports `TinyVectors` directly in `src/routes/+layout.svelte` for the live background effect. So this is not theoretical package cleanup. The public site is already downstream of the standalone release lane.

## Evidence

### 1. Downstream consumption already follows the standalone npm package

Confirmed in this repo:

- `package.json` depends on `@tummycrypt/tinyvectors` `^0.2.3`
- `package-lock.json` resolves to `https://registry.npmjs.org/@tummycrypt/tinyvectors/-/tinyvectors-0.2.3.tgz`
- `src/routes/+layout.svelte` imports `TinyVectors` from `@tummycrypt/tinyvectors`

That means the package consumers are already downstream of the standalone artifact story, not a monorepo-internal package path.

### 2. The standalone repo already presents itself as the package authority

Confirmed in `tinyland-inc/tinyvectors`:

- `package.json` version is `0.2.3`
- `repository.url` points at `https://github.com/tinyland-inc/tinyvectors`
- `publishConfig.registry` points at npmjs with public access and provenance
- tags exist through `v0.2.3`

There is also a strong historical signal in the repo commit history:

- `feat: enable npmjs.com publishing via standalone repo CI`
- `fix(tinyvectors): generate .d.ts type definitions for npm publishing`

Those are not the commits of a passive mirror. They show the standalone repo was already being shaped as the public release lane.

### 3. The registry is stale in the specific way you would expect from an unfinished migration

Confirmed in `tinyland-inc/bazel-registry`:

- `modules/tummycrypt_tinyvectors/metadata.json` only lists `0.1.0`
- the homepage still points at `tinyland.dev/tree/main/packages/tinyvectors`
- `source.json` still fetches `tinyland.dev` `v0.1.0`
- `integrity` is blank

That is not an argument for monorepo authority.

It is evidence that the registry never caught up with the standalone release path.

### 4. The standalone Bazel files are stale, but that does not make the monorepo canonical

The standalone repo still has obvious Bazel drift:

- `BUILD.bazel` and `MODULE.bazel` still say `0.1.0`
- `BUILD.bazel` still references `//packages:tsconfig_base`

That is real drift, but it points to an incomplete extraction, not to a healthy monorepo authority model.

If anything, it reinforces the same conclusion:

The standalone repo is already the public package source, but its Bazel surface was copied forward from monorepo assumptions and then left behind.

## Why The Monorepo Should Not Stay Canonical

Keeping `tinyland.dev/packages/tinyvectors` as the canonical source would mean swimming upstream against the package’s current real-world release story.

That would require:

- rebuilding the standalone repo as generated output or a strict mirror
- retargeting the release narrative away from the current standalone tags and npm publication path
- explaining why downstream consumers should trust a monorepo surface they are not actually installing from
- then regenerating the registry from that monorepo path again

That is a larger and less honest rewrite of reality.

The cleaner move is to accept the path the package already took, then make it trustworthy.

## Practical Consequences Of This Decision

If `tinyland-inc/tinyvectors` becomes canonical, then the next work should follow this order:

1. Repair the standalone repo.

- add a real `README.md`
- add normal push/PR CI
- add blocking `check`, `test`, and any intended lint step
- add release metadata parity checks for `package.json`, `BUILD.bazel`, and `MODULE.bazel`
- decide whether Bazel remains first-class there or gets intentionally removed

2. Demote or remove the monorepo copy.

- mark it as downstream or generated if it must remain
- rename misleading monorepo tests that imply standalone verification
- stop presenting it as a competing authority surface

3. Regenerate the Bazel registry from the standalone repo.

- update homepage to the standalone repo
- update source tarball to the standalone repo tags
- populate integrity
- publish current versions, not just `0.1.0`

## Confidence And Caveats

Confidence is high on the recommendation.

The only caveat is connector visibility around `tinyland.dev`. The GitHub connector did not expose that repo directly in this session, so some monorepo details here rely on the earlier audit work rather than a fresh live fetch. That does not materially change the decision, because the downstream consumption and standalone package authority signals are already strong enough on their own.

## Decision Summary

Treat `tinyland-inc/tinyvectors` as canonical.

Repair it until the CI, Bazel metadata, licensing clarity, and registry outputs stop disagreeing with that fact.
