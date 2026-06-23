# Apex → Cloudflare Pages Cutover

How to put the canonical apex `transscendsurvival.org` on Cloudflare Pages — the deferred serving-cut from TIN-1110. Companion to [dns-cutover-and-rollback.md](dns-cutover-and-rollback.md); read that first. Follows the declare-then-verify loop in `AGENTS.md`.

## Why this is mostly an operator runbook

The apex Pages custom domain **cannot be activated via the Cloudflare API**. CF verifies a Pages custom domain by reading a *literal* CNAME, but a CNAME at the zone apex is *flattened* (CF answers A/AAAA), so the API verifier permanently reports `"CNAME record not set"` and the host returns 530. The dashboard's **in-account verification** (CF owns the zone) is the only path. `www` (a subdomain, literal CNAME) activates via API fine; the apex root does not. Confirmed against the CF API reference + 7 API attempts (TIN-1110). Never use a Global API Key; least-privilege `cfat_` Bearer tokens only.

## Prerequisites
- DNS authority on Cloudflare (done; NS `izabella`/`sullivan.ns.cloudflare.com`).
- Pages project `transscendsurvival-org` serving the blog at `transscendsurvival-org.pages.dev`.
- The Cloudflare API token rotated if it was ever exposed (per `AGENTS.md` secret rule), with SOPS + the GitHub Actions secret updated.

## Procedure — Route A1 (Pages custom domain via dashboard)

**Operator:**
1. CF dashboard → **Workers & Pages** → `transscendsurvival-org` → **Custom domains** → **Set up a custom domain** → `transscendsurvival.org` → activate. CF verifies in-account, creates the apex record, issues the cert. (No API equivalent — that asymmetry is the whole finding.)

**Agent (after activation + token rotation; scoped Bearer token, `sops -d --extract` one value, never printed, `unset` after):**
2. Poll active: `GET /accounts/{acct}/pages/projects/transscendsurvival-org/domains/transscendsurvival.org` → `status:active`, cert issued.
3. Observe what CF created: `GET /zones/602400322c1ecac4983542c76af90115/dns_records?name=transscendsurvival.org`.
4. **Declare-then-verify:** edit `infra/cloudflare/zone.json` `records[]` to match the live apex record. If CF made the apex **proxied** (orange — typical for Pages-managed apexes), also set `invariants.apex_must_be_dns_only: false` and reconcile the `scripts/cf-dns-check.mts` apex-proxied guard (built for the grey-GitHub state) — an explicit, operator-approved diff, never silent.
5. `npm run` the cf-dns-check (`scripts/cf-dns-check.mts`) → all PASS (DNSSEC WARN until the DS lands).
6. `npm run test:production-health` → apex `/`, `/blog`, posts = 200; `www` = 301 → apex. `curl -sI https://transscendsurvival.org/blog` → 200.

## DNSSEC completion (independent of the apex cut)

**Operator:** DreamHost Panel → **Support → Contact Support** → subject "Add DS record for transscendsurvival.org (DNS hosted at Cloudflare)" with these exact 4 fields (DreamHost has no DS API and no self-service DNSSEC panel for external-DNS domains):
- Key tag `2371` · Algorithm `13` (ECDSAP256SHA256) · Digest type `2` (SHA-256) · Digest `E5C53E67B018ACAA709DA0AEA03C5F1E58A57059AF5D56E9BCD6A55DF224E8DB`

**Agent (after the DS lands at the `.org` parent):**
- `dig +short DS transscendsurvival.org @8.8.8.8` shows the DS; `dig +dnssec transscendsurvival.org @1.1.1.1` header gains the `ad` flag. CF flips `pending → active`; `cf-dns-check` WARN→PASS (no code change). Verify byte-for-byte against CF's live CDS: `dig CDS transscendsurvival.org @izabella.ns.cloudflare.com`. Risk LOW (insecure→secure, no SERVFAIL window; the only failure mode is a mistyped DS — give the exact 4 fields).

## Rollback
Restore the apex to grey A/AAAA → GitHub Pages + `www` CNAME → `jesssullivan.github.io` (the declared `zone.json` posture in `dns-cutover-and-rollback.md`). **If the DNSSEC DS is at the registrar, remove it FIRST** and wait ≥1.5× TTL before any DNSKEY change, or validating resolvers SERVFAIL.

## Route A2 (NOT chosen; reference only)
A Worker on the apex (`PUT /accounts/{id}/workers/domains`, the proven `hub.tinyland.dev` path) reverse-proxying `transscendsurvival-org.pages.dev` is the only scoped-token-automatable route, but it makes the apex proxied/orange (inverting the 2026-06-22 outage guard) and serves via a Worker, not Pages directly. Deferred in favor of A1.
