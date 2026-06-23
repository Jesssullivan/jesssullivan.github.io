# DNS Architecture — transscendsurvival.org

Current DNS state as of 2026-06-23. The domain (double-s
"tranSScend" — this is the correct spelling, not a typo) is registered at
DreamHost, delegated to Cloudflare nameservers at the `.org` parent, and served
by Cloudflare Pages at the apex. The apex was cut from GitHub Pages to Cloudflare
Pages on 2026-06-23 (proxied `CNAME` → `transscendsurvival-org.pages.dev`);
GitHub Pages remains the rollback publisher and still serves `www`.

## Current State

| Plane | State |
| --- | --- |
| Registrar | DreamHost. Current parent NS = `izabella.ns.cloudflare.com` + `sullivan.ns.cloudflare.com`. The DreamHost API cannot change NS or DS and exposes only `dns-add_record` / `dns-list_records` / `dns-remove_record`; NS and DS changes are manual in the DreamHost registrar panel. |
| Current DNS authority | Cloudflare zone `602400322c1ecac4983542c76af90115`, nameservers `izabella.ns.cloudflare.com` + `sullivan.ns.cloudflare.com`. This is the public authority. |
| Records | apex `CNAME` → `transscendsurvival-org.pages.dev` (proxied / orange-cloud); `www` `CNAME` → `jesssullivan.github.io` (DNS-only / grey-cloud). |
| Serving | Cloudflare Pages at the apex. GitHub Pages remains the rollback publisher and serves the `www` 301; `static/CNAME` = `transscendsurvival.org` stays in place for fallback. |
| Cloudflare Pages | Production: the `transscendsurvival.org` apex custom domain on project `transscendsurvival-org` is ACTIVE + serving since 2026-06-23 (validated in-account before apex DNS was pointed at it). Shadow: `tss.tinyland.dev` / `tss.ephemera.tinyland.dev`. `www` stays on GitHub Pages. |
| DNSSEC | Cloudflare zone signing is enabled but parent DS is still pending at DreamHost (TIN-2160). Until the DS is visible at the `.org` parent, production is unsigned from the public chain's point of view. |
| Cert | Cloudflare Pages-managed cert for the apex (issued 2026-06-23). GitHub Pages-managed cert remains for the `www` redirect and rollback. |

The canonical split is load-bearing: **apex = proxied `CNAME` (Cloudflare Pages),
`www` = DNS-only `CNAME` (GitHub Pages redirect)**. Modeling `www` as `A`/`AAAA`
records breaks the `www` TLS cert presentation (handshake failure); `www` MUST
stay a `CNAME`.

## 1. Topology

DreamHost holds the registration and delegates the zone to Cloudflare
nameservers. Cloudflare answers with the apex as a proxied `CNAME` to Cloudflare
Pages — the production serving surface, validated and active as of 2026-06-23 —
and `www` as a DNS-only `CNAME` to GitHub Pages. The Cloudflare proxy edge IS in
the request path for apex production traffic; `www` stays off the proxy.

```mermaid
flowchart LR
    subgraph Registrar["DreamHost — registrar"]
        Reg["transscendsurvival.org<br/>registration"]
        DS["parent DS pending (TIN-2160)"]
        NSdeleg["current NS delegation<br/>izabella + sullivan .ns.cloudflare.com"]
    end

    subgraph CF["Cloudflare DNS — current authority"]
        Zone["zone 602400322c1ecac4983542c76af90115<br/>izabella + sullivan .ns.cloudflare.com"]
        Apex["apex CNAME (proxied, orange-cloud)<br/>→ transscendsurvival-org.pages.dev"]
        WWW["www CNAME (grey, DNS-only)<br/>→ jesssullivan.github.io"]
    end

    subgraph CFP["Cloudflare Pages — serving (production)"]
        Pages["project transscendsurvival-org<br/>apex custom domain active 2026-06-23<br/>CF-managed cert"]
    end

    subgraph GHP["GitHub Pages — rollback + www redirect"]
        GH["static/CNAME = transscendsurvival.org<br/>serves www 301 → apex"]
    end

    Reg --> NSdeleg
    NSdeleg --> Zone
    DS -. "awaiting DreamHost registrar DS" .-> Zone
    Zone --> Apex
    Zone --> WWW
    Apex -- "proxied → Cloudflare edge" --> Pages
    WWW -- "grey record → origin" --> GH
```

## 2. Request Flow

A client resolves the name through a recursive resolver, which follows the
current `.org` parent delegation to Cloudflare. For the apex, Cloudflare returns a
proxied `CNAME` to `transscendsurvival-org.pages.dev` and answers with its own
anycast addresses; the client connects through the Cloudflare edge to Cloudflare
Pages. For `www`, Cloudflare returns a DNS-only `CNAME` to `jesssullivan.github.io`
(GitHub Pages), which redirects `301` to the apex.

```mermaid
sequenceDiagram
    participant C as Client (browser)
    participant R as Recursive resolver
    participant CF as Cloudflare NS (current authority)
    participant Edge as Cloudflare edge
    participant CFP as Cloudflare Pages
    participant GHP as GitHub Pages

    Note over C,CFP: apex request — transscendsurvival.org
    C->>R: A/AAAA? transscendsurvival.org
    R->>CF: query (follows current .org delegation)
    CF-->>R: CNAME → transscendsurvival-org.pages.dev + Cloudflare anycast A/AAAA (NOERROR)
    R-->>C: resolved (proxied)
    C->>Edge: HTTPS GET / (via Cloudflare edge)
    Edge->>CFP: forward to Cloudflare Pages
    CFP-->>C: 200 OK (CF Pages cert)

    Note over C,GHP: www request — www.transscendsurvival.org
    C->>R: A/AAAA? www.transscendsurvival.org
    R->>CF: query
    CF-->>R: CNAME → jesssullivan.github.io → A/AAAA (NOERROR)
    R-->>C: resolved
    C->>GHP: HTTPS GET / (Host: www)
    GHP-->>C: 301 → https://transscendsurvival.org/
    C->>Edge: HTTPS GET / (apex)
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
answers, direct GitHub Pages serving, slash parity, and broker hydration.

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

## 4. Cloudflare Pages Shadow And Future Serving Cut

A separate Cloudflare Pages project, `transscendsurvival-org`, builds via
`.github/workflows/cloudflare-pages-shadow.yml`. It is intentionally shadow-only:
`tss.tinyland.dev` and `tss.ephemera.tinyland.dev` are allowed, but production
apex + `www` are not attached to the Pages project.

The hard rule: **NEVER flip apex to the proxied `transscendsurvival-org.pages.dev`
CNAME unless the Pages custom domain is active and the operator has explicitly
chosen a new serving cutover.** Flipping apex while the Pages domain was pending
caused TWO transient outages on 2026-06-22: Cloudflare's anycast edge served
requests before the Pages domain was active, returning connection refused /
timeout. A safe future cut must pre-validate the Pages custom domain to active
(cert issued) BEFORE pointing apex DNS at `pages.dev`.

State machine for a *safe* cut:

```mermaid
stateDiagram-v2
    [*] --> GHPServing: current — GitHub Pages serving, grey records
    GHPServing --> PagesBuilding: cloudflare-pages-shadow.yml builds project

    PagesBuilding --> DomainPending: add apex + www custom domains to Pages
    note right of DomainPending
        DANGER ZONE
        Pages custom domain validates via PUBLIC DNS,
        Do NOT point apex at
        pages.dev yet — anycast edge will serve before
        the Pages domain is active → connection refused.
        (This is what bit us twice on 2026-06-22.)
    end note

    DomainPending --> DomainActive: domain validated + cert issued
    DomainActive --> CutApex: only now flip apex → transscendsurvival-org.pages.dev (proxied)
    CutApex --> PagesServing: Cloudflare Pages serving
    PagesServing --> [*]

    DomainPending --> GHPServing: remove prod domains, stay on GitHub Pages (current posture)
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

Monitoring is host-agnostic and already shipped. It lives in
`scripts/check-production-health.mts`,
`.github/workflows/production-health.yml`, and the `workers/dns-guard/` Worker.
It asserts non-empty resolution plus `AAAA`/`SOA`/`TCP` across the current
delegated Cloudflare nameservers and public resolvers, with no hardcoded
public-resolver IP expectations. It also checks direct GitHub Pages serving,
canonical redirects, slash parity, and public blog hydration.
