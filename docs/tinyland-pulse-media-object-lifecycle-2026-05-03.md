# Tinyland Pulse Media Object Lifecycle

Date: 2026-05-03

Linear: `TIN-929` - Define Pulse media object-storage lifecycle and worker boundaries.

Status: planning contract. No production media upload path is implemented by this document.

Related:

- [Tinyland Pulse Lifecycle Architecture Spec](./tinyland-pulse-lifecycle-architecture-spec-2026-04-27.md)
- [Tinyland Pulse Public-Data Policy](./tinyland-pulse-public-data-policy-2026-04-27.md)
- [Tinyland Pulse Client Home Decision](./tinyland-pulse-client-home-decision-2026-05-03.md)
- `TIN-922` - Pulse media upload intent stubs.

## Decision

Pulse media bytes are not part of the static blog, not part of checked fixtures, and not owned by `@blog/pulse-core`.

The durable media path should use a private RustFS/S3-compatible object store for original uploads, worker-owned processing for EXIF/privacy stripping and derivative generation, and an explicit promotion gate before any media URL can enter a public projection.

`@blog/pulse-core` may continue to model media as references on `PulseEvent.media`. It should not learn how to upload, sign, read, transform, or publish object bytes.

## Authority Split

| Surface | Owns | Must Not Own |
| --- | --- | --- |
| durable Pulse client | upload intent request, local attachment draft state, user-facing alt text/caption fields | RustFS credentials, private object keys as trusted authority, EXIF stripping, derivative truth |
| broker service | accepted event truth, media reservation records, idempotent mutation boundary, media lifecycle audit references | byte transformation, direct public URL generation, static blog rendering |
| media storage | private original objects, private processed objects, immutable derivative blobs | event lifecycle authority, public snapshot contents |
| media workers | upload verification, EXIF/privacy stripping, derivative generation, promotion eligibility checks | client identity trust, broker event acceptance, ActivityPub delivery |
| public projection worker | includes only public-safe derivative URLs after policy approval | private object keys, raw bytes, original uploads |
| static blog | reads public snapshot data only | live uploads, RustFS access, media processing, broker fetches at render time |

## Lifecycle Mapping

The TIN-922 client proof already names the demo states. Durable services should treat those names as user-facing lifecycle hints, then back them with broker/media records.

| Client/demo state | Durable meaning | Public-projectable |
| --- | --- | --- |
| `upload_intent` | A client requested a media reservation. The broker may have issued an upload target, but no bytes are trusted yet. | No |
| `private_object_staged` | The upload completed into private object storage and the broker has verified expected size/hash/MIME metadata. | No |
| `exif_stripped` | A worker produced a privacy-scrubbed private object. Original bytes remain private and auditable. | No |
| `derivative_ready` | A worker produced one or more public-shape derivatives, but policy has not promoted them into projection. | No |
| `public_projection_ready` | Policy has approved the derivative, `privateObjectKey` has been stripped from the public record, and `publicUrl` is eligible for snapshots/AP-shaped mirrors. | Yes |
| `unsupported` | The media type or processing result is terminally rejected for public projection. | No |

The broker should preserve lifecycle history. Updating a media record from one state to another must append an audit event rather than mutating away the prior state.

## RustFS Object Keys

Private object keys are internal capabilities. They must never appear in `PublicPulseSnapshot`, static fixtures, generated posts, ActivityPub demo output, or client-visible public URLs.

Use separate private and public-safe prefixes or buckets:

- `pulse/private/original/...` - raw uploaded bytes.
- `pulse/private/processed/...` - privacy-scrubbed intermediates.
- `pulse/public/derivatives/...` - public-safe blobs after promotion.

Durable keys should be broker-assigned after event acceptance or reservation, not trusted from browser text fields. A useful shape is:

```text
pulse/private/original/{actor_id}/{device_id}/{reservation_id}/{media_id}/v1/{filename}
pulse/private/processed/{event_id}/{media_id}/v1/scrubbed.{ext}
pulse/public/derivatives/{event_id}/{media_id}/v1/{variant}.{ext}
```

The exact key format can change before implementation, but the invariants should not:

- keys are generated server-side
- keys are scoped by accepted actor/device or broker event identity
- keys include media id and version/revision
- browser clients never receive RustFS access keys
- public URLs are generated from promoted derivatives, not original uploads

## Worker Boundaries

The first durable implementation should keep each boundary small:

1. Upload reservation
   - Broker validates actor/device/session authority.
   - Broker creates a reservation, media id, expected MIME class, expected max size, and scoped upload target.
   - Reservation is idempotent under the same client draft/idempotency key.

2. Upload completion verification
   - Broker or storage callback confirms object presence, size, checksum, and declared MIME.
   - Invalid or missing uploads become retryable or terminal lifecycle failures without creating public projection work.

3. Privacy scrub worker
   - Reads only from the private original prefix.
   - Removes EXIF/GPS/device metadata.
   - Writes scrubbed output to a private processed prefix.
   - Emits audit metadata such as tool version, input hash, output hash, and stripped metadata classes without exposing stripped values.

4. Derivative worker
   - Reads scrubbed private objects.
   - Generates bounded public variants such as web image and thumbnail.
   - Writes to a public-safe derivative prefix that is still not projectable until policy promotion.

5. Promotion policy worker
   - Verifies allowed MIME, required alt text, successful privacy scrub, derivative availability, public URL shape, and absence of private object keys.
   - Emits `public_projection_ready` only after the public-data policy has a photo/media policy version that allows it.

6. Retry and dead-letter handling
   - Retries transient object-store, transform, and worker errors.
   - Marks unsupported or policy-denied media as terminal without blocking the accepted non-media event unless the event contract requires media as the payload.

## Public Projection Gate

Media can appear in a public projection only when all of these are true:

- event visibility is `VISIBILITY_PUBLIC`
- payload kind is allowed by the active policy version
- media MIME type is on the public allowlist
- alt text is non-empty after trimming
- private object key is empty in the projection record
- public URL points to a promoted derivative, not an original upload
- EXIF/privacy scrub status is recorded as complete
- derivative generation status is recorded as complete
- the active policy version explicitly allows media, for example a future `m2-photos` policy bump

The current M1 policy remains correct: any non-empty `privateObjectKey` blocks projection with `private_object_key_present`, and photo payloads remain out of the M1 allowlist.

## Failure States

Use separate failure lanes so operator dashboards and client UX do not blur privacy failures with routine retry:

| Failure | Retry | Public projection | Notes |
| --- | --- | --- | --- |
| upload reservation expired | client may retry | No | Preserve idempotency key history. |
| upload object missing | yes | No | Recheck object store before DLQ. |
| checksum or size mismatch | no by default | No | Treat as integrity failure until manually reviewed. |
| MIME mismatch | no by default | No | Do not trust filename extension. |
| EXIF scrub worker error | yes | No | Retry on tool/runtime failure. |
| EXIF scrub unsafe result | no | No | Terminal privacy failure. |
| derivative worker error | yes | No | Retry on transform/runtime failure. |
| unsupported media type | no | No | Maps to `unsupported`. |
| policy denied | no | No | Preserve reason for preview/audit. |

## Audit Requirements

Each media lifecycle transition should carry enough data to explain what happened without leaking private bytes or stripped metadata:

- actor id and verified device id
- broker event id or reservation id
- media id and revision
- previous state and next state
- worker name/version where applicable
- private object key reference for internal audit only
- content hash/checksum references
- policy version and denial reason where applicable
- timestamp and correlation id

Public snapshots may include only the derived public fields. Internal audit records may reference private keys, but those records must not be copied into static fixtures or public JSON.

## Static Blog Boundary

The static blog route may keep showing media lifecycle intent in `/pulse/client` and `/pulse/lab` for QA. That is useful demo surface.

It must not:

- request signed upload URLs
- hold RustFS credentials
- process image bytes
- publish original upload paths
- treat client-submitted `privateObjectKey` as trusted
- fetch the live broker during prerender
- add real media bytes to checked Pulse fixtures

Until the media policy version changes, photo/media demos should remain blocked or preview-only even when the local client state says `public_projection_ready`.

## Implementation Follow-Ons

Before real media upload ships:

- add the broker media reservation API next to the live mutation API
- choose exact RustFS bucket/prefix layout and retention policy
- define derivative variants and maximum dimensions/file sizes
- add MIME sniffing and transform tooling decisions
- add worker retry/DLQ observability
- add a new policy version for public photos/media
- add hosted CI and tailnet shadow smoke for the durable client route
- decide how ActivityPub media attachment delivery maps from promoted public derivatives in `TIN-731`

No local Playwright is required for this planning slice.
