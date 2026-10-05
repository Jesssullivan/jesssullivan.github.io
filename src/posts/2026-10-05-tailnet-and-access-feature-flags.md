---
title: "Feature Flags From Your Tailnet: Three Signals, Two Trust Tiers"
date: "2026-10-05"
description: "Turning 'is this visitor on my tailnet, and are they a member' into boolean flags a static site and a SvelteKit app can render against, with a fail-closed resolver and receipts for every claim."
tags: ["tailscale", "tsidp", "cloudflare-access", "sveltekit", "dhall", "feature-flags"]
published: false
slug: "tailnet-and-access-feature-flags"
category: "devops"
---

DRAFT. Unpublished (`published: false`). Reference repo: link when public. Measured items below carry the date 2026-10-05. Chrome Local Network Access is pending.

I wanted one small thing. A page that shows a "members" section to people on my tailnet and shows nothing at all to everyone else. Not a greyed-out section. Not a login wall with a teaser. Zero nodes in the DOM.

That "small thing" ate a week, three identity systems and one patched OIDC provider. Here is what came out the other side.

## The problem

A static site on GitHub Pages cannot know who is looking at it. A server can, but then it is not a static site. And "who is looking" is three different questions wearing one trench coat: is this browser on my tailnet, did a person log in through my identity provider, and did my edge (Cloudflare Access, in my case) already vouch for them?

Each answers differently, each can be forged by something different, and the tempting move is to OR them together into `isMember` and ship. That is how a probe image load ends up gating a page it has no business gating.

So the contract is the interesting part. Everything else is plumbing.

## Three signals, two trust tiers

The resolver takes a list of sources and a list of rules and returns flags, a `basis` (who granted what), and a status. Sources come in two trust tiers:

- **verified**: a server checked a signature, a trusted proxy address, or a session it issued itself. Safe for server-rendered markup and APIs.
- **hint**: a browser-side observation. Fine for progressive enhancement. Never for access control.

The signals:

| Signal | Arrives as | Tier |
| --- | --- | --- |
| Tailscale Serve headers | login plus app capability headers, honored only from the configured proxy address | verified |
| tsidp OIDC | authorization code with PKCE, result in a signed HttpOnly session | verified |
| Cloudflare Access | `Cf-Access-Jwt-Assertion` checked against the team JWKS | verified |
| Tailnet probe | the visitor's browser fetches the probe from a public page | hint |
| Cloudflare session probe | browser-side check of an Access session | hint |

The rule that makes the tiers real: `resolve()` caps each source kind at its maximum trust, whatever the adapter claims. A probe that says "verified" is still a hint. While any source is pending, every flag is false. If nothing is granted and a source errored, the status is `failed`, and a UI renders nothing gated for that either. An override source claiming `false` beats every grant, so there is one global off switch.

Receipts: `just test-flags` (resolution table: `probes cannot claim verified: trust is capped by kind`, `any pending source: status pending and every flag false`, `override false is a global off switch even against a verified grant`, `unknown source kinds are ignored, fail closed`).

## Architecture

```text
 browser on tailnet            browser anywhere
        |                            |
        | Serve (headers)            | Cloudflare Access (JWT)
        v                            v
   +-----------------------------------------+      tsidp (OIDC, PKCE)
   |  SvelteKit full stack (apps/kit)        |<-----  login, tailnet-only
   |  hooks.server.ts -> FlagSource[]        |
   |  resolve() -> flags, basis, status      |
   |  {#if flags.member}   /api/gated 403    |
   +-------------------+---------------------+
                       | /api/surface (exact origin, no credentials)
                       v
   static site (GitHub Pages) --- GatedSlot: renders nothing on
        ^                         failure, pending, or false
        | hint tier
   probe node (tag:flag-probe) /probe.svg /v1/tailnet /v1/surface
```

Three adapters feed one resolver. The server adapters are verified. The browser adapters are hints. The static site only ever gets a manifest (`{version, flags, basis, status}`) and fails closed if it cannot parse it.

## ACL as typed Dhall

The tailnet policy is where "who counts as a member" is actually written down, and a hand-edited HuJSON policy is a bad place to discover a typo. I keep mine as Dhall in the public `Jesssullivan/tailnet-acl`. The awkward part was grants: the `app` field is polymorphic, so for a long time grants were raw JSON merged in by a script.

The fix was a sum type of capabilities, `Cap = < Probe | Tsidp | Custom >`, with grants rendered from Dhall. The pull request carried a golden-file test so the rendered policy stayed byte-identical to the old one. It is merged.

The reference repo does not copy ACL code. It vendors the types at a pinned commit and builds a tiny example policy on them:

```haskell
G.cap
  [ group.members ]
  [ tag.probe ]
  [ G.Cap.Probe { cap = "example.org/cap/flag-probe", flag = "member" } ]
```

Funnel is granted to the identity-provider tag only, and the checker asserts that.

Receipts: `just acl-check` (type-checks `acl/policy.dhall`, asserts admin-only tag owners, Funnel on exactly `tag:flag-idp`, probe and tsidp grants present, placeholder names only). `just acl-apply` is a stub: a dry run unless `CONFIRM_APPLY=apply-<TAILNET>` and an API key file are set, because applying replaces the whole policy. Use a throwaway tailnet to learn.

## The probe, with Serve app capabilities

The probe is a stdlib Python backend on its own tagged node, behind `tailscale serve --accept-app-caps=...`. Serve forwards an `Tailscale-App-Capabilities` header only when the ACL grants it, so the decision is: exactly one login header plus exactly one matching capability header means yes. Two logins, two capability headers, a wrong or malformed capability: no.

It also checks itself. A node guard refuses to say yes unless the node is Running with exactly one tag and no Funnel anywhere. If the guard fails, yes turns into no.

Responses are `no-store`, CORS is an exact-origin match from env (no wildcard), and the Private Network Access preflight is answered for that origin only. No identity appears in bodies, headers or logs.

Measured 2026-10-05: `GET /v1/tailnet` returns `{"tailnet": true}` for a tailnet caller, with an exact-origin CORS response and a Private Network Access preflight answer. See `MEASURED.md`.

Receipts: `just test-probe` (`test_yes_needs_one_login_and_one_capability`, `test_second_tag_is_wrong_tags`, `test_funnel_anywhere`, `test_guard_failure_turns_yes_into_no`, `test_cors_is_exact_origin_only`, `test_probe_svg_preflight_needs_exact_origin_and_pna`, `test_no_identity_in_body_headers_or_log`, `test_binds_loopback_only`); `python3 probe/backend.py --guard-once` on a live node.

## tsidp claims, Funnel limits, and the tagged-device gap

tsidp is Tailscale's OIDC provider that runs as a node on your tailnet. Two things matter for flags.

Claims come from the ACL. A grant on `tailscale.com/cap/tsidp` can attach `extraClaims`, so members get `flag_member: "true"` in their ID token. The kit treats the string `"true"` as a member and anything else as not. Receipt: `flag_member "true" (string, as tsidp extraClaims renders it) is a member` in `just test-kit`.

Funnel is a deliberate split. Funnel makes discovery and the JWKS reachable publicly, which is what an external relying party like Cloudflare Access needs. tsidp refuses `/authorize`, its admin UI and dynamic client registration over Funnel. So a login only completes from a browser that is on the tailnet. That is a feature: the identity provider is public, the act of logging in is not.

Measured 2026-10-05: tsidp discovery is reachable publicly over Funnel.

Now the gap. Upstream tsidp refuses a tagged node at `/authorize`: a tagged node has no user, so there is no subject to put in a token. For flags this matters, because a device (a kiosk, a shop machine) is exactly what I want to admit without pretending it is a person.

The fix is a small patch to tsidp: a `taggedIdentity` field on the `tailscale.com/cap/tsidp` rule that carries a subject, email and name. It is read only from the operator's grant, never from the caller, and ignored for user-owned nodes. No grant, no subject, still refused, exactly like upstream.

Measured 2026-10-05: a tagged device signing in through the patched tsidp `taggedIdentity` grant gets a stable numeric user-id subject through a Cloudflare Access OIDC identity provider.

Two honest notes. The patch lives in my infrastructure repo today, not in the reference repo, and the reference compose file pins the stock `v0.0.15` image, so the tagged-device path is not reproducible from the reference repo yet (link when public, along with an upstream conversation). And the subject is a device identity. The flag it grants means "this device", never "this person".

## SvelteKit full stack

`hooks.server.ts` builds the source list from three adapters:

- Serve headers, trusted only when the peer address equals the configured proxy address. The same headers from anyone else are ignored, and with no proxy configured nothing is trusted.
- tsidp OIDC, authorization code with PKCE, issuer pinned to discovery, result stored in a signed HttpOnly cookie. Tampered, foreign-key and expired cookies are not signed in.
- Cloudflare Access, verified with `jose` against a remote JWKS. A token signed by another key, garbage, and an unsigned `alg: none` token are all rejected.

`+layout.server.ts` returns flags, basis and status and nothing about identity. The page uses `{#if data.flags.member}`, so server-side rendering never emits gated markup. `/api/gated` returns 403 without a verified flag, including for a hint-only source claiming member. Flag-dependent pages are never prerendered.

Receipts: `just test-kit` (`spoofed serve headers from a stranger never yield a member`, `rejects a token signed by a different key`, `rejects garbage and an unsigned (alg none) token`, `403 for a hint-only source claiming member`, `anonymous: no gated node and no member copy in the HTML`, `the dev override on is ignored in production; off always applies`).

## Static site with a gated origin

GitHub Pages cannot run any of that. So the static app ships a `GatedSlot` that fetches the manifest from the probe or the kit origin and renders nothing unless the manifest is settled and the flag is true. Failure modes are all the same answer: HTTP 500, network failure, malformed JSON, a schema violation (a flag that is a string), a pending manifest even if its flag says true. Zero gated nodes.

The kit serves `/api/surface` to the static origin with an exact-origin match and no credentials, so it reflects the Serve and Access signals, not the same-site OIDC cookie. The prerendered HTML never contains the gated markup, since the slot opens only on the client after a settled manifest. But be clear about what that buys: the slot's children still ship in the JavaScript bundle. This is a UI hint, not a secret. Anything that must stay secret has to be fetched from the gated origin, which checks a verified flag (the kit's `/api/gated` does).

Receipts: `just test-e2e` (Playwright, manifest mocked: `anonymous (manifest says false): zero gated nodes`, `pending manifest: zero gated nodes even when the flag says true`, the five failure cases, `prerendered HTML never contains the gated markup`, `the manifest request carries no credentials`).

## Resolution and basis

Every grant records why. `basis` lists each granting source, its kind and its effective (capped) trust. That makes two things possible that a bare boolean does not: a UI can say "you are seeing this because your tailnet vouched for you (verified)", and a test can assert that a hint never appears as the sole reason for a gated API response.

The failure semantics are the part I would defend in a code review. Pending beats everything: no flag is true while any source is in flight, so there is no flash of gated content that then vanishes. An errored source does not block a verified grant from another. And `parseSurface` treats the manifest as untrusted input, so a malformed one is `null`, which renders nothing.

Receipts: `just test-flags` (`basis lists every granting source`, `an errored source does not block a verified grant from another`, `toSurface then parseSurface is lossless`).

## Reproduce it with just

```sh
nix develop            # node 22, pnpm, dhall, python3, just, gitleaks
cp .env.example .env   # placeholders; fill in locally, never commit
just install
just test              # flags, kit, probe
just build             # kit and static
just acl-check         # render and check the example policy
just test-e2e          # after: pnpm --filter @tsidp-flags/static exec playwright install chromium
```

Against a live tailnet (a throwaway one; applying an ACL replaces the whole policy): put a tagged auth key in a file, `just acl-build acl-check`, review the diff against the live policy, then `just acl-apply` with its confirmation, `docker compose up idp`, then run the kit and the static app. Cloudflare is optional.

Placeholders only in the repo (`example.ts.net`, `you@example.com`). A denylist check (`just denylist`) fails CI if tokens from a private, untracked list appear anywhere, and gitleaks runs beside it.

## Honest limitations

- **tsidp is experimental.** The pin is `v0.0.15` and it needs `TAILSCALE_USE_WIP_CODE=1` until v1.0.0. Bump deliberately.
- **Chrome Local Network Access: pending.** Chrome gates public pages that reach private or tailnet addresses. I have not measured it yet. When I do I will record Chrome version, date, whether a prompt appears, and member vs non-member vs tailnet off. Until then the probe is a hint tier and the kit origin is the enforcement point. Safari and Firefox are pending too.
- **Claims are login-time claims.** A `flag_member` in a token is as fresh as the login. Revoke a member in the ACL and existing sessions keep the flag until they expire.
- **Device is not person.** The tagged-device subject says which device, not who.
- **Public bundles are public.** Anything in a static bundle is readable by everyone. The gated content has to live behind the gated origin, which is why the e2e test checks the prerendered HTML.
- **Revocation lag.** The probe re-checks its node guard at most every 10 seconds and `no-store` only protects the browser. Session lifetimes and JWKS caches set how long a revoked member lingers.
- **The tagged-device patch is not yet in the reference repo** (see above).

## Claim to evidence

| Claim | Evidence |
| --- | --- |
| Probes can never be verified | `just test-flags`: `probes cannot claim verified: trust is capped by kind` |
| Pending and failed render nothing | `just test-flags`; `just test-e2e` failure cases |
| Serve headers from strangers are ignored | `just test-kit`: `spoofed serve headers from a stranger never yield a member` |
| Access tokens are verified, `alg: none` rejected | `just test-kit` |
| SSR emits no gated markup | `just test-kit`: `anonymous: no gated node and no member copy in the HTML` |
| Gated API needs a verified flag | `just test-kit`: `/api/gated` 403 cases |
| Probe: exact-origin CORS and PNA preflight | `just test-probe`; measured 2026-10-05 in `MEASURED.md` |
| Probe self-guard (one tag, no Funnel) | `just test-probe`: `test_second_tag_is_wrong_tags`, `test_funnel_anywhere` |
| Funnel only on the idp tag | `just acl-check` |
| tsidp discovery public over Funnel | measured 2026-10-05, `MEASURED.md` |
| Tagged device gets a stable numeric subject via Access | measured 2026-10-05, `MEASURED.md` (patch not in the reference repo yet) |
| Chrome Local Network Access result | pending, `MEASURED.md` |

-Jess
