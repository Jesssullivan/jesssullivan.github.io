# @blog/pulse-core

Typed event contract, lifecycle state machine, public-data policy, and in-memory broker mock for the [Tinyland Pulse Lifecycle MVP](../../docs/tinyland-pulse-lifecycle-architecture-spec-2026-04-27.md).

This package is intentionally narrow:

- It does not run as a service.
- It does not open network sockets.
- It does not read environment variables or secrets.
- It does not depend on SvelteKit, Vite, or any blog runtime.

It exists so the blog repo can carry a fixture-only, public-safe model of the Pulse lifecycle. When the broker grows into a real service it will move out of this repo to a tinyland-side home and the blog will keep consuming only signed `PublicPulseSnapshot` JSON.

## Layout

- `proto/tinyland/pulse/v1/` -- canonical protobuf IDL. Hand-authored. Source of truth for field numbers, names, and semantics.
- `proto/reserved.json` -- schema-evolution ledger. Records every retired field number and name so they cannot be reused.
- `src/schema/` -- Zod schemas mirroring the proto messages. Used for runtime validation and ProtoJSON-shaped fixture loading.
- `src/fsm/` -- lifecycle states and the explicit transition table.
- `src/policy/` -- public-data policy engine. Decides whether a `PulseEvent` is allowed in a `PublicPulseSnapshot`.
- `src/broker/` -- in-memory broker mock. Idempotent ingest, projection queue, deterministic snapshot derivation.
- `src/fixtures/` -- deterministic fixtures used by tests and by the blog `/pulse/lab` demo.
- `test/` -- Vitest unit tests plus fast-check property tests for the public-data invariants.
- `scripts/validate-proto-reservations.mts` -- guards `proto/reserved.json` against accidental field-number reuse.

## Running

```sh
npm run -w @blog/pulse-core test
npm run -w @blog/pulse-core typecheck
npm run -w @blog/pulse-core validate:proto
```
