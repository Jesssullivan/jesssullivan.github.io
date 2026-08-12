# Blog Shadow Preview

The live shadow preview route is owned by `Jesssullivan/jesssullivan-infra`,
but this repo owns the branch build that feeds it.

Current review route:

```text
https://jesssullivan-blog-shadow.taila4c78d.ts.net
```

## Automatic PR Flow

`.github/workflows/shadow-preview.yml` publishes the newest active same-repo PR
branch to the shared shadow route.

1. A same-repo, non-draft PR against `main` is opened, marked ready, or updated.
2. The workflow builds `Dockerfile.shadow` on the configured source runner.
   `BLOG_SHADOW_SOURCE_RUNNER` is currently `ubuntu-latest`; manual dispatch
   retains `tinyland-dind` as its explicit default.
3. The workflow pushes the CI source artifact to
   `ghcr.io/jesssullivan/jesssullivan-github-io-shadow-tailnet`.
4. A separate, no-checkout job enters the reviewer-gated
   `blog-shadow-dispatch` environment, mints a short-lived GitHub App token,
   and starts the named workflow in `Jesssullivan/jesssullivan-infra` with the
   exact image digest and source metadata.
5. The private infra workflow mirrors that digest into the private operator
   package and applies the RustFS-backed OpenTofu stack.
6. The public workflow follows the source-SHA/run-ID-correlated private run
   and fails unless that exact receiver run succeeds.

Steps 4–6 are fail-closed behind the repository variable
`BLOG_SHADOW_APPLY_ENABLED=true`. Unset or any other value stops after the
source-image SHA+digest evidence; it cannot mint the private token, dispatch the
receiver, apply infra, or perform receiver verification. Do not enable it while
TIN-2801 has the `prod-blocker` hold. Changing the variable is a separate
operator action.

Only one branch owns the shared shadow route at a time. Source builds and
private dispatches use separate `blog-shadow-preview-build` and
`blog-shadow-preview-dispatch` concurrency groups with `cancel-in-progress:
true`. The private receiver also serializes applies, so the newest approved PR
wins without draft resolve-only runs canceling an in-flight deploy.

Fork PRs and draft PRs are ignored, including `synchronize` events on an
already-draft PR. Branch pushes are covered by the PR
`synchronize` event so the workflow does not create duplicate push and PR check
runs for the same commit.

## Required Dispatch Authority

The `blog-shadow-dispatch` environment requires operator review and carries
one secret. The App ID is a repository variable:

| Kind | Name | Purpose |
|---|---|---|
| Variable | `BLOG_SHADOW_DISPATCH_APP_ID` | Selects the reviewed GitHub App |
| Environment secret | `BLOG_SHADOW_DISPATCH_APP_PRIVATE_KEY` | Mints a short-lived token scoped at runtime to `jesssullivan-infra` with `actions: write` |

The inherited `gloriousflywheel-jesssullivan` App installation has broader
repository administration authority than this lane needs. Keep its key behind
the required-review environment and the no-checkout job; do not move it to a
repository-wide secret. A dedicated App installed only on
`Jesssullivan/jesssullivan-infra` is the final least-privilege posture.

Cluster credentials, RustFS credentials, and private GHCR mirroring credentials
stay in the private infra repo.

## Runner Fallback

The normal PR source-image runner is selected by `BLOG_SHADOW_SOURCE_RUNNER`
and is currently `ubuntu-latest`. Manual dispatch can select `tinyland-dind`
when an ARC source-build proof is required. A hosted build does not prove the
ARC source-build lane.
The correlated receiver result still separately proves private GHCR mirroring,
RustFS-backed OpenTofu apply, and tailnet smoke.

## Manual Shadow Image Build

`.github/workflows/shadow-image.yml` still supports the older
`shadow-deploy/**` branch flow for explicit operator builds. That workflow only
builds the source image; the private mirror and apply are handled by infra. It
uses the `tinyland-dind` ARC runner by default and accepts the same
`BLOG_SHADOW_SOURCE_RUNNER=ubuntu-latest` fallback, or manual dispatch
`source_runner=ubuntu-latest`, when the ARC source-image lane is unavailable.

## Cloudflare Pages Production And TSS Shadow

`.github/workflows/cloudflare-pages-production.yml` builds the static SvelteKit
output for the production `transscendsurvival-org` Pages project. Pull requests
build only. A successful canonical `CI` run on the exact current `main` SHA
triggers publication; the resolver additionally requires successful
`build-and-test` and `bazel-remote-gates` jobs. Manual runs name an exact current
`main` SHA, require the same CI evidence, and default to build-only.
An automatic run re-reads `heads/main` before building and again immediately
before upload; a slower older CI run cannot publish after a newer main commit
and roll production backward.

Publication is additionally held behind the fail-closed repository variable
`CLOUDFLARE_PAGES_PRODUCTION_ENABLED=true`. Unset or any other value records the
verified build evidence without uploading. Do not enable it while TIN-2801 has
the `prod-blocker` hold; changing the variable is a separate operator action.

Merging a workflow change remains deployment-sensitive: once canonical main CI
is green, its `workflow_run` path can publish only when the operator variable is
also enabled. Keep that gate disabled while TIN-2801 or any other production
hold is unresolved.

`https://tss.tinyland.dev` remains the separate `tss-shadow` Pages project and
is not updated by the production workflow. Its build must set
`PUBLIC_DEPLOY_TIER=shadow` and an exact 40-character `PUBLIC_SOURCE_SHA`; this
adds a site-wide compile-time `noindex,nofollow` marker plus source-SHA evidence.
Production and normal local builds default to the production tier and cannot
inherit this marker. The site remains static, but current `/blog`,
`/blog/[slug]`, and `/pulse` client code may hydrate from public
`hub.tinyland.dev` broker endpoints at runtime when those endpoints are
available.

This branch intentionally has no `/stream` route (`404`). The current live TSS
`/stream` response comes from an older dedicated shadow artifact and is not
parity evidence for this build; production `/stream` is also `404`. Restoring or
redesigning that route is outside this migration.

Required repository secrets:

| Secret | Purpose |
|---|---|
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare account that owns the Pages project |
| `CLOUDFLARE_API_TOKEN` | Token with Cloudflare Pages edit/deploy access |

Optional repository variable:

| Variable | Default | Purpose |
|---|---|---|
| `CLOUDFLARE_PAGES_PROJECT_NAME` | `transscendsurvival-org` | Cloudflare Pages project name |

Automatic production publishes and manual runs with `deploy=true` fail closed
when either credential is absent. Manual runs with the default `deploy=false`
record the exact source SHA, successful CI URL, and static-content digest
without uploading.

Cloudflare Pages is the production serving authority. GitHub Pages remains the
rollback publisher and parity path. Its `.github/workflows/deploy-pages.yml`
workflow remains an independent main-push publisher without the Cloudflare
canonical-CI promotion gate. Browser validation remains in GitHub Actions or an
approved remote lane. Do not run local Playwright for this slice.

## Pulse Client Smoke

The durable Pulse client package currently uses `/pulse/client` as its noindex
browser smoke target. The full proof contract is documented in
[`tinyland-pulse-durable-client-ci-shadow-2026-05-03.md`](./tinyland-pulse-durable-client-ci-shadow-2026-05-03.md).

After a Pulse client branch deploys to the shared shadow route, smoke these from
a tailnet-connected machine:

```sh
SHADOW="https://jesssullivan-blog-shadow.taila4c78d.ts.net"

curl -fsSIL "$SHADOW/"
curl -fsSIL "$SHADOW/pulse"
curl -fsSIL "$SHADOW/pulse/lab"
curl -fsSIL "$SHADOW/pulse/client"
curl -fsSL "$SHADOW/data/pulse/public-snapshot.v1.json"
```

Browser validation for the client route stays in hosted GitHub Actions. Do not
run Playwright locally.
