# Blog Shadow Preview

The approved active development and QA surface is the private exact-head
tailnet route. `Jesssullivan/jesssullivan-infra` owns that acceptance
environment; this repo owns the source and static build that feeds it.

Approved development and QA route:

```text
https://jesssullivan-blog-shadow.taila4c78d.ts.net
```

## Ownership

- `Jesssullivan/jesssullivan.github.io` owns blog source, the static build,
  source-image/digest publication, protected dispatch, and the Cloudflare Pages
  production contract.
- `Jesssullivan/jesssullivan-infra` validates the dispatched source evidence
  and digest, mirrors that digest privately, and owns the RustFS-backed
  OpenTofu state, workload, apply, and private Tailscale route.
- GloriousFlywheel supplies reusable runner/build, Nix/toolchain,
  Bazel/cache/RBE, enrollment, and validation substrate. It does not own this
  application's deployment.
- Blahaj and Lab do not own this application. Blahaj is the bounded
  infrastructure receiver for cluster admission, RBAC, placement, storage,
  DNS/certificate/tunnel enforcement, and state contracts; its canonical
  adopted-live receiver/reaper exceptions do not transfer source, workload,
  route, apply-decision, or lifecycle authority. Neither do Lab host bootstrap,
  runtime policy, operator preflight, or scoped credential projection.

## Automatic PR Flow

`.github/workflows/shadow-preview.yml` is the automatic exact-head lane for the
newest active same-repo PR branch on the shared shadow route.

1. A same-repo, non-draft PR against `main` is opened, marked ready, or updated.
2. The workflow builds the static output through `Dockerfile.shadow` on the
   configured source runner. `BLOG_SHADOW_SOURCE_RUNNER` is currently
   `ubuntu-latest`; manual dispatch retains `tinyland-dind` as its explicit
   default.
3. The workflow pushes the CI source artifact to
   `ghcr.io/jesssullivan/jesssullivan-github-io-shadow-tailnet` and publishes
   the immutable OCI source digest as a job output.
4. A separate, no-checkout job enters the reviewer-gated
   `blog-shadow-dispatch` environment, mints a short-lived GitHub App token,
   and starts the named workflow in `Jesssullivan/jesssullivan-infra` with the
   source repository, workflow run, commit SHA, correlation tag, and exact
   source digest.
5. The private infra workflow validates that source workflow evidence and the
   tag-to-digest binding, mirrors the exact digest into the private operator
   package, and applies the RustFS-backed OpenTofu stack.
6. The public workflow follows the source-SHA/run-ID-correlated private run
   and fails unless that exact receiver run succeeds.

Only one branch owns the shared shadow route at a time. Source builds and
private dispatches use separate `blog-shadow-preview-build` and
`blog-shadow-preview-dispatch` concurrency groups with `cancel-in-progress:
true`. The private receiver also serializes applies, so the newest approved PR
wins without draft resolve-only runs canceling an in-flight deploy.

The correlated receiver run proves the digest-pinned workload and canonical
service responses through a Kubernetes API port-forward, and requires the
Tailscale Ingress to report a MagicDNS hostname. Direct HTTPS against the
MagicDNS route is an independent tailnet-route QA check from a
tailnet-connected client. Neither proof substitutes for the other.

Fork PRs and draft PRs are ignored. Branch pushes are covered by the PR
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
RustFS-backed OpenTofu apply, exact-head runtime attestation, canonical service
smoke, and Tailscale Ingress status. Direct MagicDNS HTTPS remains the
independent tailnet-route QA proof described above.

## Legacy Manual Shadow Image Build

`.github/workflows/shadow-image.yml` is a legacy/manual, tag-correlated source
build for `shadow-deploy/**` branches or explicit workflow dispatch. It pushes
a tagged source image only. It does not dispatch
`Jesssullivan/jesssullivan-infra`, and it is not the automatic exact-head lane.

An operator using this legacy lane must resolve the published tag to an
immutable source digest, mirror that exact digest into the private operator
package with infra-owned authority, and deliberately apply the infra-owned
stack with the digest, source SHA, and source-run correlation. The workflow
uses the `tinyland-dind` ARC runner by default and accepts
`BLOG_SHADOW_SOURCE_RUNNER=ubuntu-latest`, or manual dispatch with
`source_runner=ubuntu-latest`, when the ARC source-build lane is unavailable.

## Cloudflare Pages Compatibility Surfaces

`.github/workflows/cloudflare-pages-shadow.yml` and
`https://tss.ephemera.tinyland.dev` are the `transscendsurvival-org` Pages
build/deploy and compatibility-shadow surfaces. The workflow exercises the
static Pages artifact and is still referenced by machine production-consumer
checks. `https://tss.tinyland.dev` belongs to the separate `tss-shadow` Pages
project and can go stale until that project is deliberately redeployed. None
of these surfaces proves the private mirror, infra-owned state/apply,
digest-pinned workload, or current MagicDNS route, so do not cite them as
exact-head acceptance evidence.

The workflow uses these repository credentials and configuration:

| Kind | Name | Purpose |
|---|---|---|
| Secret | `CLOUDFLARE_ACCOUNT_ID` | Cloudflare account that owns the Pages project |
| Secret | `CLOUDFLARE_API_TOKEN` | Token with Cloudflare Pages edit/deploy access |
| Variable | `CLOUDFLARE_PAGES_PROJECT_NAME` | Pages project name; defaults to `transscendsurvival-org` |

PRs and missing-credential runs build and validate the static artifact, then
skip the Cloudflare deploy with an explicit notice. Manual dispatch accepts
`require_deploy=true` when an operator deliberately wants missing credentials
to fail instead of skip. This remains compatibility and production-serving
machinery, not the interactive PR QA route.

Cloudflare Pages remains the production serving authority for
`https://transscendsurvival.org` and `https://www.transscendsurvival.org`.
GitHub Pages remains the rollback publisher and parity path. The approved
exact-head acceptance and interactive QA target is the private tailnet route
documented above.

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

Browser validation for the client route stays in the GF-backed
`bazel-remote-gates` GitHub Actions job on `tinyland-dind`. Do not run
Playwright locally.
