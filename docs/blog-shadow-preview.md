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
2. The workflow builds `Dockerfile.shadow` on the `tinyland-dind` ARC runner
   by default.
3. The workflow pushes the CI source artifact to
   `ghcr.io/jesssullivan/jesssullivan-github-io-shadow-tailnet`.
4. The workflow dispatches `Jesssullivan/jesssullivan-infra` with the exact
   image tag and source metadata.
5. The private infra workflow mirrors that tag into the private operator
   package and applies the RustFS-backed OpenTofu stack.

Only one branch owns the shared shadow route at a time. The source-image build
job uses concurrency group `blog-shadow-preview` with `cancel-in-progress:
true`, so the newest active PR branch wins without draft resolve-only runs
canceling an in-flight deploy.

Fork PRs and draft PRs are ignored. Branch pushes are covered by the PR
`synchronize` event so the workflow does not create duplicate push and PR check
runs for the same commit.

## Required Secret

This public repo needs one secret:

| Secret | Purpose |
|---|---|
| `BLOG_SHADOW_DISPATCH_TOKEN` | Can create `repository_dispatch` events in `Jesssullivan/jesssullivan-infra` |

Cluster credentials, RustFS credentials, and private GHCR mirroring credentials
stay in the private infra repo.

## Runner Fallback

The default source-image runner remains `tinyland-dind`; that is the real ARC
proof for private-route preview builds. Manual dispatch also accepts
`source_runner=ubuntu-latest` as a guarded fallback when the ARC source-image
lane is unavailable. That fallback only proves the public source artifact build
and dispatch. It does not prove private GHCR mirroring, RustFS-backed
OpenTofu apply, or tailnet smoke; those remain private infra responsibilities.

## Manual Shadow Image Build

`.github/workflows/shadow-image.yml` still supports the older
`shadow-deploy/**` branch flow for explicit operator builds. That workflow only
builds the source image; the private mirror and apply are handled by infra. It
uses the `tinyland-dind` ARC runner by default and accepts the same
`BLOG_SHADOW_SOURCE_RUNNER=ubuntu-latest` fallback, or manual dispatch
`source_runner=ubuntu-latest`, when the ARC source-image lane is unavailable.

## Cloudflare Pages Shadow

`.github/workflows/cloudflare-pages-shadow.yml` builds the same static
SvelteKit output and can publish it to Cloudflare Pages by Direct Upload.

This is a shadow lane for moving `transscendsurvival.org` toward the Tinyland
static-spoke edge posture. It does not cut over DNS, replace GitHub Pages
production, or add live Tinyland broker fallback behavior.

Required repository secrets:

| Secret | Purpose |
|---|---|
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare account that owns the Pages project |
| `CLOUDFLARE_API_TOKEN` | Token with Cloudflare Pages edit/deploy access |

Optional repository variable:

| Variable | Default | Purpose |
|---|---|---|
| `CLOUDFLARE_PAGES_PROJECT_NAME` | `transscendsurvival-org` | Cloudflare Pages project name |

PRs and missing-credential runs build and validate the static site, then skip
the Cloudflare deploy with an explicit notice. Manual dispatch accepts
`require_deploy=true` when the operator wants missing credentials to fail
instead of skip.

Keep GitHub Pages as production until the Cloudflare deploy URL, TLS, route
smoke, and rollback notes are proven. Browser validation remains in GitHub
Actions or an approved remote lane. Do not run local Playwright for this slice.

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
