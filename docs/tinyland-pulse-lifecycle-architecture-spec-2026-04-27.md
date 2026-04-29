# Tinyland Pulse Lifecycle Architecture Spec

Date: 2026-04-27

Linear project: [Tinyland Pulse Lifecycle MVP](https://linear.app/tinyland/project/tinyland-pulse-lifecycle-mvp-3383aec3a023)

Milestone: M1: Mocked Lifecycle + Static Projection Contract

Delivery branch: `jess/pulse-core-foundation`. Status: complete; merged through PR #77 and proven by the M1/M1.5 shadow and production smoke passes.

Companion: [Tinyland Pulse Public-Data Policy — 2026-04-27](./tinyland-pulse-public-data-policy-2026-04-27.md). The policy doc is the operator-facing rule set; this spec is the architectural shape.

## Delivery Status (finalized 2026-04-29)

The spec was written before implementation. A handful of decisions changed during build. The spec has been updated to match shipped reality; the deltas are recorded inline below where they matter.

- ✅ Lifecycle, FSM, and authority model: shipped in `packages/pulse-core/src/fsm/`.
- ✅ Event contract: shipped in `packages/pulse-core/proto/tinyland/pulse/v1/pulse.proto` and Zod schemas in `packages/pulse-core/src/schema/`.
- ✅ Broker mock: shipped in `packages/pulse-core/src/broker/`.
- ✅ Public-data policy: shipped in `packages/pulse-core/src/policy/` and codified in the policy doc.
- ✅ Static blog contract: shipped at `static/data/pulse/public-snapshot.v1.json` and consumed by `src/routes/pulse/`.
- ✅ Lab composer: shipped at `/pulse/lab` (not in nav, `noindex`).
- ⚠ Effect Schema is **not** used in M1. Zod is the runtime validator instead. Reason recorded below in "Event Contract".
- ⚠ Manifest is embedded in the snapshot file, not a separate `*.manifest.json`. Reason recorded below in "Static Blog Contract".
- ⚠ ProjectionQueue / ProjectionWriter are not separate services in M1; they collapse into `BrokerApi.deriveSnapshot` and the pure `projectAcceptedEvents` function. Service-layer split is deferred until the broker becomes a real service.
- ✅ Component-level Svelte tests: added in the 2026-04-28 QA follow-up for `PulseNoteCard`, `PulseBirdCard`, and lab policy result rendering (`src/lib/components/pulse/PulseCards.test.ts`).

## Purpose

Tinyland Pulse is the planned personal activity stream behind notes, bird sightings, photos, git summaries, listening activity, and similar small life/work events. The first implementation slice should prove the lifecycle without pretending the final federation, mobile app, or media system already exists.

The core rule is simple: the tinyland broker owns the source of truth. The static blog and ActivityPub surfaces are projections.

## M1 Goals

- Define a typed event contract that can be shared by a future client app, broker, projection worker, and static blog fixture.
- Build a mocked mobile-first composer for notes and bird sightings.
- Model broker ingest, idempotency, enrichment, and projection with deterministic tests.
- Render `/pulse` in `jesssullivan.github.io` from a versioned public snapshot fixture.
- Keep ActivityPub/fedi explicitly out of the source-of-truth path for this milestone.
- Prevent generated local git, sensor, listening, photo metadata, or location data from becoming public without an explicit policy gate.

## Non-Goals

- Full ActivityPub federation.
- Live browser access to NATS, JetStream, or another message bus.
- Production photo upload and processing.
- A production native/mobile app.
- Public exposure of local git summaries.
- Runtime dependency from the static blog to a live tinyland broker.

## System Shape

```text
client/demo composer
  -> broker API boundary
  -> append-only event store
  -> queue/workflow boundary
  -> projection worker
  -> public snapshot + manifest
  -> static blog /pulse

optional later projections:
  -> ActivityStreams outbox mirror
  -> feeds/search/indexes
  -> real ActivityPub federation
```

M1 can run with an in-memory broker mock and checked fixtures. The design should make the eventual production runtime swap obvious, not required.

## Authority Model

The canonical private record is a typed append-only event plus lifecycle metadata.

The public record is a derived `PublicPulseSnapshot`. It is not editable by hand except as an emergency fixture override. Public snapshots must be rebuildable from accepted events plus policy.

ActivityPub objects are derived from public snapshots or directly from accepted public events. They are not the internal event schema.

## Lifecycle

An event moves through these states:

1. `draft` - local client state, not accepted by the broker.
2. `accepted` - validated, idempotently stored, and assigned a broker event ID.
3. `queued` - pending enrichment, media processing, or projection.
4. `enriched` - optional derived fields were added without replacing the original payload.
5. `public_projected` - included in a public snapshot.
6. `hidden` - accepted but not public.
7. `updated` - superseded by a later event revision.
8. `deleted` - removed from public projection.
9. `tombstoned` - public deletion marker emitted where protocols require it.
10. `failed` - rejected or failed in a retry/DLQ-shaped lane.

Every state transition should be observable in tests. For M1, the broker mock can store transitions in memory or fixture JSON.

## Event Contract

Use protobuf as the language-neutral IDL and ProtoJSON as the public/static JSON encoding. M1 uses **Zod** as the TypeScript runtime validator for ingest, fixture loading, and projection checks; Effect Schema was the original spec choice and remains a viable adapter once the broker becomes a real service. Both ride on the same proto contract.

Reason for the M1 deviation: the existing workspace already uses Zod (`@blog/agent`), so reusing it keeps install footprint small and aligns with the pre-existing test infrastructure. All M1 invariants are expressible cleanly in Zod plus a single `superRefine` for the discriminated-union cross-field rule. Effect's `Layer`/`Runtime` machinery adds value once the broker is multi-process and async; the M1 broker is a pure synchronous function in browser and node. Adding Effect Schema later does not require changing the proto IDL.

Hand-authored TypeScript schemas mirror the proto messages; `@bufbuild/protoc-gen-es` codegen is deferred until a non-blog consumer (a real broker or client app) needs generated wire-format code.

The protobuf contract should start small:

```proto
syntax = "proto3";

package tinyland.pulse.v1;

import "google/protobuf/timestamp.proto";

message PulseEvent {
  string id = 1;
  string actor = 2;
  google.protobuf.Timestamp occurred_at = 3;
  Visibility visibility = 4;
  Source source = 5;
  repeated string tags = 6;
  repeated MediaAttachment media = 7;
  uint32 revision = 8;

  oneof payload {
    NotePayload note = 20;
    BirdSightingPayload bird_sighting = 21;
    PhotoPayload photo = 22;
    GitSummaryPayload git_summary = 23;
    ListeningPayload listening = 24;
  }
}

enum Visibility {
  VISIBILITY_UNSPECIFIED = 0;
  VISIBILITY_PRIVATE = 1;
  VISIBILITY_UNLISTED = 2;
  VISIBILITY_PUBLIC = 3;
}

message Source {
  string client = 1;
  string device_id = 2;
  string idempotency_key = 3;
}

message NotePayload {
  string text = 1;
}

message BirdSightingPayload {
  string common_name = 1;
  string scientific_name = 2;
  uint32 count = 3;
  Place place = 4;
  string observation_id = 5;
}

message Place {
  string label = 1;
  double latitude = 2;
  double longitude = 3;
  LocationPrecision precision = 4;
}

enum LocationPrecision {
  LOCATION_PRECISION_UNSPECIFIED = 0;
  LOCATION_PRECISION_HIDDEN = 1;
  LOCATION_PRECISION_REGION = 2;
  LOCATION_PRECISION_EXACT = 3;
}

message MediaAttachment {
  string id = 1;
  string mime_type = 2;
  string alt_text = 3;
  string private_object_key = 4;
  string public_url = 5;
}

message PhotoPayload {
  string caption = 1;
}

message GitSummaryPayload {
  string repository = 1;
  string summary = 2;
}

message ListeningPayload {
  string title = 1;
  string artist = 2;
  string album = 3;
  string external_url = 4;
}
```

Public snapshots should use a narrower schema:

```proto
message PublicPulseSnapshot {
  string schema_version = 1;
  string generated_at = 2;
  repeated PublicPulseItem items = 3;
  PublicPulseManifest manifest = 4;
}

message PublicPulseItem {
  string id = 1;
  string kind = 2;
  string occurred_at = 3;
  string summary = 4;
  string content = 5;
  repeated string tags = 6;
  PublicBirdSighting bird_sighting = 20;
}
```

Schema evolution rules:

- Never reuse protobuf field numbers.
- Reserve removed field numbers and names.
- Keep `oneof payload` fields stable once public fixtures exist.
- Treat unknown public snapshot fields as validation failures until there is an explicit compatibility policy.
- Prefer additive optional fields over shape changes.

## Effect Design

Effect should own business/runtime boundaries, not Svelte UI state.

M1 layers (shipped):

- `Clock` — pluggable. `systemClock`, `fixedClock`, `tickingClock`. Fixture and production swap.
- `IdGenerator` — pluggable. `seededIdGenerator` for deterministic tests.
- `PulseEventSchema` — Zod. The runtime validator and the type source.
- `EventStore` — `inMemoryEventStore`. Append-only, indexed by id and idempotency key, FSM-aware `transition` method.
- `PolicyEngine` — pure `applyPolicyToEvent` in `packages/pulse-core/src/policy/`. Returns `PolicyDecision`.
- `BrokerApi` — `createBroker(...)` returning `ingest`, `markHidden`, `deletePublic`, `tombstone`, `deriveSnapshot`, `getEvent`, `allEvents`.
- Pure `projectAcceptedEvents` — derives `PublicPulseSnapshot` from accepted events plus policy. Stable ordering, sha256 contentHash, deterministic across ingest order.

`ProjectionQueue` and `ProjectionWriter` were originally listed as separate Effect Service Layers. In an in-memory mock that is service-shaped overengineering: there is no async boundary, no retry surface, and no DLQ to model. Both are folded into `BrokerApi.deriveSnapshot` plus the pure projection function. When the broker grows real async runtime (NATS, Cloudflare Queues, Temporal, or similar) those will reappear as their own layers without requiring schema changes.

Production layers can later bind those interfaces to Postgres/SQLite, object storage, NATS, Cloudflare Queues, or a hosted runtime. M1 layers are in-memory and fixture-backed.

Effect should validate:

- payload matches `kind`
- visibility is explicit
- note text is non-empty after trimming
- bird sightings include a common name or scientific name
- exact location is rejected from public snapshots unless explicitly allowed
- private object keys never appear in public snapshots
- generated git/listening/sensor/photo items are blocked in M1 public projection

## Svelte And Runes

Use Svelte 5 runes in UI/demo code:

- `$state` for local form state.
- `$derived` for preview, validation summary, and derived submit readiness.
- `$effect` only for browser side effects such as mock network calls, timers, analytics, or local storage. It must not be used to maintain derived state.

The demo composer should be phone-shaped and hidden from primary nav until launch policy is settled. A route like `/pulse/demo` or `/pulse/lab` is acceptable for M1.

Required demo flows:

- write a short note
- log a bird sighting
- choose visibility
- set occurred-at
- add tags
- choose location precision
- submit into mocked broker lifecycle
- show accepted/projected/failure states

## Static Blog Contract

`jesssullivan.github.io` consumes a single checked-in public snapshot file with the manifest embedded:

```text
static/data/pulse/public-snapshot.v1.json
```

Reason for the embedded-manifest deviation: a separate `*.manifest.json` was the original spec shape, but it doubles the fetch surface, doubles the validation entry points, and makes manifest/snapshot drift possible across two files. With the manifest embedded, the file is one validation target, one hash, one fetch.

The embedded `manifest` field includes:

- `schemaVersion` (must match the snapshot's top-level `schemaVersion`)
- `generatedAt` (must match the snapshot's top-level `generatedAt`)
- `sourceSnapshotId` (broker snapshot reference; deterministic for fixture builds)
- `contentHash` (`sha256:` prefix, computed over canonical-JSON of `items`)
- `itemCount` (must equal `items.length`)
- `policyVersion` (current value: `m1-2026-04-27`)

All five of those equalities are enforced by `PublicPulseSnapshotSchema` and re-checked by `scripts/validate-pulse-snapshot.mts`.

Build behavior:

- `/pulse` remains `prerender = true`.
- `npm run check` or a dedicated validation script fails on invalid snapshot shape.
- `npm run build` must not require the broker to be online.
- A future optional fetch step may refresh the checked snapshot before build, but only behind an explicit operator command or CI input.

This keeps the static site fast and reviewable.

## Runtime Options

M1 should avoid choosing production infrastructure too early. The implementation should keep these routes open:

- Postgres or SQLite as authoritative event store.
- Object storage for media.
- NATS JetStream for worker fanout and replay, not as the only authoritative copy.
- Cloudflare Queues/Workflows for edge/serverless queue and durable-step execution.
- Connect RPC or plain HTTPS JSON for client-to-broker API.
- gRPC/Connect internally if multiple services appear.

Do not expose NATS directly to browsers.

## Security And Public-Data Policy

M1 public projection may include:

- mocked notes
- mocked bird sightings with hidden or coarse location
- deterministic fixture IDs

M1 public projection must block:

- private object keys
- exact location by default
- EXIF-derived metadata
- local repo paths
- private repo names unless explicitly allowlisted
- generated git summaries
- listening history
- sensor readings
- live broker fetches

Photo support requires a separate media lifecycle:

1. upload intent
2. private object write
3. EXIF stripping
4. derivative generation
5. alt text/caption review
6. public projection

## ActivityPub Boundary

M1 may produce an AP-shaped mirror for experiments. It is not real federation.

Real federation requires a separate milestone covering:

- actor document
- WebFinger discovery
- outbox
- inbox
- follower collection
- delivery queue
- signatures
- retry/backpressure
- updates/deletes/tombstones
- moderation/blocking
- compatibility testing against real servers

PR language should say "AP-shaped mirror" until those requirements are implemented.

## Test Plan

Minimum validation (delivered):

- ✅ Unit tests for Zod schema validation — `packages/pulse-core/test/schema.test.ts` (21 tests).
- ✅ Unit tests for idempotent broker ingest — `packages/pulse-core/test/broker.test.ts`.
- ✅ Property tests for projection policy — `packages/pulse-core/test/policy.test.ts` with `fast-check` (5 properties × 200 runs each).
- ✅ Unit tests for public snapshot decoding and manifest invariants — `packages/pulse-core/test/schema.test.ts`.
- ✅ FSM determinism, reachability, and terminal-closure tests — `packages/pulse-core/test/fsm.test.ts`.
- ✅ Proto schema-evolution guard — `packages/pulse-core/scripts/validate-proto-reservations.mts` invoked by `packages/pulse-core/test/proto-reservations.test.ts`.
- ✅ Snapshot validator — `scripts/validate-pulse-snapshot.mts` wired into `npm run check` and `npm run prebuild`.
- ✅ Component-level SSR tests for note cards, bird cards, and lab policy result rows — `src/lib/components/pulse/PulseCards.test.ts`.
- ✅ Hosted GitHub Actions Playwright checks for mobile (390×844) and desktop (1280×800) composer layouts — `e2e/pulse-lab.spec.ts`.
- ✅ Build/check validation proving `/pulse` is static-safe — `prerender = true` preserved; `npm run check` 0 errors across 1179 files.

Deferred:

- ⚠ Full browser-DOM component interaction tests are not present. The current split is SSR component rendering for card/policy output plus hosted CI Playwright lanes for browser interaction. Do not run Playwright locally.

## PR Split

Use these Linear issues as the preferred PR split:

- [TIN-687](https://linear.app/tinyland/issue/TIN-687/write-tinyland-pulse-architecture-spec-and-lifecycle-contract) - architecture spec and lifecycle contract
- [TIN-688](https://linear.app/tinyland/issue/TIN-688/define-protobuf-and-effect-schemas-for-pulse-events-and-snapshots) - protobuf and Effect schemas
- [TIN-690](https://linear.app/tinyland/issue/TIN-690/implement-broker-lifecycle-mock-with-queueprojection-semantics) - broker lifecycle mock
- [TIN-689](https://linear.app/tinyland/issue/TIN-689/build-mocked-mobile-first-pulse-composer-for-notes-and-bird-sightings) - mobile-first composer demo
- [TIN-691](https://linear.app/tinyland/issue/TIN-691/wire-blog-pulse-to-a-versioned-public-snapshot-fixture) - static `/pulse` fixture consumer
- [TIN-692](https://linear.app/tinyland/issue/TIN-692/define-activitypub-and-public-data-policy-gates-for-pulse) - ActivityPub and public-data policy gates

## Review Surface

End-to-end review of M1 happened against the **M1.5 shadow blog** at `https://jesssullivan-blog-shadow.taila4c78d.ts.net`, not against gh-pages. The initially scoped vanity hostname `https://jesssullivan-blog-shadow.tailnet.tinyland.dev` is not the live review surface. Treat that vanity route as broader platform DNS/permaroute/tofu-agent follow-up, not as an M1.5 blocker. The shadow is tailnet-only, deployed via `~/git/jesssullivan-infra` against the on-prem honey RKE2 cluster, and serves the same static `build/` artifact gh-pages would. M1.5 issues are tracked under the same project: TIN-704 through TIN-711.

The shadow path means:

- No gh-pages prod touch during M1 review.
- Pulse routes are reviewable end-to-end including TLS, layout, and snapshot validation.
- Iteration on `/pulse/lab` happens on a private URL where mistakes are not public.

## Done Criteria For M1

- Spec is approved as the planning authority.
- Note and bird-sighting fixtures pass schema validation.
- Mock composer creates valid events and demonstrates lifecycle transitions.
- Mock broker projection derives a public snapshot from accepted events.
- `/pulse` renders from the snapshot fixture without live services.
- Public-data policy blocks all out-of-scope kinds.
- ActivityPub work remains draft/projection-only.
- M1.5 shadow blog has rendered M1 routes cleanly; PRs are reviewable on the tailnet URL.

## References

- Effect docs: https://effect.website/
- Svelte runes: https://svelte.dev/docs/svelte/what-are-runes
- Svelte `$state`: https://svelte.dev/docs/svelte/$state
- Svelte `$derived`: https://svelte.dev/docs/svelte/$derived
- Svelte `$effect`: https://svelte.dev/docs/svelte/$effect
- SvelteKit static adapter: https://svelte.dev/docs/kit/adapter-static
- Protocol Buffers proto3 spec: https://protobuf.dev/reference/protobuf/proto3-spec/
- ProtoJSON format: https://protobuf.dev/programming-guides/json/
- NATS JetStream docs: https://docs.nats.io/nats-concepts/jetstream
