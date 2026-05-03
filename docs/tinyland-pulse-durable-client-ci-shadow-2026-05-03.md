# Tinyland Pulse Durable Client CI And Shadow Proof

Date: 2026-05-03

Linear: `TIN-930` - Add hosted CI and shadow route for durable Pulse client surface.

Status: stacked planning/QA contract on top of `TIN-926` / PR #103. This document describes the proof path for the durable client package while `/pulse/client` remains the noindex blog-hosted review surface.

Related:

- [Tinyland Pulse Client Home Decision](./tinyland-pulse-client-home-decision-2026-05-03.md)
- [Tinyland Pulse M2 Client Contract](./tinyland-pulse-m2-client-contract-2026-04-28.md)
- [Blog Shadow Preview](./blog-shadow-preview.md)
- `TIN-926` - scaffold durable Pulse client app/package consuming `@blog/pulse-core`

## Decision

Use the existing blog CI and tailnet shadow lane to prove the split client package until the durable Pulse client becomes a separately deployed app.

For the current M2 slice:

- `@blog/pulse-client` owns reusable client-side draft, outbox, identity, media-intent, and storage adapters.
- `/pulse/client` remains the noindex browser smoke surface for those adapters.
- GitHub Actions owns browser automation. Do not run Playwright locally.
- The shared blog shadow route is the tailnet review route for branch demos.
- `Jesssullivan/jesssullivan-infra` remains the owner of private mirroring, RustFS-backed OpenTofu apply, cluster credentials, and tailnet route exposure.

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

Automatic flow:

1. A same-repo PR against `main` is marked ready for review or updated while ready.
2. `.github/workflows/shadow-preview.yml` resolves the PR branch and SHA.
3. The workflow builds `Dockerfile.shadow` on `tinyland-dind`.
4. The workflow pushes the source image to `ghcr.io/jesssullivan/jesssullivan-github-io-shadow-tailnet`.
5. The workflow dispatches `Jesssullivan/jesssullivan-infra`.
6. Infra mirrors the artifact into the private operator package and applies the RustFS-backed stack.

Draft PRs intentionally do not deploy automatically. A draft PR should show `Resolve preview target` passing and `Build source image` skipped. To publish a draft branch anyway, use the workflow's manual dispatch input with the branch or SHA and keep the result tied to the PR review note.

Only one branch owns the shared shadow route at a time. The newest active shadow preview wins.

## Source Artifact Shape

For PR-triggered deploys, the source image tag should look like:

```text
shadow-pr-{pr_number}-{branch_slug}-{sha12}-amd64
```

Example:

```text
ghcr.io/jesssullivan/jesssullivan-github-io-shadow-tailnet:shadow-pr-103-codex-tin-926-durable-pulse-client-c11eea01b865-amd64
```

This source artifact is not the final private pull target. It is the public repo's CI-produced input that infra mirrors and applies. The public repo must not receive cluster credentials, RustFS credentials, or private GHCR operator credentials.

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
- shadow preview has deployed the branch or a manual dispatch has recorded the exact SHA
- tailnet smoke passes for `/`, `/pulse`, `/pulse/lab`, `/pulse/client`, and the public snapshot
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
