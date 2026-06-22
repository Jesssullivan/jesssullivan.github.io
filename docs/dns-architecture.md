# DNS Architecture — transscendsurvival.org

Canonical landing state as of 2026-06-22. The domain (double-s "tranSScend" — this
is the correct spelling, not a typo) is registered at DreamHost, resolved
authoritatively by Cloudflare, and served by GitHub Pages. This doc is the picture
of how those three planes fit together and why the DNS authority moved.

## Landing State

| Plane | State |
| --- | --- |
| Registrar | DreamHost — registration only. Nameservers flipped to `izabella.ns.cloudflare.com` + `sullivan.ns.cloudflare.com` (registrar-manual; the DreamHost API cannot change NS — it exposes only `dns-add_record` / `dns-list_records` / `dns-remove_record`). |
| DNS authority | Cloudflare. Zone id `602400322c1ecac4983542c76af90115`. Reliably serves AAAA + SOA + TCP/53. |
| Records | apex `A` = `185.199.108.153` / `.109.153` / `.110.153` / `.111.153`; apex `AAAA` = `2606:50c0:8000::153` / `8001::153` / `8002::153` / `8003::153`; `www` = `CNAME` → `jesssullivan.github.io`. All records are GREY / DNS-only (NOT proxied). |
| Serving | GitHub Pages, unchanged. `static/CNAME` = `transscendsurvival.org`. |
| DNSSEC | Enabled on Cloudflare (zone signed). DS at the DreamHost registrar (manual; no API path): key_tag `2371`, algorithm `13` (ECDSAP256SHA256), digest_type `2` (SHA-256). |
| Cert | Let's Encrypt, state `approved`, covers BOTH apex + `www`, expires `2026-09-09`. |

The GitHub Pages canonical split is load-bearing: **apex = `A`/`AAAA`, `www` =
`CNAME`**. Modeling `www` as `A`/`AAAA` records breaks the `www` TLS cert
presentation (handshake failure); `www` MUST stay a `CNAME`.

## 1. Topology

DreamHost holds the registration and delegates the zone to Cloudflare via NS.
Cloudflare is the authoritative DNS plane and answers with grey (DNS-only) records
that point straight at GitHub Pages. Cloudflare's proxy edge is intentionally NOT
in the request path.

```mermaid
flowchart LR
    subgraph Registrar["DreamHost — registrar (registration only)"]
        Reg["transscendsurvival.org<br/>registration"]
        DS["DS record (manual)<br/>key_tag 2371 · alg 13 · digest 2"]
        NSdeleg["NS delegation"]
    end

    subgraph CF["Cloudflare — authoritative DNS (reliable)"]
        Zone["zone 602400322c1ecac4983542c76af90115<br/>izabella + sullivan .ns.cloudflare.com<br/>DNSSEC signed · AAAA + SOA + TCP/53"]
        Apex["apex A/AAAA (grey, DNS-only)<br/>185.199.108/109/110/111.153<br/>2606:50c0:8000-8003::153"]
        WWW["www CNAME (grey, DNS-only)<br/>jesssullivan.github.io"]
    end

    subgraph GHP["GitHub Pages — serving (unchanged)"]
        Pages["static/CNAME = transscendsurvival.org<br/>Let's Encrypt cert (apex + www)<br/>expires 2026-09-09"]
    end

    Reg --> NSdeleg
    NSdeleg -- "NS delegation" --> Zone
    DS -. "DNSSEC chain of trust" .-> Zone
    Zone --> Apex
    Zone --> WWW
    Apex -- "grey record → origin" --> Pages
    WWW -- "grey record → origin" --> Pages
```

## 2. Request Flow

A client resolves the name through a recursive resolver, which follows the
DreamHost → Cloudflare delegation and gets `A`/`AAAA` from Cloudflare. The client
then connects directly to GitHub Pages (Cloudflare is not proxying). The apex
serves `200`; `www` redirects `301` to the apex.

```mermaid
sequenceDiagram
    participant C as Client (browser)
    participant R as Recursive resolver
    participant CF as Cloudflare NS (authoritative)
    participant GHP as GitHub Pages

    Note over C,GHP: apex request — transscendsurvival.org
    C->>R: A/AAAA? transscendsurvival.org
    R->>CF: query (follows DreamHost→Cloudflare delegation)
    CF-->>R: A 185.199.10x.153 / AAAA 2606:50c0:800x::153 (NOERROR, signed)
    R-->>C: resolved A/AAAA
    C->>GHP: HTTPS GET / (direct, not proxied)
    GHP-->>C: 200 OK (Let's Encrypt cert)

    Note over C,GHP: www request — www.transscendsurvival.org
    C->>R: A/AAAA? www.transscendsurvival.org
    R->>CF: query
    CF-->>R: CNAME → jesssullivan.github.io → A/AAAA (NOERROR, signed)
    R-->>C: resolved
    C->>GHP: HTTPS GET / (Host: www)
    GHP-->>C: 301 → https://transscendsurvival.org/
    C->>GHP: HTTPS GET / (apex)
    GHP-->>C: 200 OK
```

## 3. RCA — Before / After

The 2026-06-22 P0: DreamHost's authoritative DNS platform intermittently
SERVFAILed apex `AAAA` + `SOA` and had dead `TCP/53` — platform-wide, to the point
that `dreamhost.com` itself SERVFAILed `AAAA`. IPv6 / Happy-Eyeballs visitors got
`ERR_NAME_NOT_RESOLVED` while the IPv4 owner saw the site working. This was not
code, not GitHub Pages transport — it was the DNS authority. The fix was to move
authority to Cloudflare, which reliably answers `AAAA` + `SOA` over `TCP/53`.

```mermaid
flowchart TB
    subgraph Before["BEFORE — DreamHost authoritative (broken)"]
        direction TB
        b_c["IPv6 / Happy-Eyeballs client"]
        b_r["Recursive resolver"]
        b_dh["DreamHost authoritative DNS"]
        b_aaaa["AAAA query → SERVFAIL"]
        b_soa["SOA query → SERVFAIL"]
        b_tcp["TCP/53 → dead"]
        b_out["ERR_NAME_NOT_RESOLVED<br/>(IPv4 owner still sees it 'working')"]
        b_c --> b_r --> b_dh
        b_dh --> b_aaaa
        b_dh --> b_soa
        b_dh --> b_tcp
        b_aaaa --> b_out
        b_soa --> b_out
        b_tcp --> b_out
    end

    subgraph After["AFTER — Cloudflare authoritative (reliable)"]
        direction TB
        a_c["IPv6 / Happy-Eyeballs client"]
        a_r["Recursive resolver"]
        a_cf["Cloudflare authoritative DNS"]
        a_aaaa["AAAA query → NOERROR"]
        a_soa["SOA query → NOERROR"]
        a_tcp["TCP/53 → answers"]
        a_out["resolves → GitHub Pages 200"]
        a_c --> a_r --> a_cf
        a_cf --> a_aaaa
        a_cf --> a_soa
        a_cf --> a_tcp
        a_aaaa --> a_out
        a_soa --> a_out
        a_tcp --> a_out
    end

    Before -. "move DNS authority to Cloudflare" .-> After
```

The root cause lived purely in the DNS-authority plane: GitHub Pages transport and
the application code were never implicated. Moving authority to Cloudflare removed
the failing platform from the resolution path entirely.

## 4. Deferred Cloudflare Pages Serving Cut

A separate Cloudflare Pages project, `transscendsurvival-org`, builds via
`.github/workflows/cloudflare-pages-shadow.yml`. Its apex + `www` custom domains
are **PENDING**, and the Pages serving cut is **DEFERRED**.

The hard rule: **NEVER flip apex to the proxied `transscendsurvival-org.pages.dev`
CNAME while the Pages custom domain is still pending.** Doing that caused TWO
transient outages on 2026-06-22 — the Pages custom domain validates via PUBLIC DNS
(which lags the NS flip), so Cloudflare's anycast edge served requests before the
Pages domain was active, returning connection refused / timeout. A safe future cut
must pre-validate the Pages custom domain to active (cert issued) BEFORE pointing
apex DNS at `pages.dev`.

State machine for a *safe* cut:

```mermaid
stateDiagram-v2
    [*] --> GHPServing: current — GitHub Pages serving, grey records
    GHPServing --> PagesBuilding: cloudflare-pages-shadow.yml builds project

    PagesBuilding --> DomainPending: add apex + www custom domains to Pages
    note right of DomainPending
        DANGER ZONE
        Pages custom domain validates via PUBLIC DNS,
        which LAGS the NS flip. Do NOT point apex at
        pages.dev yet — anycast edge will serve before
        the Pages domain is active → connection refused.
        (This is what bit us twice on 2026-06-22.)
    end note

    DomainPending --> DomainActive: domain validated + cert issued
    DomainActive --> CutApex: only now flip apex → transscendsurvival-org.pages.dev (proxied)
    CutApex --> PagesServing: Cloudflare Pages serving
    PagesServing --> [*]

    DomainPending --> GHPServing: stay on GitHub Pages (DEFERRED — current posture)
```

The same precondition as a sequence — validate first, cut second:

```mermaid
sequenceDiagram
    participant Op as Operator
    participant CFP as Cloudflare Pages
    participant DNS as Cloudflare DNS (authoritative)
    participant Edge as Cloudflare anycast edge
    participant C as Client

    Op->>CFP: add apex + www custom domains
    CFP->>DNS: validate via PUBLIC DNS (lags NS flip)

    rect rgb(60, 20, 20)
        Note over Op,C: WRONG ORDER — the 2026-06-22 double outage
        Op-->>DNS: flip apex → pages.dev (proxied) while domain PENDING
        C->>Edge: HTTPS GET /
        Edge-->>C: connection refused / timeout (Pages domain not active yet)
    end

    rect rgb(20, 40, 20)
        Note over Op,C: CORRECT ORDER — pre-validate, then cut
        CFP-->>Op: custom domain ACTIVE (cert issued)
        Op->>DNS: only now flip apex → pages.dev (proxied)
        C->>Edge: HTTPS GET /
        Edge-->>C: 200 OK (Pages serving)
    end
```

## Monitoring

Monitoring is host-agnostic and already shipped — do not author or modify it. It
lives in `scripts/check-production-health.mts`, `.github/workflows/production-health.yml`,
and the `workers/dns-guard/` Worker. It asserts non-empty resolution plus
`AAAA`/`SOA`/`TCP` across Cloudflare NS and public resolvers, with no hardcoded IPs,
so it survives both the current GitHub Pages posture and any future Cloudflare Pages
cut without edits.
