# Tinyland Pulse Durable Client CI And Shadow Proof

Date: 2026-05-03

Linear: `TIN-930` - Add hosted CI and shadow route for durable Pulse client surface.

Status: historical planning/QA contract on top of `TIN-926` / PR #103, updated
2026-08-12 for current shadow authority. `/pulse/client` remains a noindex
blog-hosted surface, but no active v2 workflow deploys it to the tailnet route.

Related:

- [Tinyland Pulse Client Home Decision](./tinyland-pulse-client-home-decision-2026-05-03.md)
- [Tinyland Pulse M2 Client Contract](./tinyland-pulse-m2-client-contract-2026-04-28.md)
- [Blog Shadow Preview](./blog-shadow-preview.md)
- `TIN-926` - scaffold durable Pulse client app/package consuming `@blog/pulse-core`

## Decision

Use hosted blog CI to prove the split client package until the durable Pulse
client becomes a separately deployed app. The previous tailnet shadow apply
lane is retired; the held route is not current branch-demo evidence.

For the current M2 slice:

- `@blog/pulse-client` owns reusable client-side draft, outbox, identity, media-intent, and storage adapters.
- `/pulse/client` remains the noindex browser smoke surface for those adapters.
- GitHub Actions owns browser automation. Do not run Playwright locally.
- The shared blog shadow route currently serves an older held artifact and is
  not a branch-demo lane.
- `Jesssullivan/jesssullivan-infra` remains the owner of private mirroring,
  RustFS-backed OpenTofu apply, cluster credentials, and tailnet route exposure;
  no v2 receiver/apply workflow exists today.

When the durable Pulse client grows into a separate app, that app should get its own CI/shadow lane rather than hiding inside the static blog deploy forever.

## Current Hosted CI Contract

PR #103 adds the package-level checks needed for this proof:

- root `npm run security:audit:static` includes `@blog/pulse-client`
- root `npm run lint` includes `packages/pulse-client/src` and `packages/pulse-client/test`
- root `npm run test:pulse-client` runs package Vitest tests and TypeScript typecheck
- hosted PR smoke includes `e2e/pulse-client.spec.ts` on Chromium and WebKit
- non-PR full regression keeps the whole Playwright suite on hosted runners

That means a Pulse client PR is not review-ready until the hosted `build-and-test` job passes these gates:

1. gitleaks
2. npm install
3. static production dependency audit
4. lint
5. Svelte type check
6. unit tests
7. blog-agent checks
8. pulse-core tests, typecheck, and proto guard
9. pulse-client tests and typecheck
10. static build
11. redirects, frontmatter, and link audits
12. hosted PR browser smoke for `/pulse/client`
13. bundle report
14. Lighthouse report

Local development may run targeted Node/Vitest checks. Browser validation stays hosted.

## Shadow Route Contract

The current shared review route is:

```text
https://jesssullivan-blog-shadow.taila4c78d.ts.net
```

The blog repo publishes the source artifact. The private infra repo owns deploy authority.

Current source-evidence flow:

1. An operator emits `shadow-source-build-v2` with an open same-repo PR number
   and its exact current head SHA.
2. `.github/workflows/shadow-source-build-v2.yml` resolves the exact open PR
   head and builds without publish authority; the default-branch
   `.github/workflows/shadow-source-publish-v2.yml` independently revalidates it
   before any package write.
3. The workflow builds `Dockerfile.shadow` on hosted `ubuntu-latest` only.
4. When `BLOG_SHADOW_SOURCE_PUBLISH_ENABLED=true`, the trusted consumer may
   publish the exact-SHA source image after a last-moment PR/gate recheck.
5. Apply is unavailable. The public workflow has no apply input, App key,
   private sender, or dispatch call.

Draft PRs may produce build-only evidence. There are no automatic preview
builds and no runner override.

## Source Artifact Shape

For exact repository-dispatch source builds, the source image tag is:

```text
shadow-pr-{pr_number}-{sha12}-amd64
```

Example:

```text
ghcr.io/jesssullivan/jesssullivan-github-io-shadow-tailnet:shadow-pr-103-c11eea01b865-amd64
```

This source artifact is not a deploy receipt. A future coordinated private
receiver may mirror and apply it only after exact run correlation exists. The
public repo must not receive cluster credentials, RustFS credentials, or private
GHCR operator credentials.

## Tailnet Smoke

Run these from a tailnet-connected machine after infra applies the preview:

```sh
SHADOW="https://jesssullivan-blog-shadow.taila4c78d.ts.net"

curl -fsSIL "$SHADOW/"
curl -fsSIL "$SHADOW/pulse"
curl -fsSIL "$SHADOW/pulse/lab"
curl -fsSIL "$SHADOW/pulse/client"
curl -fsSL "$SHADOW/data/pulse/public-snapshot.v1.json"
```

The route-level expectation is simple:

- `/` proves the blog shell loaded
- `/pulse` proves the public snapshot projection still renders
- `/pulse/lab` proves the policy QA harness still renders
- `/pulse/client` proves the durable client package adapters still hydrate through the hidden demo route
- `/data/pulse/public-snapshot.v1.json` proves the checked static data artifact is still reachable

The `/pulse/client` route should remain `noindex` and must not become production write authority.

## Ownership Matrix

| Surface | Owns | Must Not Own |
| --- | --- | --- |
| `@blog/pulse-client` | adapter code, package tests, local/offline client state helpers | live broker authority, auth trust, media workers, deploy routing |
| `/pulse/client` | hosted browser smoke target and noindex demo harness | durable production client authority |
| blog CI | package tests, static build, hosted browser smoke, source image build | cluster credentials, RustFS credentials, private operator package credentials |
| blog shadow route | tailnet review of current static artifact and hidden demo routes | separate app permanence, multi-branch tenancy |
| `Jesssullivan/jesssullivan-infra` | private mirror, RustFS-backed apply, route exposure, cluster-facing state | package source code ownership |
| future durable Pulse client app | product client UI/runtime and its own smoke route | static blog rendering or broker source-of-truth semantics |

## Promotion Gate

A Pulse client branch can be treated as ready for client-development review when all of these are true:

- package tests and typecheck pass in hosted CI
- hosted PR browser smoke covers `/pulse/client`
- typed source evidence records the exact PR head SHA
- tailnet deployment/smoke remains a separate blocked requirement until the coordinated private v2 receiver exists
- no private credentials or object-storage state are introduced into the static blog repo
- no local Playwright was run

## Follow-On Split

Once the durable client becomes a real app instead of a package plus noindex blog harness, create a separate deploy lane with:

- its own image name
- its own tailnet route
- app-specific hosted browser smoke
- infra-owned private mirror/apply path
- broker/media/auth dependencies represented as service contracts, not static form fields

That future lane should reuse the discipline here, not the exact blog route.
