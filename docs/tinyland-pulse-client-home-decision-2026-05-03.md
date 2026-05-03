# Tinyland Pulse Client Home Decision

Date: 2026-05-03

Linear: `TIN-923` - Reopen durable Pulse client home before live broker writes.

Status: decided. Durable Pulse client authority should split out of the static blog before live broker writes, durable auth/device authority, durable media lifecycle ownership, or real ActivityPub delivery.

## Decision

Keep `/pulse/client` in the blog repo as a noindex QA/demo surface. Do not promote it into the production client.

Create a durable Pulse client app/package that consumes `@blog/pulse-core` before adding live broker mutation APIs. The split should happen before server-backed drafts, durable outbox sync, trusted auth/device identity, object-storage media uploads, or real ActivityPub delivery.

## Why Now

The temporary in-blog proof has enough shape:

- `TIN-789` shipped the hidden `/pulse/client` scaffold.
- `TIN-918` proved draft intent, idempotency, policy preview, broker mock submit, and AP-shaped demo outbox visibility.
- `TIN-919` added local draft/outbox persistence and retry-state semantics.
- `TIN-921` added auth/device/session/display identity stubs.
- `TIN-922` added media upload intent and privacy lifecycle stubs.
- Hosted PR CI, shadow image build, infra apply/smoke, Pages deploy, and post-merge `main` CI have all passed for the current M2 proof.

That proof is useful, but it is still static-blog scaffolding. The next class of work changes authority. Once the client can write to a live broker, the blog would start carrying responsibilities it should not own: auth trust, durable storage, media privacy, retries, and service deploy posture.

## Rejected Alternatives

### Keep Accumulating Inside `/pulse/client`

Rejected for production authority.

This would be acceptable only for more adapter-shaped demo work. It is not acceptable for live broker writes, durable auth/device identity, object storage, media workers, or federation. Those concerns need runtime ownership that a static blog route cannot honestly provide.

### Split Everything, Including Real Federation, In One Step

Rejected for scope control.

The AP-shaped publisher is intentionally demo-only. It does not deliver, sign, receive, moderate, track followers, retry, delete, tombstone, or compatibility-test against real servers. TIN-731 remains the real ActivityPub federation lane.

## Authority Matrix

| Surface | Owns | Must Not Own |
| --- | --- | --- |
| `/pulse` | public snapshot rendering | private broker truth, writes, auth, media processing |
| `/pulse/lab` | noindex policy QA and demo harness | production compose authority |
| `/pulse/client` | noindex M2 client proof and smoke target | durable write client, auth authority, media authority |
| `@blog/pulse-core` | schema, FSM, policy, mock broker, demo publisher contracts | deploy/runtime ownership |
| durable Pulse client app/package | product client UI, local/offline sync, client runtime | broker event truth, media worker truth, AP delivery |
| durable broker service | append-only event truth, mutation API, idempotency, projection jobs | public blog rendering |
| media workers/storage | private objects, EXIF stripping, derivatives, public media eligibility | event source-of-truth semantics |
| ActivityPub federation service | actor lifecycle, signed delivery, inbox/outbox, followers, deletes/tombstones | M2 demo publisher shortcuts |

## Follow-On Queue

TIN-923 creates the split-path implementation queue:

- `TIN-926` - scaffold durable Pulse client app/package consuming `@blog/pulse-core`.
- `TIN-927` - define live Pulse broker mutation API and idempotency contract.
- `TIN-928` - define Pulse auth and device identity authority boundary.
- `TIN-929` - define Pulse media object-storage lifecycle and worker boundaries.
- `TIN-930` - add hosted CI and shadow route for the durable Pulse client surface.
- `TIN-731` - design real ActivityPub federation contract after the static projection MVP.

Recommended order:

1. Scaffold the durable client home.
2. Define the live broker mutation boundary.
3. Define auth/device authority.
4. Define media storage and worker lifecycle.
5. Add hosted CI/shadow proof for the split client.
6. Resume real ActivityPub only through TIN-731.

## QA Stance

Browser validation stays hosted-only.

Use:

- targeted Vitest for `src/lib/pulse/client`, `@blog/pulse-core`, and any new client package contract code
- `npm run check`
- `npm run lint`
- hosted GitHub Actions browser checks
- tailnet shadow smoke for review surfaces

Do not run Playwright locally.
