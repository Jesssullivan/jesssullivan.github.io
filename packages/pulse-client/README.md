# `@blog/pulse-client`

Durable Pulse client contract scaffold.

This package owns the reusable client-side draft, outbox, identity, media-intent, and local persistence adapters that were proven in the blog's hidden `/pulse/client` route. The blog route still exists as a noindex QA/demo harness, but it should not become production write authority.

## Current Boundary

`@blog/pulse-client` may own:

- local draft and outbox state
- adapter-shaped identity and device fields
- media upload intent and privacy lifecycle state
- client-to-`@blog/pulse-core` transformation helpers
- local storage adapters for demo/offline review

It must not own:

- broker append-only event truth
- live mutation API authority
- trusted auth or device registration
- object storage, EXIF stripping, derivatives, or public media promotion
- real ActivityPub delivery, inbox, followers, signatures, moderation, deletes, or tombstones

Those remain follow-on boundaries for `TIN-927`, `TIN-928`, `TIN-929`, `TIN-930`, and `TIN-731`.

## Development Commands

```sh
npm run -w @blog/pulse-client test
npm run -w @blog/pulse-client typecheck
```

## Hosted Proof

Browser proof stays hosted-only through GitHub Actions and the shadow route. Do not run Playwright locally.

The current proof contract is documented in
[`docs/tinyland-pulse-durable-client-ci-shadow-2026-05-03.md`](../../docs/tinyland-pulse-durable-client-ci-shadow-2026-05-03.md).
