# Tinyland Pulse M2 Client Contract

Date: 2026-04-28

Status: active planning surface for post-M1 client development. TIN-920 and TIN-919 are landed; `/pulse/client` now has adapter-shaped local draft/outbox persistence and retry-state semantics.

Related:

- [Tinyland Pulse Lifecycle Architecture Spec](./tinyland-pulse-lifecycle-architecture-spec-2026-04-27.md)
- [Tinyland Pulse Public-Data Policy](./tinyland-pulse-public-data-policy-2026-04-27.md)

## Current Truth

M1 proves the lifecycle with `@blog/pulse-core`, a checked public snapshot, `/pulse`, and a hidden `/pulse/lab` composer. M2 now also has a hidden `/pulse/client` scaffold with local draft persistence, stable idempotency keys, local outbox storage, and deterministic retry-state UX.

The lab composer remains useful as a QA harness and design probe, but it is not a production client:

- no durable drafts
- no auth or device identity beyond fixture strings
- no mutation API
- no upload lifecycle
- no offline outbox or retry model
- no broker persistence
- no real ActivityPub federation

The `/pulse/client` scaffold is one step further than the lab route. It owns local browser persistence for demo/client development, but it still does not own production write authority, broker persistence, auth, upload lifecycle, or real federation.

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

Real client development should happen as a separate client surface that consumes `@blog/pulse-core`. The in-blog `/pulse/lab` route should remain a noindex QA harness, policy preview, and smoke-test target.

That split keeps the static blog honest: it renders public projections and provides a reviewable demo, but it does not become the durable write client or broker authority by accident.

TIN-789 starts this as a hidden `/pulse/client` scaffold inside the blog repo rather than a separate package. That is a temporary client-development surface, not the final app home. It exists to prove the local draft, idempotency-key, broker-submit, policy-preview, and AP-shaped outbox flow against `@blog/pulse-core` before deciding whether the durable client becomes its own app/package.

TIN-920 decides that TIN-919 should stay inside the blog repo's hidden `/pulse/client` surface for one more implementation slice. That is a scoped M2 development choice, not a production authority choice.

TIN-919 landed on 2026-05-02 in PR #98 / commit `60c5e71fda2024f3e57c6722d1f04b4286eeda5f`. It added the local storage adapter, draft and outbox serialization tests, retry-state restoration, and a small UI restore path in `/pulse/client`.

The selected home for TIN-919 is:

- `/pulse/client` remains the review shell for local draft persistence, idempotency, broker-submit preview, and retry-state UX.
- Reusable non-UI logic should live behind `src/lib/pulse/client` boundaries, or move into `@blog/pulse-core` only when it is genuinely shared with other clients.
- Browser persistence should sit behind a small adapter boundary so it can move into a standalone app/package later without rewriting the draft/outbox contract.
- The static blog must not become the durable write authority, broker persistence owner, auth authority, upload lifecycle owner, or real federation worker.

The rejected alternative for this slice is splitting immediately into a separate app/package. That split is still likely, but doing it before local persistence and retry semantics are proven would add repo, package, CI, shadow, and deployment surfaces before the client contract has enough shape to justify the extra ownership boundary.

Reopen the split decision before auth/device identity, live broker mutation APIs, media upload lifecycle, or real ActivityPub delivery work.

The division is:

- `/pulse` renders the public snapshot.
- `/pulse/lab` remains the noindex QA harness and policy experiment surface.
- `/pulse/client` is the noindex M2 client scaffold for draft/outbox UX.
- Real ActivityPub federation stays in the TIN-731 planning lane.

## M2 Contract Scope

M2 should define these contracts before product-style client work accelerates:

- Client API boundary for submitting draft events to the broker.
- Auth and device identity semantics.
- Local draft persistence and idempotency keys. Landed for local browser storage in TIN-919; durable broker/client authority is still non-scope.
- Outbox/sync/retry behavior for intermittent clients. Landed for local deterministic retry-state UX in TIN-919; network sync and broker persistence are still future work.
- Policy preview response shape for "will this project publicly?" UX.
- AP-shaped demo queue/outbox preview for safe branch demos.
- Media upload intent, private object storage, EXIF stripping, and derivative generation stubs.
- Snapshot/read model consumption for public timeline rendering.
- Compatibility boundary between `@blog/pulse-core` schemas and any generated proto client.

## Next M2 Queue

The next functional slices should stay inside the same temporary `/pulse/client` shell unless the split decision is reopened:

- TIN-921: auth and device identity stubs that model session/device provenance without becoming real auth authority.
- TIN-922: media upload intent and privacy lifecycle stubs for private object storage, EXIF stripping, derivatives, and public projection eligibility.
- TIN-923: renewed app/package split decision before live broker mutation APIs, durable auth/media authority, or real ActivityPub delivery.

## QA Gates

The current QA baseline for client iteration is:

- `npm run test:pulse-core`
- `npx vitest run src/lib/components/pulse/PulseCards.test.ts src/lib/pulse/lab/compose.test.ts src/lib/pulse/client/drafts.test.ts src/lib/pulse/client/storage.test.ts`
- `npm run lint`
- `npm run check`
- PR CI smoke on the hosted GitHub Actions browser lane
- post-merge full browser regression on `main`
- shadow-route smoke before treating a branch as review-ready
- production curl smoke for `/pulse`, `/pulse/lab`, `/pulse/client`, and the public snapshot after merge

Do not run Playwright locally. Browser validation for Pulse client work should stay on hosted CI and the tailnet shadow route so local development does not depend on local browser automation state.

## Audit Boundary

`npm audit --omit=dev` currently reports production advisories concentrated in `packages/blog-agent` and its Agentuity/runtime transitive graph, including `@agentuity/runtime`, OpenTelemetry host metrics, `protobufjs`, `drizzle-orm`, `kysely`, `hono`, `effect`, `uuid`, `yaml`, and `defu`.

Those findings should be tracked as a repo hardening surface, but they should not be treated as a static Pulse route blocker unless the affected code is shipped in the static blog artifact or client runtime.

CI now enforces that split explicitly:

- `npm run security:audit:static` blocks static blog/Pulse release confidence. It audits the root static app with workspaces disabled and audits `@blog/pulse-core` as the shared client/runtime contract package.
- `npm run security:audit:blog-agent` audits `@blog/agent` separately as a report-only CI step until the Agentuity/runtime advisory graph has an owned remediation path.

## Explicit Non-Scope

ActivityPub federation remains separate from M2 client readiness. The existing ActivityPub planning item should own actor lifecycle, inbox/outbox, signatures, delivery, retries, moderation, and compatibility testing.
