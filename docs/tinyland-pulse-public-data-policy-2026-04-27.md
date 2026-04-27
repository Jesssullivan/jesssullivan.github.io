# Tinyland Pulse Public-Data Policy

Date: 2026-04-27

Policy version: `m1-2026-04-27`

This document is the operator-facing version of the rules encoded in [`@blog/pulse-core/policy`](../packages/pulse-core/src/policy/index.ts) and enforced by [`scripts/validate-pulse-snapshot.mts`](../scripts/validate-pulse-snapshot.mts). The shipping rule is: anything not on the allow list, default-deny.

## Allowed in M1 public projection

- `note` payloads with `visibility = VISIBILITY_PUBLIC` and non-empty trimmed text.
- `bird_sighting` payloads with `visibility = VISIBILITY_PUBLIC`, at least one of common or scientific name, and either no `place` or a `place` with precision `LOCATION_PRECISION_HIDDEN` or `LOCATION_PRECISION_REGION`.
- Tags, occurrence timestamps in UTC, and the broker-assigned event id.
- The schema/policy/manifest version strings recorded in `PublicPulseManifest`.

## Blocked by the policy engine

- Any event with `visibility ≠ VISIBILITY_PUBLIC`. Reason: `visibility_not_public`.
- Any payload kind outside the M1 allow list (`photo`, `git_summary`, `listening`). Reason: `kind_not_in_m1_allowlist`.
- Any `MediaAttachment` with a non-empty `privateObjectKey`. Reason: `private_object_key_present`.
- Any `bird_sighting` with `place.precision = LOCATION_PRECISION_EXACT` unless an explicit allowlist flag is passed. Reason: `exact_location_not_allowlisted`.

The validator additionally rejects a snapshot whose serialized form contains the substrings `privateObjectKey` or `s3://`, even if every individual event passed the policy. This is a defense-in-depth check, not a duplication.

## Out of scope until a follow-up policy version

These remain blocked until they have their own policy version. Adding one of them is a deliberate review, not an incremental tweak:

- Photos. Require an upload-intent + EXIF-strip + derivative-generation lifecycle and an `m2-photos` policy bump.
- Generated git summaries. Require an explicit per-repository allowlist and a redaction layer for paths and committer information.
- Listening history. Require either explicit user-facing opt-in per item or a heavy aggregation step that strips temporal granularity.
- Sensor readings. Require an explicit decision about which environmental contexts can be inferred from the data.
- Live broker fetches at render time. The static blog must always read a checked or generated snapshot, never the live broker.

## ActivityPub language guidelines

The blog has shipped WebFinger discovery only ([PR #68](https://github.com/Jesssullivan/jesssullivan.github.io/pull/68)). It has not shipped real ActivityPub federation. Until it does, PRs and posts should use the following terms:

- "WebFinger discovery" - what is currently live: `acct:jess@transscendsurvival.org` resolves to `https://tinyland.dev/@jesssullivan` via `.well-known/webfinger`.
- "AP-shaped mirror" or "ActivityStreams projection" - any future static `outbox.json` or actor document that is not actually delivered to remote servers. This is a publication shape, not a federation.
- "ActivityPub federation" or "federated" - reserved for the day the broker speaks server-to-server: actor lifecycle, signed delivery, follower collection, inbox handling, retries, updates/deletes, tombstones, moderation, and compatibility testing against real servers.

PRs that mix these terms must be edited before merge.

## Required federation work before claiming "federated"

Each of these is a separate planning surface, not a checklist row in another PR:

- Actor document and its lifecycle.
- WebFinger entry tightening (already shipped at the discovery layer).
- Outbox: backed by accepted public events, not hand-edited JSON.
- Inbox handling: at minimum follow, undo follow, accept, and the moderation surface for blocking actors and instances.
- Follower collection backed by durable storage.
- Delivery queue with retry, backpressure, and operational visibility.
- HTTP signatures on every delivery.
- Update and delete semantics including tombstones and protocol-correct visibility on the receiving side.
- Compatibility testing against at least Mastodon and one non-Mastodon server.
- Abuse and moderation tooling appropriate for personal use.

## Operator gates

These run automatically:

- `npm run check` runs `validate-pulse-snapshot.mts`. Any drift in the committed `static/data/pulse/public-snapshot.v1.json` fails locally and in CI.
- `npm run prebuild` runs the same validator before `vite build`. The build refuses to publish a snapshot it cannot certify.
- `npm run test:pulse-core` runs the full schema, FSM, policy property, broker, and proto-reservation suite. CI must run this on every PR that touches `packages/pulse-core/` or any file under `src/lib/pulse/`.
- `proto/reserved.json` is the schema-evolution ledger. Adding or removing fields requires updating this file. The validator script refuses field-number reuse and refuses removed messages without an entry.

These run by review:

- New payload kinds. They MUST come with both a schema PR and a policy PR. Schema and policy are not allowed to drift.
- New visibility values. They MUST have a documented projection rule before merge.
- New `policyVersion` strings. They MUST be referenced from this document.

## Drift response

If the build fails on `validate-pulse-snapshot`:

1. Do not silence the validator. The validator failing is the system working.
2. Re-run `tsx scripts/generate-pulse-snapshot.mts` to regenerate the snapshot from the current fixtures. Compare the diff carefully.
3. If the diff is intentional, commit the regenerated snapshot. If not, find the unintended schema or policy change and revert it.
4. If the policy itself changed, bump `policyVersion` in [`packages/pulse-core/src/schema/snapshot.ts`](../packages/pulse-core/src/schema/snapshot.ts) and add an entry to this document.
