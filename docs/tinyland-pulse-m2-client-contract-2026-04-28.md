# Tinyland Pulse M2 Client Contract

Date: 2026-04-28

Status: active planning surface for post-M1 client development. As of 2026-05-03, the temporary in-blog proof has completed local persistence, auth/device stubs, and media intent stubs. TIN-923 records the next durable-home decision: split production client authority before live broker writes.

Related:

- [Tinyland Pulse Lifecycle Architecture Spec](./tinyland-pulse-lifecycle-architecture-spec-2026-04-27.md)
- [Tinyland Pulse Public-Data Policy](./tinyland-pulse-public-data-policy-2026-04-27.md)
- [Tinyland Pulse Client Home Decision](./tinyland-pulse-client-home-decision-2026-05-03.md)
- [Tinyland Pulse Auth and Device Authority](./tinyland-pulse-auth-device-authority-2026-05-03.md)
- [PR #96 - TIN-918 Pulse client draft/outbox demo](https://github.com/Jesssullivan/jesssullivan.github.io/pull/96)
- [PR #97 - TIN-920 Pulse client-home decision](https://github.com/Jesssullivan/jesssullivan.github.io/pull/97)
- [PR #98 - TIN-919 Pulse client local persistence/retry](https://github.com/Jesssullivan/jesssullivan.github.io/pull/98)
- [PR #100 - TIN-921 Pulse auth/device identity stubs](https://github.com/Jesssullivan/jesssullivan.github.io/pull/100)
- [PR #101 - TIN-922 Pulse media intent stubs](https://github.com/Jesssullivan/jesssullivan.github.io/pull/101)

## Current Truth

M1 proves the lifecycle with `@blog/pulse-core`, a checked public snapshot, `/pulse`, and a hidden `/pulse/lab` composer. M2 now has a richer hidden `/pulse/client` proof, but that proof is still a static-blog review shell, not production write authority.

Landed M2 client slices:

- `TIN-739` defined the Pulse M2 client API, identity, and sync contract.
- `TIN-789` shipped the hidden `/pulse/client` scaffold on `main`.
- `TIN-846` and child issues shipped the AP-shaped demo queue, broker, publisher, policy, hosted CI, shadow image, infra apply, and smoke path.
- `TIN-918` / PR #96 promoted `/pulse/client` into a demoable draft/outbox workflow using `@blog/pulse-core`.
- `TIN-920` / PR #97 allowed one more in-blog implementation slice before reopening the durable-home decision.
- `TIN-919` / PR #98 added versioned local storage, draft/outbox persistence, and deterministic queued/retry states.
- `TIN-921` / PR #100 added auth/device/session/display identity stubs.
- `TIN-922` / PR #101 added media upload intent stubs, privacy lifecycle states, policy-result rendering, and serialization coverage.

Latest hosted proof for TIN-922:

- PR CI `25267906906`: success.
- Shadow source image `25267906904`: success.
- Private infra apply/smoke `25268044444`: success.
- Pages `25268096111`: success.
- Post-merge main CI `25268096107`: success, including hosted E2E full regression and Lighthouse.
- Hosted E2E full regression reported 936 passed, 6 skipped.
- No local Playwright was run.

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
- A future Pulse client app/package owns product client UI, local/offline sync, and client runtime concerns.
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

## Immediate Queue

TIN-923 created the split-path implementation queue:

- `TIN-926` - scaffold durable Pulse client app/package consuming `@blog/pulse-core`.
- `TIN-927` - define live Pulse broker mutation API and idempotency contract.
- `TIN-928` - define Pulse auth and device identity authority boundary. The rule is now explicit: client-submitted identity fields are claims or hints, while the broker edge must resolve trusted actor, device, session, and audit authority before accepting live writes.
- `TIN-929` - define Pulse media object-storage lifecycle and worker boundaries.
- `TIN-930` - add hosted CI and shadow route for the durable Pulse client surface.
- `TIN-731` - design real ActivityPub federation contract for Pulse after static projection MVP.

The order should be decision first, client scaffold second, broker mutation boundary third. Auth/media authority should not be treated as form fields, and ActivityPub delivery should not ride along with the first live-write client slice.

## QA Gates

The current QA baseline for client iteration is:

- `npm run test:pulse-core`
- targeted Vitest for `src/lib/pulse/client` and Pulse component rendering
- `npm run check`
- `npm run lint`
- PR CI smoke on the hosted GitHub Actions browser lane
- post-merge full browser regression on `main`
- shadow-route smoke before treating a branch as review-ready
- production curl smoke after merge when Pages deploys

Do not run Playwright locally. Browser validation for Pulse client work should stay on hosted CI and the tailnet shadow route so local development does not depend on local browser automation state.

## Audit Boundary

`npm audit --omit=dev` previously reported production advisories concentrated in `packages/blog-agent` and its Agentuity/runtime transitive graph, including `@agentuity/runtime`, OpenTelemetry host metrics, `protobufjs`, `drizzle-orm`, `kysely`, `hono`, `effect`, `uuid`, `yaml`, and `defu`.

Those findings are tracked as repo hardening, but they should not be treated as static Pulse route blockers unless the affected code ships in the static blog artifact or client runtime.

CI enforces that split explicitly:

- `npm run security:audit:static` blocks static blog/Pulse release confidence. It audits the root static app with workspaces disabled and audits `@blog/pulse-core` as the shared client/runtime contract package.
- `npm run security:audit:blog-agent` audits `@blog/agent` separately as a report-only CI step until the Agentuity/runtime advisory graph has an owned remediation path.

## Explicit Non-Scope

ActivityPub federation remains separate from M2 client readiness. TIN-731 owns actor lifecycle, inbox/outbox, signatures, delivery, retries, moderation, and compatibility testing.
