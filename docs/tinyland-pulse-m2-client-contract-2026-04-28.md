# Tinyland Pulse M2 Client Contract

Date: 2026-04-28

Status: active planning surface for post-M1 client development. As of 2026-05-03, `TIN-926` and `TIN-930` have landed on `main` with hosted CI, Pages, full browser regression, and tailnet shadow smoke green. The remaining current PR queue is media lifecycle, broker mutation, auth/device authority, and the separate real federation lane.

Related:

- [Tinyland Pulse Lifecycle Architecture Spec](./tinyland-pulse-lifecycle-architecture-spec-2026-04-27.md)
- [Tinyland Pulse Public-Data Policy](./tinyland-pulse-public-data-policy-2026-04-27.md)
- [Tinyland Pulse Client Home Decision](./tinyland-pulse-client-home-decision-2026-05-03.md)
- [Tinyland Pulse Durable Client CI and Shadow Proof](./tinyland-pulse-durable-client-ci-shadow-2026-05-03.md)
- [PR #96 - TIN-918 Pulse client draft/outbox demo](https://github.com/Jesssullivan/jesssullivan.github.io/pull/96)
- [PR #97 - TIN-920 Pulse client-home decision](https://github.com/Jesssullivan/jesssullivan.github.io/pull/97)
- [PR #98 - TIN-919 Pulse client local persistence/retry](https://github.com/Jesssullivan/jesssullivan.github.io/pull/98)
- [PR #100 - TIN-921 Pulse auth/device identity stubs](https://github.com/Jesssullivan/jesssullivan.github.io/pull/100)
- [PR #101 - TIN-922 Pulse media intent stubs](https://github.com/Jesssullivan/jesssullivan.github.io/pull/101)
- [PR #102 - TIN-923 durable Pulse client home decision](https://github.com/Jesssullivan/jesssullivan.github.io/pull/102)
- [PR #103 - TIN-926 durable Pulse client package scaffold](https://github.com/Jesssullivan/jesssullivan.github.io/pull/103)
- [PR #108 - TIN-930 durable client CI/shadow proof](https://github.com/Jesssullivan/jesssullivan.github.io/pull/108)
- [PR #106 - TIN-929 media object lifecycle](https://github.com/Jesssullivan/jesssullivan.github.io/pull/106)
- [PR #105 - TIN-927 broker mutation/idempotency contract](https://github.com/Jesssullivan/jesssullivan.github.io/pull/105)
- [PR #104 - TIN-928 auth/device authority boundary](https://github.com/Jesssullivan/jesssullivan.github.io/pull/104)

## Current Truth

M1 proves the lifecycle with `@blog/pulse-core`, a checked public snapshot, `/pulse`, and a hidden `/pulse/lab` composer. M2 has a richer hidden `/pulse/client` proof, but that proof remains a static-blog review shell, not production write authority.

Landed M2 client slices:

- `TIN-739` defined the Pulse M2 client API, identity, and sync contract.
- `TIN-789` shipped the hidden `/pulse/client` scaffold on `main`.
- `TIN-846` and child issues shipped the AP-shaped demo queue, broker, publisher, policy, hosted CI, shadow image, infra apply, and smoke path.
- `TIN-918` / PR #96 promoted `/pulse/client` into a demoable draft/outbox workflow using `@blog/pulse-core`.
- `TIN-920` / PR #97 allowed one more in-blog implementation slice before reopening the durable-home decision.
- `TIN-919` / PR #98 added versioned local storage, draft/outbox persistence, and deterministic queued/retry states.
- `TIN-921` / PR #100 added auth/device/session/display identity stubs.
- `TIN-922` / PR #101 added media upload intent stubs, privacy lifecycle states, policy-result rendering, and serialization coverage.
- `TIN-923` / PR #102 decided to split durable Pulse client authority out of the static blog before live broker writes.
- `TIN-926` / PR #103 landed `@blog/pulse-client` as the durable client package scaffold consuming `@blog/pulse-core`.
- `TIN-930` / PR #108 landed the hosted CI and shadow proof contract for the durable client surface.

Latest hosted proof:

- PR #108 merge commit `7fbf21b9a3521a2a20990f1d2516fb5dc2e6f47c`.
- Main CI `25291511738`: success, hosted full regression `936 passed / 6 skipped`.
- Pages `25291511733`: success.
- PR #108 shadow source workflow `25291232597`: success.
- Private infra apply/smoke `25291444193`: success for `/`, `/blog`, `/pulse`, `/pulse/lab`, and `/data/pulse/public-snapshot.v1.json`.
- No local Playwright was run.

Current working proof:

- PR #106 / `TIN-929` is rebased to `553b9b3b7bf223edd7e4cb1fbcca67f9cc485154`.
- PR #106 CI `25291736987`: success, hosted PR smoke `113 passed / 3 skipped`.
- PR #106 Greptile review: success.
- PR #106 ready-state shadow preview `25292044751` resolved tag `shadow-pr-106-codex-tin-929-pulse-media-lifecycle-553b9b3b7bf2-amd64`, then queued on `tinyland-dind`.
- `TIN-946` tracks the `tinyland-dind` queue stall separately from Pulse media lifecycle content.

## AP-Shaped Demo Publisher

TIN-846 adds a deliberately narrow ActivityPub-shaped demo lane inside `@blog/pulse-core` and `/pulse/lab`.

This lane is allowed to:

- turn already-public `PublicPulseItem` values into ActivityStreams `Create` activities
- expose a deterministic demo publisher queue with `published` and `blocked` entries
- show an `OrderedCollection` outbox preview for branch and shadow review
- keep policy-denied events visible as blocked queue entries without placing them in the outbox

This lane is not allowed to:

- perform network delivery
- own actor lifecycle or inbox semantics
- sign HTTP requests
- persist retries, followers, moderation state, or delivery logs
- weaken the M1 public-data policy

The purpose is client/demo development velocity: reviewers can see how a Pulse note or coarse bird sighting would look after brokering and publishing, while exact-location/private/unsupported data still stops before any public AP-shaped surface.

## Client Surface Decision

TIN-923 decides that durable Pulse client authority should split out of the static blog before live broker writes.

The blog repo may keep `/pulse/client` as a noindex QA and demo route. It should not keep accumulating production authority. That route has done its job: it proved draft intent, local persistence, retry states, identity stubs, media lifecycle intent, broker preview, policy preview, and AP-shaped demo output against `@blog/pulse-core`.

The durable split keeps the static blog honest:

- `/pulse` renders public snapshots.
- `/pulse/lab` remains the noindex QA harness and policy experiment surface.
- `/pulse/client` remains the noindex M2 client scaffold for review and smoke coverage.
- `@blog/pulse-core` owns shared schema, FSM, policy, in-memory broker, and demo publisher contracts.
- `@blog/pulse-client` owns adapter-shaped client state helpers and package-level tests until the product client app needs its own runtime home.
- A future Pulse client app owns product client UI, local/offline sync, and client runtime concerns.
- A future broker service owns private append-only event truth, live mutation APIs, idempotency enforcement, durable retries, and projection jobs.
- Future media workers own object storage, EXIF stripping, derivatives, and public media eligibility.
- Real ActivityPub federation stays in the TIN-731 planning lane.

The static blog must not become the durable write authority, broker persistence owner, auth authority, upload lifecycle owner, or real federation worker.

## M2 Contract Scope

M2 has now proven these contracts far enough to justify the split:

- Client API boundary for submitting draft events to the broker.
- Stubbed auth and device identity semantics.
- Local draft persistence and idempotency keys.
- Outbox/sync/retry behavior for intermittent clients.
- Policy preview response shape for "will this project publicly?" UX.
- AP-shaped demo queue/outbox preview for safe branch demos.
- Media upload intent, private object storage, EXIF stripping, and derivative generation stubs.
- Snapshot/read model consumption for public timeline rendering.
- Compatibility boundary between `@blog/pulse-core` schemas and any generated proto client.

The next docs narrow those into service boundaries without starting live writes from the static blog.

## Immediate Queue

Current order:

1. Finish `TIN-929` / PR #106 media lifecycle. It is rebased and CI-green; full shadow proof is blocked by `TIN-946`.
2. Rebase/check `TIN-927` / PR #105 broker mutation/idempotency contract.
3. Rebase/check `TIN-928` / PR #104 auth/device authority boundary.
4. Keep `TIN-731` separate for real ActivityPub federation after durable client and broker boundaries are clearer.

Do not start live broker writes, durable media storage, trusted auth/device authority, or real ActivityPub delivery from the static blog route.

## QA Gates

The current QA baseline for client iteration is:

- `npm run test:pulse-core`
- `npm run test:pulse-client`
- targeted Vitest for `src/lib/pulse/client` and Pulse component rendering while the in-blog proof remains on `main`
- `npm run check`
- `npm run lint`
- PR CI smoke on the hosted GitHub Actions browser lane
- post-merge full browser regression on `main`
- shadow-route smoke before treating a branch as review-ready
- production curl smoke after merge when Pages deploys

Do not run Playwright locally. Browser validation for Pulse client work should stay on hosted CI and the tailnet shadow route so local development does not depend on local browser automation state.

## Audit Boundary

Blog-agent dependency audit findings are tracked as repo hardening, but they should not be treated as static Pulse route blockers unless the affected code ships in the static blog artifact or client runtime.

CI enforces that split explicitly:

- `npm run security:audit:static` blocks static blog/Pulse release confidence. It audits the root static app with workspaces disabled and audits `@blog/pulse-core` as the shared client/runtime contract package.
- `npm run security:audit:blog-agent` audits `@blog/agent` separately as a report-only CI step until the Agentuity/runtime advisory graph has an owned remediation path.

Report-only shadow runtime CVE cleanup is tracked in `TIN-942`.

## Explicit Non-Scope

ActivityPub federation remains separate from M2 client readiness. `TIN-731` owns actor lifecycle, inbox/outbox, signatures, delivery, retries, moderation, and compatibility testing.
