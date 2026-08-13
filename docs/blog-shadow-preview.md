# Blog Shadow Preview

The shadow route is owned by `Jesssullivan/jesssullivan-infra`, but it currently
serves an older held artifact. The v2 workflows in this repo can only build and,
behind a live gate, publish an immutable source image; they cannot mirror,
apply, or update the route.

Held shadow route:

```text
https://jesssullivan-blog-shadow.taila4c78d.ts.net
```

## Two-Stage Source Flow

The legacy `.github/workflows/shadow-preview.yml` workflow ID is retired and
must remain disabled. Historical branches still contain its unsafe manual
dispatch behavior, so reusing that path would reopen the incident even after a
main-branch fix.

The replacement uses two new workflow paths and IDs:

1. `.github/workflows/shadow-source-build-v2.yml` accepts only the typed
   `shadow-source-build-v2` repository dispatch, which GitHub loads from the
   default branch. It accepts only an open same-repo PR at its exact current
   40-character head SHA. There is deliberately no `pull_request`
   trigger: a PR-authored workflow could rewrite its own permissions and steps.
2. PR code builds `Dockerfile.shadow` on `ubuntu-latest` without package-write,
   App-token, environment-secret, or infra-dispatch authority. It uploads an
   OCI archive plus immutable run/attempt/SHA metadata.
3. `.github/workflows/shadow-source-publish-v2.yml` runs through
   `workflow_run`, so GitHub loads it from the default branch. It never checks
   out or executes PR code. It downloads the exact upstream artifacts, then
   re-reads the live PR and rejects closed, forked, retargeted, redrafted, or
   head-changed inputs.
4. Package publication is separately fail-closed behind
   `BLOG_SHADOW_SOURCE_PUBLISH_ENABLED=true`. The workflow re-reads that live
   variable and PR state immediately before its package write.
5. A future coordinated change may add a typed default-owned private receiver
   and a sender that awaits exact source-SHA/run-ID-correlated success. Neither
   exists now, so apply is unavailable. The disabled legacy
   `blog-shadow-preview-deploy.yml` ID must not be re-enabled.

The publication variable defaults closed. Source-only code merges are permitted
under the current TIN-2801 ruling, but enabling publication, adding credentialed
apply authority, or deploying remains prohibited while its `prod-blocker` hold
is unresolved.

Source builds serialize per PR, and trusted package publication has a separate
global concurrency group. No workflow in this change can update the shared
shadow route.

Fork, closed, retargeted, and head-changed PR inputs fail closed. A manual
exact-SHA draft build is allowed only as build-only evidence; trusted package
publication rejects draft or redrafted PRs. There are no automatic preview
builds and no apply request.

## Current Source Authority

Only one repository variable is consumed by the replacement workflows:

| Kind | Name | Purpose |
|---|---|---|
| Variable | `BLOG_SHADOW_SOURCE_PUBLISH_ENABLED` | Allows the trusted default-branch consumer to publish the verified OCI archive |

The live `blog-shadow-dispatch` environment has no required reviewer. It may
retain parked legacy configuration, but no v2 workflow references that
environment, its App ID, or its private key. A future receiver change must use a
dedicated least-privilege App and cannot treat this environment as an approval
gate.

Cluster credentials, RustFS credentials, and private GHCR mirroring credentials
stay in the private infra repo.

## Runner Fallback

The v2 PR source-image runner is deliberately restricted to `ubuntu-latest`.
This keeps untrusted branch builds off privileged or repo-inaccessible ARC
labels. A hosted build proves only the source artifact; private GHCR mirroring,
RustFS-backed OpenTofu apply, and tailnet smoke have no v2 proof yet.

## Operator Source Request

After the new path exists on `main`, request an exact source build with:

```sh
PR=251
SHA="$(gh pr view "$PR" --repo Jesssullivan/jesssullivan.github.io --json headRefOid --jq .headRefOid)"
gh api --method POST repos/Jesssullivan/jesssullivan.github.io/dispatches \
  -f event_type=shadow-source-build-v2 \
  -f "client_payload[source_pr]=$PR" \
  -f "client_payload[source_sha]=$SHA"
```

There is no apply input or apply job. Any future apply must be a separate,
coordinated contract keyed to the published immutable digest.

## Retired Shadow Workflows

Both `.github/workflows/shadow-preview.yml` and
`.github/workflows/shadow-image.yml` are retired. The latter accepted an
arbitrary ref in a branch-authored package-write job, so its historical workflow
ID must remain disabled as well. Do not revive either path; all source builds
and publication now cross the v2 unprivileged-build/default-branch-consumer
boundary.

## Cloudflare Pages Production And TSS Shadow

`.github/workflows/cloudflare-pages-production-v2.yml` builds the static
SvelteKit output for the production `transscendsurvival-org` Pages project. It
has no PR trigger; typed exact-PR parity lives in the secretless
`.github/workflows/cloudflare-pages-parity-v2.yml`. A successful canonical `CI`
run on the exact current `main` SHA
triggers build/provenance evidence only; it never automatically publishes. The
resolver additionally requires successful `build-and-test`,
`bazel-remote-gates`, and exact-SHA private-CV consistency. Only the typed
`cloudflare-pages-production-v2` repository dispatch may request publish with
`deploy="true"`; it must name exact current `main` and pass the same evidence.
The operator path re-reads `heads/main` before building and immediately before
upload; a stale request cannot roll production backward.

Publication is additionally held behind the fail-closed repository variable
`CLOUDFLARE_PAGES_PRODUCTION_ENABLED=true`. An operator deploy request fails
when it is unset or false; automatic CI completion remains build-only. Do not
enable it while TIN-2801 has the `prod-blocker` hold.

The `workflow_run` path hard-codes `deploy=false`. Publication requires a later
typed `repository_dispatch` with `deploy=true` plus the live gate. Keep that
gate disabled while TIN-2801 or any other production hold is unresolved.

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

Operator dispatches with `deploy="true"` fail closed when the gate or either
credential is absent. `deploy="false"` is rejected; use the secretless parity
workflow for build-only PR evidence. Automatic CI completion records the exact
source SHA, successful CI URL, and static-content digest without uploading.

After TIN-2801 is resolved and the gate is deliberately enabled:

```sh
SHA="$(gh api repos/Jesssullivan/jesssullivan.github.io/commits/main --jq .sha)"
gh api --method POST repos/Jesssullivan/jesssullivan.github.io/dispatches \
  -f event_type=cloudflare-pages-production-v2 \
  -f "client_payload[source_sha]=$SHA" \
  -f 'client_payload[deploy]=true'
```

Cloudflare Pages is the production serving authority. GitHub Pages is deprecated
as CI/CD and remains only an explicit rollback target. The new-path
`.github/workflows/github-pages-rollback-v2.yml` requires an exact current-main
SHA, successful canonical CI/private-CV authority, a confirmation payload, the
`BLOG_GITHUB_PAGES_ROLLBACK_ENABLED=true` kill switch, and a final live recheck.
It has no push, content-stats, or production-health trigger. The legacy
`deploy-pages.yml` workflow ID is disabled and must remain so; do not delete or
disable the GitHub Pages service itself.

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
