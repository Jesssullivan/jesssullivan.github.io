# Tinyland Pulse Broker Mutation API

Date: 2026-05-03

Linear: `TIN-927` - Define live Pulse broker mutation API and idempotency contract.

Status: planning authority for the first live Pulse write boundary. This document translates the current `@blog/pulse-core` in-memory broker mock into a durable broker service contract without adding ActivityPub delivery.

Related:

- [Tinyland Pulse Lifecycle Architecture Spec](./tinyland-pulse-lifecycle-architecture-spec-2026-04-27.md)
- [Tinyland Pulse M2 Client Contract](./tinyland-pulse-m2-client-contract-2026-04-28.md)
- [Tinyland Pulse Client Home Decision](./tinyland-pulse-client-home-decision-2026-05-03.md)

## Decision

The live broker mutation boundary should preserve the current `IngestInput` and `IngestOutcome` semantics:

- clients submit event intent without a broker event id
- the broker validates the payload and assigns the event id
- the broker stores accepted events append-only
- the broker treats repeated idempotency keys as duplicates, not new events
- public snapshots remain derived projections, never the source of truth

The first live API can be plain HTTPS JSON. Connect RPC or gRPC may wrap the same contract later, but the semantic boundary should not change.

## Current Mock Mapping

| Mock concept | Live broker contract |
| --- | --- |
| `IngestInput` | `POST /v1/pulse/events` request body |
| `IngestOutcome.status === "accepted"` | `201 Created` with assigned event id and lifecycle state |
| `IngestOutcome.status === "duplicate"` | `200 OK` with original event id and duplicate status |
| `IngestOutcome.status === "invalid"` | `422 Unprocessable Entity` with stable validation errors |
| `EventStore.append` | durable append-only event transaction |
| `getByIdempotencyKey` | unique idempotency lookup scoped by actor/device/client |
| `deriveSnapshot` | asynchronous projection job or explicit read-model derivation |
| `deriveActivityPubDemo` | demo projection only; not part of live mutation API |

## Endpoint Shape

Initial API:

```http
POST /v1/pulse/events
Content-Type: application/json
Idempotency-Key: <client-generated-key>
```

Request body:

```json
{
  "actor": "jess",
  "occurredAt": "2026-05-03T05:00:00.000Z",
  "visibility": "VISIBILITY_PUBLIC",
  "source": {
    "client": "pulse-client",
    "deviceId": "phone-1",
    "idempotencyKey": "draft-018"
  },
  "tags": ["pulse"],
  "media": [],
  "payload": {
    "kind": "note",
    "text": "First live broker write."
  }
}
```

The request body intentionally omits:

- `id`
- broker-owned lifecycle state
- lifecycle history
- public snapshot ids
- ActivityPub ids

`revision` may remain optional for the first service release and default to `1`, matching the mock broker. If update/supersede semantics land later, revision handling must become explicit and conditional.

## Response Shape

Accepted:

```json
{
  "status": "accepted",
  "eventId": "evt_20260503_000001",
  "state": "accepted",
  "revision": 1,
  "acceptedAt": "2026-05-03T05:00:01.000Z",
  "idempotencyKey": "draft-018",
  "projection": {
    "status": "queued"
  }
}
```

Duplicate:

```json
{
  "status": "duplicate",
  "eventId": "evt_20260503_000001",
  "state": "accepted",
  "revision": 1,
  "acceptedAt": "2026-05-03T05:00:01.000Z",
  "idempotencyKey": "draft-018",
  "projection": {
    "status": "queued"
  }
}
```

Invalid:

```json
{
  "status": "invalid",
  "errors": [
    {
      "code": "payload_empty",
      "path": "payload.text",
      "message": "note text must not be empty"
    }
  ]
}
```

Rejected by authority or policy preconditions:

```json
{
  "status": "rejected",
  "errors": [
    {
      "code": "unauthenticated",
      "path": "<request>",
      "message": "authentication is required"
    }
  ]
}
```

`invalid` means the event intent failed schema or event-contract validation. `rejected` means the request failed broker-edge preconditions such as authentication, device authority, idempotency scope, or service policy before event acceptance.

## Idempotency Contract

The idempotency key must be client-generated before the first submit attempt and must remain stable for retries of the same draft.

The live broker should scope idempotency by:

- resolved actor id
- verified device id
- client id hint
- mutation endpoint
- idempotency key

The broker must enforce this with a durable uniqueness constraint. A second request with the same scope must return the original accepted event outcome.

If a request reuses an idempotency key with a different payload hash inside the same scope, the broker must reject it with `idempotency_payload_mismatch`. It must not create a second event, mutate the original event, or silently accept the new payload.

If the same raw key appears under a different actor or verified device scope, it is a different idempotency record. The broker should still record enough audit detail to detect suspicious repeated keys.

## Durable Storage Transaction

For the first live broker, event acceptance should be one durable transaction:

1. verify auth/device preconditions
2. normalize and validate event intent
3. compute request payload hash
4. reserve idempotency scope
5. assign broker event id
6. append immutable event record
7. append lifecycle history row for `submit -> accepted`
8. enqueue projection work
9. return accepted response

If any step before event append fails, no accepted event should exist. If projection enqueue fails after event append, the accepted event remains truth and projection status should be recoverable by a worker sweep.

Recommended minimum tables or logical collections:

| Store | Purpose |
| --- | --- |
| `pulse_events` | immutable accepted event payload and broker event id |
| `pulse_event_lifecycle` | append-only lifecycle transitions |
| `pulse_idempotency_keys` | scoped uniqueness, payload hash, original event id, response summary |
| `pulse_projection_jobs` | retryable projection work and DLQ state |

The authoritative event store should be Postgres or SQLite for the first service. Queue systems may fan out work, but they must not be the only authoritative copy.

## Client-Visible Outcome States

The durable client package can map broker responses into these sync states:

| Client state | Source |
| --- | --- |
| `local_queued` | draft has not reached broker yet |
| `retry_pending` | network failure, timeout, `429`, or retryable `5xx` |
| `broker_accepted` | broker returned `accepted` |
| `broker_duplicate` | broker returned `duplicate` for the same draft |
| `broker_invalid` | broker returned schema/event validation errors |
| `broker_rejected` | broker returned auth/device/idempotency-scope rejection |
| `projection_pending` | event accepted but public/private projection not complete |

The client should preserve drafts and outbox rows for `invalid` and `rejected` outcomes. Those are not generic retry failures.

## Retry Rules

Retryable:

- network disconnect before response
- request timeout with unknown result
- `429` with `Retry-After`
- `500`, `502`, `503`, `504`
- projection status still queued after event acceptance

Not silently retryable:

- `400` malformed request
- `401` unauthenticated
- `403` actor/device not authorized
- `409 idempotency_payload_mismatch`
- `422 invalid`
- `423 device_revoked` if represented separately

For unknown-result failures, the client should retry with the same idempotency key. The broker must make that safe.

## Validation Error Codes

The first stable error vocabulary should include:

| Code | Meaning |
| --- | --- |
| `payload_empty` | required text/content is blank |
| `payload_kind_unsupported` | payload kind is not accepted by this broker version |
| `visibility_invalid` | visibility is missing or unspecified |
| `occurred_at_invalid` | timestamp is not valid UTC ISO-8601 |
| `source_missing` | source object is missing |
| `idempotency_key_missing` | neither header nor source key is usable |
| `idempotency_payload_mismatch` | same scoped key was reused for different content |
| `media_not_ready` | submitted media references are not accepted for live attach yet |
| `private_object_key_forbidden` | client tried to project private object storage detail publicly |

Auth/device errors are owned by `TIN-928`, but the broker mutation API must carry them without pretending they are validation errors.

## Projection Boundary

Mutation success does not mean public publication.

The broker owns accepted private truth. Projection workers derive public snapshots after policy gates run. A public snapshot may omit an accepted event because of visibility, exact location, media privacy, unsupported payload type, or later lifecycle state.

The mutation response may expose projection status, but it must not synchronously require public snapshot generation. Public snapshots remain checked/generated artifacts or read-model outputs, not the write source of truth.

## ActivityPub Boundary

No ActivityPub delivery is included in this API.

The AP-shaped demo publisher in `@blog/pulse-core` may continue to preview public projection shape, but the live broker mutation API must not:

- sign HTTP requests
- deliver to remote inboxes
- manage followers
- accept remote inbox writes
- emit deletes or tombstones to federated servers
- retry federation delivery

`TIN-731` owns real federation.

## Open Implementation Choices

These choices can remain open until service implementation:

- plain HTTPS JSON versus Connect RPC wrapper
- Postgres versus SQLite for the first durable store
- queue implementation for projection jobs
- exact broker event id format
- whether idempotency key also has a top-level header requirement or header/body equality requirement
- whether accepted response includes full stored event or only event summary

They should not change the core semantics above.
