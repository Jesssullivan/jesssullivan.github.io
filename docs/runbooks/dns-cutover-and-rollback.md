# Runbook: transscendsurvival.org DNS cutover & rollback

Operational runbook for the apex/`www` domain of this site. Spelling is
**tranSScend** (double-s) — not a typo.

## Landing state (2026-06-22)

- **Registrar:** DreamHost (registration only). Nameservers are flipped to
  Cloudflare. DreamHost's API **cannot** change NS or DS — those are manual in
  the DreamHost registrar panel. The DreamHost API only exposes
  `dns-add_record` / `dns-list_records` / `dns-remove_record`.
- **DNS authority:** Cloudflare. Zone id `602400322c1ecac4983542c76af90115`.
  Nameservers `izabella.ns.cloudflare.com` + `sullivan.ns.cloudflare.com`.
- **Serving:** GitHub Pages, **unchanged**. `static/CNAME` =
  `transscendsurvival.org`. Let's Encrypt cert (state `approved`) covers both
  apex and `www`, expires 2026-09-09.
- **DNS records in Cloudflare — GREY / DNS-only (NOT proxied):**

  | Name  | Type  | Value                                                                              |
  | ----- | ----- | ---------------------------------------------------------------------------------- |
  | apex  | A     | `185.199.108.153`, `185.199.109.153`, `185.199.110.153`, `185.199.111.153`         |
  | apex  | AAAA  | `2606:50c0:8000::153`, `2606:50c0:8001::153`, `2606:50c0:8002::153`, `2606:50c0:8003::153` |
  | `www` | CNAME | `jesssullivan.github.io`                                                            |

  The apex = A/AAAA, `www` = CNAME split is the GitHub Pages canonical shape.
  **`www` MUST be a CNAME.** `www` as A/AAAA breaks the `www` TLS handshake
  (cert presentation failure).

- **DNSSEC:** enabled on Cloudflare (zone signed). The registrar-side DS record
  is the manual completion step (see below).
- **CF Pages (`transscendsurvival-org`):** builds via
  `.github/workflows/cloudflare-pages-shadow.yml`. apex + `www` custom domains
  are **PENDING**. The Pages serving cut is **DEFERRED** — see the hard rule.

```text
DreamHost (registrar)            Cloudflare (DNS authority)         GitHub Pages (serving)
  NS -> *.ns.cloudflare.com  -->   apex A/AAAA (GitHub anycast)  -->  static/CNAME
  DS (manual, DNSSEC)              www CNAME -> *.github.io           Let's Encrypt apex+www
```

## ROLLBACK: revert NS to DreamHost

The GitHub Pages records are still **staged in the DreamHost zone**, so a
rollback is just a registrar-side NS revert — no record re-entry needed.

**When to roll back:** Cloudflare is the DNS failure mode (zone-wide SERVFAIL,
signing breakage you can't fix forward, account/billing lockout) AND DreamHost
authoritative DNS is healthy again. Do **not** roll back to escape the original
P0 — that P0 was DreamHost's authoritative platform SERVFAILing apex AAAA/SOA
with dead TCP/53; reverting NS to DreamHost reintroduces exactly that.

**DNSSEC interaction — do this FIRST:**

> If a DS record is present at the registrar, you **MUST remove the DS at the
> DreamHost registrar BEFORE reverting NS.** Otherwise validating resolvers
> follow the DS to a DNSSEC chain that DreamHost's nameservers don't serve →
> hard **SERVFAIL** for every validating client.

Order:

1. **Remove the DS** in the DreamHost registrar DNSSEC panel. Confirm it is gone
   from the parent (`.org`) before continuing:
   `dig DS transscendsurvival.org @a0.org.afilias-nst.info` → no DS.
2. **Revert NS** in the DreamHost registrar panel from the Cloudflare pair back
   to `ns1.dreamhost.com`, `ns2.dreamhost.com`, `ns3.dreamhost.com`.
3. Verify DreamHost is authoritative and serving the staged records (both
   families + SOA + TCP):

   ```sh
   dig @ns1.dreamhost.com SOA  transscendsurvival.org +short
   dig @ns1.dreamhost.com A    transscendsurvival.org +short
   dig @ns1.dreamhost.com AAAA transscendsurvival.org +short
   dig @ns1.dreamhost.com AAAA transscendsurvival.org +tcp +short
   ```

**Propagation expectation:** an NS change at the registrar is a parent-zone
(`.org`) delegation update. Allow **up to ~24–48h** for global propagation,
though most resolvers pick it up far sooner; the `.org` NS TTL bounds it. DS
removal must clear the parent before NS revert lands or validators SERVFAIL
during the overlap. Re-running DNSSEC enablement later is cheap; a stuck DS is
an outage — always pull DS first.

## DNSSEC completion (forward path)

Only after Cloudflare signing is **stable** (zone shows DNSSEC active, Cloudflare
serving RRSIG/DNSKEY):

1. In the **DreamHost registrar DNSSEC panel**, add the DS from LANDING:

   ```text
   transscendsurvival.org. IN DS 2371 13 2 E5C53E67B018ACAA709DA0AEA03C5F1E58A57059AF5D56E9BCD6A55DF224E8DB
   ```

   key_tag `2371`, algorithm `13` (ECDSAP256SHA256), digest_type `2` (SHA-256).

2. Verify the chain:

   ```sh
   dig +dnssec transscendsurvival.org @izabella.ns.cloudflare.com   # expect RRSIG
   dig DS transscendsurvival.org @a0.org.afilias-nst.info +short     # DS visible at parent
   ```

   Then confirm a clean chain end-to-end with **DNSViz**
   (`https://dnsviz.net/d/transscendsurvival.org/dnssec/`) — no SERVFAIL, no
   bogus, secure all the way to the `.org` anchor.

## HARD RULE: never flip apex to the proxied `pages.dev` CNAME live

Pointing apex at the **proxied** `transscendsurvival-org.pages.dev` CNAME caused
**two transient outages on 2026-06-22**. Root cause: the Pages custom domain
validates via **public DNS** (which lagged the NS flip), so Cloudflare's anycast
edge received apex traffic **before** the Pages custom domain was active →
connection refused / timeout.

**Do not do the live flip.** Safe future sequence for a CF Pages serving-cut:

1. Add apex + `www` as **custom domains** on the `transscendsurvival-org` Pages
   project. Let them **validate to ACTIVE** with a **cert issued** — while apex
   DNS still points at GitHub Pages anycast. (Validation rides the existing
   public DNS; serving is unaffected.)
2. Only **after** both custom domains read ACTIVE / cert-issued, change the apex
   record in Cloudflare to the Pages target, `www` staying a CNAME.
3. Have this rollback ready: point apex back to the GitHub Pages
   A/AAAA set above (still the documented values), `www` CNAME unchanged.
4. Verify both families + TLS on apex and `www` before declaring the cut done.

Never let apex resolve to `pages.dev` until the Pages domain is pre-validated
and serving.

## Going forward: change DNS via IaC, not the dashboard

Author DNS as code. Note the shipped design is **declare-then-verify**, NOT
auto-apply: `infra/cloudflare/zone.json` is the desired-state record set, and
`scripts/cf-dns-check.mts` is a **read-only drift detector** (GET only — it never
creates/updates/deletes). There is intentionally **no apply path**; mutation
stays manual.

The IaC-first loop for any DNS change:

1. **Edit `infra/cloudflare/zone.json`** first — change the desired record set
   (and `invariants` / `dnssec` if relevant) in a reviewed PR. Editing this file
   changes what "no drift" means, not the live zone.
2. **Apply the change manually** to Cloudflare (dashboard or API) to match the
   new desired state. Keep the live edit minimal and identical to the PR.
3. **Verify zero drift:** run `scripts/cf-dns-check.mts`
   (`CLOUDFLARE_API_TOKEN` in env, read-only token preferred). It fails loudly
   on a proxied apex (the 2026-06-22 cause), apex drifting off A/AAAA, `www` off
   CNAME, any declared-vs-live mismatch, or DNSSEC not active.
4. The host-agnostic checks (`scripts/check-production-health.mts`,
   `.github/workflows/production-health.yml`, the `workers/dns-guard/` Worker)
   then assert resolution health (non-empty A/AAAA/SOA over UDP + TCP).

Keep `zone.json` and the live zone in lockstep: never change one without the
other in the same change window. The declared invariant `apex_must_be_dns_only`
is what makes a live `pages.dev` re-proxy fail the drift check loudly.

## Verification one-liners

```sh
# Authoritative Cloudflare NS — both families + SOA must answer non-empty.
dig @izabella.ns.cloudflare.com AAAA transscendsurvival.org +short
dig @izabella.ns.cloudflare.com A    transscendsurvival.org +short
dig @izabella.ns.cloudflare.com SOA  transscendsurvival.org +short
dig @sullivan.ns.cloudflare.com AAAA transscendsurvival.org +short

# TCP/53 must work (the DreamHost P0 had dead TCP/53).
dig @izabella.ns.cloudflare.com AAAA transscendsurvival.org +tcp +short
dig @izabella.ns.cloudflare.com SOA  transscendsurvival.org +tcp +short

# HTTP over BOTH families — IPv6 Happy-Eyeballs visitors are the canary.
curl -4 -sSI https://transscendsurvival.org/ | head -n1
curl -6 -sSI https://transscendsurvival.org/ | head -n1
curl -4 -sSI https://www.transscendsurvival.org/ | head -n1   # www cert must present
curl -6 -sSI https://www.transscendsurvival.org/ | head -n1

# SERVFAIL repro (the original outage signature). Healthy = NOERROR + an answer;
# a SERVFAIL or empty AAAA here is the failure that broke IPv6 visitors.
dig AAAA transscendsurvival.org +short            # via your default resolver
for r in 1.1.1.1 8.8.8.8 9.9.9.9 208.67.222.222; do \
  echo "== $r =="; dig @"$r" AAAA transscendsurvival.org +noall +comments | grep -i status; \
done

# DNSSEC chain.
dig +dnssec transscendsurvival.org @izabella.ns.cloudflare.com
dig DS transscendsurvival.org @a0.org.afilias-nst.info +short

# IaC drift: live Cloudflare zone vs infra/cloudflare/zone.json (read-only, GET-only).
# Same script CI runs in .github/workflows/cloudflare-dns-drift.yml.
CLOUDFLARE_API_TOKEN=… npx tsx scripts/cf-dns-check.mts
```

## Secrets (names only — never print values)

- Lab SOPS: `["infrastructure"]["cloudflare_api_token" | "cloudflare_account_id" | "dreamhost_api_key"]`.
- CI: GitHub Actions secrets (e.g. `CLOUDFLARE_API_TOKEN`).
