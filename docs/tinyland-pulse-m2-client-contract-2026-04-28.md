# Tinyland Pulse M2 Client Contract

Date: 2026-04-28

Status: planning surface for post-M1 client development.

Related:

- [Tinyland Pulse Lifecycle Architecture Spec](./tinyland-pulse-lifecycle-architecture-spec-2026-04-27.md)
- [Tinyland Pulse Public-Data Policy](./tinyland-pulse-public-data-policy-2026-04-27.md)

## Current Truth

M1 proves the lifecycle with `@blog/pulse-core`, a checked public snapshot, `/pulse`, and a hidden `/pulse/lab` composer. The lab composer is useful as a QA harness and design probe, but it is not a production client:

- no durable drafts
- no auth or device identity beyond fixture strings
- no mutation API
- no upload lifecycle
- no offline outbox or retry model
- no broker persistence
- no real ActivityPub federation

## Client Surface Decision

Real client development should happen as a separate client surface that consumes `@blog/pulse-core`. The in-blog `/pulse/lab` route should remain a noindex QA harness, policy preview, and smoke-test target.

That split keeps the static blog honest: it renders public projections and provides a reviewable demo, but it does not become the durable write client or broker authority by accident.

## M2 Contract Scope

M2 should define these contracts before product-style client work accelerates:

- Client API boundary for submitting draft events to the broker.
- Auth and device identity semantics.
- Local draft persistence and idempotency keys.
- Outbox/sync/retry behavior for intermittent clients.
- Policy preview response shape for "will this project publicly?" UX.
- Media upload intent, private object storage, EXIF stripping, and derivative generation stubs.
- Snapshot/read model consumption for public timeline rendering.
- Compatibility boundary between `@blog/pulse-core` schemas and any generated proto client.

## QA Gates

The current QA baseline for client iteration is:

- `npm run test:pulse-core`
- `npx vitest run src/lib/components/pulse/PulseCards.test.ts src/lib/pulse/lab/compose.test.ts`
- `npm run check`
- `npx playwright test e2e/pulse-lab.spec.ts --project=chromium`
- shadow-route smoke before treating a branch as review-ready

Local Playwright uses Vite dev server for fast client iteration. CI keeps the production build-and-serve path.

## Audit Boundary

`npm audit --omit=dev` currently reports production advisories concentrated in `packages/blog-agent` and its Agentuity/runtime transitive graph, including `@agentuity/runtime`, OpenTelemetry host metrics, `protobufjs`, `drizzle-orm`, `kysely`, `hono`, `effect`, `uuid`, `yaml`, and `defu`.

Those findings should be tracked as a repo hardening surface, but they should not be treated as a static Pulse route blocker unless the affected code is shipped in the static blog artifact or client runtime.

## Explicit Non-Scope

ActivityPub federation remains separate from M2 client readiness. The existing ActivityPub planning item should own actor lifecycle, inbox/outbox, signatures, delivery, retries, moderation, and compatibility testing.
