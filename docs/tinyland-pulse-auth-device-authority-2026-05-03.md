# Tinyland Pulse Auth and Device Authority

Date: 2026-05-03

Linear: `TIN-928` - Define Pulse auth and device identity authority boundary.

Status: planning authority for live Pulse writes. This document narrows the TIN-921 demo stubs into production trust rules before the client submits events to a live broker.

Related:

- [Tinyland Pulse M2 Client Contract](./tinyland-pulse-m2-client-contract-2026-04-28.md)
- [Tinyland Pulse Client Home Decision](./tinyland-pulse-client-home-decision-2026-05-03.md)
- [Tinyland Pulse Lifecycle Architecture Spec](./tinyland-pulse-lifecycle-architecture-spec-2026-04-27.md)

## Decision

Pulse needs a broker-edge identity authority before live mutation APIs accept writes.

The first implementation may live inside the durable broker service, but the authority boundary is separate from both the static blog and the product client package. A submitted Pulse event must not trust `actor`, `displayName`, `deviceId`, `deviceLabel`, `client`, or `sessionId` just because the browser sent them.

The client may cache and submit identity-shaped values as hints. The broker edge must resolve the trusted actor, device, session, and audit context from authenticated credentials and server-owned device registration state.

## Current Stub Shape

TIN-921 added these demo fields to the hidden `/pulse/client` proof:

| Field | Current meaning | Production meaning |
| --- | --- | --- |
| `actor` | form/demo actor slug | ignored as authority; server resolves trusted actor |
| `displayName` | preview label | display hint only; server may override from actor profile |
| `deviceId` | form/demo device id | claim only; server verifies against registered device |
| `deviceLabel` | preview label | local display hint; server-owned registry carries durable label |
| `client` | client implementation id | non-secret client hint for audit, rate limiting, and compatibility |
| `sessionId` | form/demo session id | ignored as authority; server resolves session from credential |

The existing `Source` proto fields remain useful, but their trust level changes. `source.client`, `source.device_id`, and `source.idempotency_key` are request metadata until the broker validates them.

## Authority Matrix

| Surface | May Own | Must Not Own |
| --- | --- | --- |
| `/pulse/client` | noindex demo fields and smoke proof | trusted actor, session, or device authority |
| durable Pulse client package | cached identity hints, local device label, offline drafts | issuing credentials, registering devices, revoking sessions |
| broker edge identity authority | credential verification, actor resolution, device registration checks, audit context | public snapshot rendering or ActivityPub delivery |
| durable broker mutation API | accepted event truth after identity verification | trusting client-submitted actor/device fields directly |
| ActivityPub federation service | future actor documents, signed delivery, inbox/outbox semantics | M2 client login/session authority |

## Required Live-Write Flow

1. Client prepares a draft with local identity hints and an idempotency key.
2. Client calls the broker mutation API with an authenticated request.
3. Broker edge verifies the credential and resolves a trusted actor id.
4. Broker edge verifies or binds the device id against server-owned device registration state.
5. Broker edge records the client hint, resolved actor, resolved device, credential/session reference, and audit timestamp.
6. Broker mutation logic validates the event payload and idempotency key.
7. Broker assigns the accepted event id and stores append-only truth.
8. Projection workers derive public snapshots only from accepted events that pass policy.

If identity verification fails, the broker must reject before event acceptance. A failed identity check must not create an accepted event, public snapshot row, media promotion job, or ActivityPub-shaped output.

## Broker Verification Requirements

The broker edge must verify:

- the request credential is present, unexpired, and accepted for Pulse writes
- the credential resolves to exactly one actor
- the device id is registered to that actor or eligible for a controlled first-use registration flow
- the device is not revoked
- the session or credential has not been revoked
- the client id is known or explicitly allowed as an untrusted compatibility hint
- the idempotency key is scoped to the resolved actor, verified device, and mutation endpoint

The broker should store both raw hints and resolved authority where useful for audit, but only resolved authority may drive event ownership.

## Client Cache Rules

The product client package may cache:

- last selected actor hint for UI continuity
- display name hint
- device label hint
- local draft owner metadata
- pending outbox idempotency keys
- last successful broker-resolved actor/device summary for display

The client must not treat cached data as proof of authorization. Cache loss must not orphan broker truth, and cache tampering must not let one actor submit as another.

## Device Lifecycle

Device registration should be explicit enough to audit, but not overbuilt before the first live client.

Minimum states:

| State | Meaning |
| --- | --- |
| `pending` | first-use registration requested but not trusted for durable writes yet |
| `active` | device may submit writes for the resolved actor |
| `rotated` | replaced by a newer device credential or binding |
| `revoked` | blocked from future writes |

Required operations:

- register or bind device
- rename device label
- rotate device credential
- revoke device
- list actor devices for operator review

Revocation must affect new writes immediately. Existing accepted events remain append-only truth and should preserve the device id that was trusted at acceptance time.

## Error Contract

Identity failures should be stable enough for client UX and retry behavior:

| Error | Retry behavior |
| --- | --- |
| `unauthenticated` | user/client must obtain a fresh credential |
| `session_revoked` | do not retry silently |
| `device_unknown` | enter registration or recovery flow |
| `device_revoked` | do not retry silently |
| `actor_mismatch` | do not retry silently; surface account mismatch |
| `client_not_allowed` | do not retry silently |
| `idempotency_scope_mismatch` | do not retry; preserve draft for operator/debug review |

Network failures and broker `5xx` responses may remain retryable. Authority failures are not generic sync failures.

## Audit Requirements

Accepted events should retain enough metadata to explain who wrote what from where without making public snapshots private-data leaks.

Private broker truth may record:

- resolved actor id
- verified device id
- client id hint
- credential/session reference or hash
- request id
- accepted event id
- idempotency key scope
- accepted timestamp
- verification result

Public snapshots must not expose session references, credential material, private device labels, request ids, or operator-only audit detail.

## Explicit Non-Scope

This document does not define:

- real ActivityPub actor lifecycle or signed federation
- object-storage media access control
- OAuth/OIDC provider selection
- passkey implementation details
- moderation policy
- multi-actor delegation

Those can attach later without changing the core rule: client-submitted identity is a claim, not authority.
