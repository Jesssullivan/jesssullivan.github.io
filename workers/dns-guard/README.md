# transscend-dns-guard

Edge monitor for **https://transscendsurvival.org**. Asserts, from Cloudflare's
edge across several independent public resolvers, that the **apex and www resolve
both `A` and `AAAA`**, then checks HTTPS + the canonical redirects plus
slashless and trailing-slash blog routes, and validates the
Tinyland blog broker display-stream contract.

## Why

The apex `A`/`AAAA` live **out of band from the static site artifact**. On
2026-06-22 the apex lost all four `AAAA` while `A` and `www` stayed healthy, then
a Cloudflare nameserver cutover briefly exposed stale proxied targets before the
production hostnames were ready. Visitors saw `ERR_NAME_NOT_RESOLVED`,
connection failures, or closed TLS connections depending on which resolver path
they hit. **A normal IPv4 HTTP uptime check stays green through parts of that.**
This guard fails on missing record classes and public HTTPS/redirect breakage
instead. (Incidents: TIN-2146, TIN-1110 follow-up.)

## Layered design (belt-and-suspenders, all free)

| Layer | Vantage | Catches |
|---|---|---|
| **this Worker** (cron 15m) | CF edge, ~4 DoH resolvers | apex/www `A`+`AAAA` missing at public resolvers; HTTPS/redirects; broker contract drift |
| `scripts/check-production-health.mts` (GH Actions 30m) | GH runner | delegated + cutover authoritative apex records + `www` CNAME, direct IPv4 HTTPS target checks, stale-deploy self-heal, browser hydration |
| UptimeRobot | external, **IPv6 transport** | apex unreachable over a real v6 socket |
| StatusCake | external | apex `AAAA` record-value drift + HTTPS |
| Healthchecks.io | — | alert routing (email) + dead-man's-switch |

> The GH layer + stale-deploy self-heal already exist on branch
> `fix/content-stats-dispatch-pages` — merging it to `main` is TIN-2147.

## Deploy

```sh
cd workers/dns-guard
npm install
# CF creds from the lab SOPS store, e.g.:
#   export CLOUDFLARE_API_TOKEN="$(sops --decrypt --extract '["infrastructure"]["cloudflare_api_token"]' ~/git/lab/nix/secrets/...)"
npx wrangler deploy
npx wrangler secret put HEALTHCHECK_URL   # Healthchecks.io ping URL — EMAIL + dead-man's-switch
npx wrangler secret put NTFY_TOPIC_URL    # e.g. https://ntfy.sh/blahaj-blog-alerts — tinyland PUSH (failure-only)
# npx wrangler secret put NTFY_TOKEN      # only if the ntfy topic is access-protected
```

The cron fires every 15 min. `GET https://transscend-dns-guard.<subdomain>.workers.dev/`
runs the checks on demand and returns **200** (all checks passed) or **503** (a
check failed or was skipped) with a JSON breakdown — usable directly as a
StatusCake/UptimeRobot monitor target.

This catches public resolver drift and public route failures. The GH production
health workflow catches authority-level split brain and stale Cloudflare proxy
targets. The service-level fix is the Cloudflare Pages / Cloudflare DNS canonical
cutover tracked in TIN-1110.

## External monitors (email alerting)

- **Healthchecks.io** — create a check (period 20m, grace 10m), add an **email**
  integration, copy the ping URL into the `HEALTHCHECK_URL` secret. The Worker
  POSTs `…/fail` on a real failure (active page) and pings on success (dead-man's
  switch if the Worker itself dies).
- **UptimeRobot** (free, 50 monitors) — HTTPS monitor on `https://transscendsurvival.org`
  with **IPv6 forced** (the one layer that exercises a real v6 socket); email contact.
  Optionally a second monitor on the Worker `/` endpoint.
- **StatusCake** (free, 10 monitors) — **DNS** test: host `transscendsurvival.org`,
  record `AAAA`, expected `2606:50c0:8000::153 / 8001::153 / 8002::153 / 8003::153`;
  plus an HTTPS uptime test; email contact group.

## Status badges

The Worker serves `GET /badge` as shields.io endpoint JSON (green `operational`,
yellow `N skipped`, red `N failing`). After deploy, wire these into the **root
`README.md`** (tracked in the monitoring initiative):

```md
<!-- self-hosted, from this Worker -->
![DNS guard](https://img.shields.io/endpoint?url=https%3A%2F%2Ftransscend-dns-guard.<subdomain>.workers.dev%2Fbadge)
<!-- UptimeRobot, after creating the monitor -->
![Uptime](https://img.shields.io/uptimerobot/ratio/m<monitor-id>)
<!-- StatusCake, after creating the test -->
![StatusCake](https://app.statuscake.com/button/index.php?Track=<test-id>&Days=1)
```

## tinyland alerting (the reachable seam)

The canonical tinyland sink is a **Prometheus + Alertmanager** stack in `~/git/blahaj`
(honey cluster) that fans out to **ntfy + Postfix email** (`alerts@tinyland.dev` →
jess@sulliwood.org). Its Alertmanager is **ClusterIP-only**, so an edge Worker can't
reach `POST /api/v2/alerts` yet. The one internet-reachable seam is the **ntfy topic** —
so this Worker posts failures there via `NTFY_TOPIC_URL` (device push), in parallel with
Healthchecks.io (email). Full Alertmanager integration once it's exposed off-cluster is
tracked in **TIN-2148** (create topic `blahaj-blog-alerts`, or reuse `blahaj-mail-alerts`).
