# DNS Architecture — transscendsurvival.org

Current DNS state as of 2026-06-23. The domain (double-s
"tranSScend" — this is the correct spelling, not a typo) is registered at
Cloudflare Registrar, delegated to Cloudflare nameservers at the `.org` parent,
and served by Cloudflare Pages at the apex and `www`. GitHub Pages remains the
rollback publisher.

## Current State

| Plane | State |
| --- | --- |
| Registrar | Cloudflare Registrar. Current parent NS = `izabella.ns.cloudflare.com` + `sullivan.ns.cloudflare.com`. |
| Current DNS authority | Cloudflare zone `602400322c1ecac4983542c76af90115`, nameservers `izabella.ns.cloudflare.com` + `sullivan.ns.cloudflare.com`. This is the public authority. |
| Records | apex `CNAME` → `transscendsurvival-org.pages.dev` (proxied / orange-cloud); `www` `CNAME` → `transscendsurvival-org.pages.dev` (proxied / orange-cloud). |
| Serving | Cloudflare Pages at the apex and `www`. GitHub Pages remains the rollback publisher; `static/CNAME` = `transscendsurvival.org` stays in place for fallback. |
| Cloudflare Pages | Production: the `transscendsurvival.org` and `www.transscendsurvival.org` custom domains on project `transscendsurvival-org` are ACTIVE + serving. Shadow: `tss.tinyland.dev` is served by the dedicated Pages project `tss-shadow` (custom domain moved off `transscendsurvival-org` 2026-07-07 — Pages custom domains always serve a project's *production* deployment, so the shadow build is `tss-shadow`'s production); `tss.ephemera.tinyland.dev` remains on `transscendsurvival-org`. |
| DNSSEC | Active. Cloudflare Registrar publishes the parent DS; Cloudflare signs the zone. |
| Cert | Cloudflare Pages-managed certs for apex and `www`. GitHub Pages-managed cert remains relevant only for rollback. |

The canonical split is now simple: **apex and `www` are proxied CNAMEs to
Cloudflare Pages**. Modeling `www` as raw `A`/`AAAA` records is still wrong; it
must remain a CNAME so Cloudflare Pages owns the TLS and hostname mapping.

## 1. Topology

Cloudflare Registrar holds the registration, and the parent delegates the zone to
Cloudflare nameservers. Cloudflare answers with both apex and `www` as proxied
`CNAME` records to Cloudflare Pages, so the Cloudflare proxy edge is in the
request path for both production hostnames.

```mermaid
flowchart LR
    subgraph Registrar["Cloudflare Registrar"]
        Reg["transscendsurvival.org<br/>registration"]
        DS["parent DS active<br/>2371 / ECDSAP256SHA256"]
        NSdeleg["current NS delegation<br/>izabella + sullivan .ns.cloudflare.com"]
    end

    subgraph CF["Cloudflare DNS — current authority"]
        Zone["zone 602400322c1ecac4983542c76af90115<br/>izabella + sullivan .ns.cloudflare.com"]
        Apex["apex CNAME (proxied, orange-cloud)<br/>→ transscendsurvival-org.pages.dev"]
        WWW["www CNAME (proxied, orange-cloud)<br/>→ transscendsurvival-org.pages.dev"]
    end

    subgraph CFP["Cloudflare Pages — serving (production)"]
        Pages["project transscendsurvival-org<br/>apex + www custom domains active<br/>CF-managed certs"]
    end

    subgraph GHP["GitHub Pages — rollback"]
        GH["static/CNAME = transscendsurvival.org"]
    end

    Reg --> NSdeleg
    NSdeleg --> Zone
    DS -. "validates Cloudflare DNSSEC chain" .-> Zone
    Zone --> Apex
    Zone --> WWW
    Apex -- "proxied → Cloudflare edge" --> Pages
    WWW -- "proxied → Cloudflare edge" --> Pages
    GH -. "rollback publisher" .-> Reg
```

## 2. Request Flow

A client resolves the name through a recursive resolver, which follows the
current `.org` parent delegation to Cloudflare. For both apex and `www`,
Cloudflare returns a proxied `CNAME` to `transscendsurvival-org.pages.dev` and
answers with its own anycast addresses; the client connects through the
Cloudflare edge to Cloudflare Pages.

```mermaid
sequenceDiagram
    participant C as Client (browser)
    participant R as Recursive resolver
    participant CF as Cloudflare NS (current authority)
    participant Edge as Cloudflare edge
    participant CFP as Cloudflare Pages

    Note over C,CFP: apex request — transscendsurvival.org
    C->>R: A/AAAA? transscendsurvival.org
    R->>CF: query (follows current .org delegation)
    CF-->>R: CNAME → transscendsurvival-org.pages.dev + Cloudflare anycast A/AAAA (NOERROR)
    R-->>C: resolved (proxied)
    C->>Edge: HTTPS GET / (via Cloudflare edge)
    Edge->>CFP: forward to Cloudflare Pages
    CFP-->>C: 200 OK (CF Pages cert)

    Note over C,CFP: www request — www.transscendsurvival.org
    C->>R: A/AAAA? www.transscendsurvival.org
    R->>CF: query
    CF-->>R: CNAME → transscendsurvival-org.pages.dev + Cloudflare anycast A/AAAA (NOERROR)
    R-->>C: resolved (proxied)
    C->>Edge: HTTPS GET / (Host: www)
    Edge->>CFP: forward to Cloudflare Pages
    CFP-->>C: 200 OK
```

## 3. RCA — Before / After

The 2026-06-22 P0: DreamHost's authoritative DNS platform intermittently
SERVFAILed apex `AAAA` + `SOA` and had dead `TCP/53` — platform-wide, to the point
that `dreamhost.com` itself SERVFAILed `AAAA`. IPv6 / Happy-Eyeballs visitors got
`ERR_NAME_NOT_RESOLVED` while the IPv4 owner saw the site working. This was not
code, not GitHub Pages transport — it was the DNS authority. The durable service
fix was the registrar NS cutover to Cloudflare authority. Production
health checks now prove the delegated Cloudflare authority, public resolver
answers, apex and `www` serving, slash parity, and broker hydration.

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

    subgraph After["TARGET — Cloudflare authoritative (reliable)"]
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

    Before -. "prepare and verify Cloudflare authority, then change registrar NS" .-> After
```

The root cause lived purely in the DNS-authority plane: GitHub Pages transport and
the application code were never implicated. Cloudflare authority removes the
failing DreamHost DNS platform from the target resolution path.

## 4. Cloudflare Pages Serving (cut 2026-06-23) And Safe-Cut Procedure

The Cloudflare Pages project `transscendsurvival-org` serves the production apex
and `www` as of 2026-06-23. It builds via
`.github/workflows/cloudflare-pages-shadow.yml`; the shadow domain
`tss.ephemera.tinyland.dev` continues to build there. `tss.tinyland.dev` moved to
the dedicated `tss-shadow` Pages project on 2026-07-07 and goes stale on
shadow-branch pushes until redeployed (`wrangler pages deploy build
--project-name=tss-shadow --branch=main` with the lab admin CF token).

The cut followed the safe order below, which stays load-bearing for any future
rollback-and-recut. The hard rule: **NEVER flip a production hostname to the
proxied `transscendsurvival-org.pages.dev` CNAME unless the matching Pages custom
domain is active.** Flipping apex while the Pages domain was pending caused TWO
transient outages on 2026-06-22: Cloudflare's anycast edge served requests before
the Pages domain was active, returning connection refused / timeout. The
2026-06-23 cut pre-validated Pages custom domains before pointing production DNS
at `pages.dev`, so no outage occurred.

State machine (current = Pages serving; GitHub Pages is the rollback target):

```mermaid
stateDiagram-v2
    [*] --> PagesServing: current — Cloudflare Pages serving, proxied apex + www CNAMEs
    PagesServing --> GHPServing: ROLLBACK — restore GitHub Pages records
    GHPServing --> DomainPending: re-cut — add production custom domains to Pages
    note right of DomainPending
        DANGER ZONE
        Pages custom domain validates in-account.
        Do NOT point a production hostname at pages.dev until ACTIVE —
        the anycast edge serves before the domain is active → connection refused.
        (This is what bit us twice on 2026-06-22.)
    end note
    DomainPending --> DomainActive: domain validated + cert issued
    DomainActive --> PagesServing: only now flip DNS → transscendsurvival-org.pages.dev (proxied)
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
        Op-->>DNS: flip production DNS → pages.dev (proxied) while domain PENDING
        C->>Edge: HTTPS GET /
        Edge-->>C: connection refused / timeout (Pages domain not active yet)
    end

    rect rgb(20, 40, 20)
        Note over Op,C: CORRECT ORDER — pre-validate, then cut
        CFP-->>Op: custom domain ACTIVE (cert issued)
        Op->>DNS: only now flip production DNS → pages.dev (proxied)
        C->>Edge: HTTPS GET /
        Edge-->>C: 200 OK (Pages serving)
    end
```

## Monitoring

Monitoring is host-agnostic and already shipped. It lives in
`scripts/check-production-health.mts`,
`.github/workflows/production-health.yml`, and the `workers/dns-guard/` Worker.
It asserts non-empty resolution plus `AAAA`/`SOA`/`TCP` across the current
delegated Cloudflare nameservers and public resolvers, with no hardcoded
public-resolver IP expectations. It also checks apex and `www` serving
(Cloudflare Pages), HTTP-to-HTTPS redirects, slash parity, and public blog
hydration.
