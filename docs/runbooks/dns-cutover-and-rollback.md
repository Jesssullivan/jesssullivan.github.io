# Runbook: transscendsurvival.org DNS cutover & rollback

Operational runbook for the apex/`www` domain of this site. Spelling is
**tranSScend** (double-s) — not a typo.

## Current verified state (2026-06-23)

- **Registrar:** DreamHost. The `.org` parent currently delegates to
  `izabella.ns.cloudflare.com` and `sullivan.ns.cloudflare.com`.
  DreamHost's API **cannot** change NS or DS — those are manual in the
  DreamHost registrar panel. The DreamHost API only exposes `dns-add_record` /
  `dns-list_records` / `dns-remove_record`.
- **Current DNS authority:** Cloudflare zone
  `602400322c1ecac4983542c76af90115`.
- **Desired serving posture:** Cloudflare Pages serves the apex. GitHub Pages
  remains the rollback publisher (`static/CNAME` = `transscendsurvival.org`) and
  `www` remains the DNS-only GitHub Pages CNAME redirect path.
- **Desired DNS records in Cloudflare:**

  | Name  | Type  | Value                                                                              |
  | ----- | ----- | ---------------------------------------------------------------------------------- |
  | apex  | CNAME | `transscendsurvival-org.pages.dev` (proxied / orange-cloud)                        |
  | `www` | CNAME | `jesssullivan.github.io` (DNS-only / grey-cloud)                                   |

  The apex CNAME is intentionally proxied because the Cloudflare Pages custom
  domain is active and serving. **`www` MUST remain a DNS-only CNAME.** `www` as
  A/AAAA breaks the `www` TLS handshake (cert presentation failure), and proxied
  `www` would make the secondary surface independent instead of a simple
  canonical redirect.

- **Resolved drift on 2026-06-23:** `www.transscendsurvival.org` had been left
  attached to the Cloudflare Pages project and was resolving through Cloudflare
  edge A/AAAA instead of the declared `jesssullivan.github.io` CNAME. The live
  fix restored `www` to a DNS-only CNAME. The apex was then cut to the validated
  Cloudflare Pages custom domain and is declared in
  `infra/cloudflare/zone.json`. `/blog` browser hydration passes against the
  public Tinyland broker.
- **DNSSEC:** no DS is present at the `.org` parent right now. Do not add a
  Cloudflare DS until Cloudflare signing is stable and the chain is verified.
- **CF Pages (`transscendsurvival-org`):** builds via
  `.github/workflows/cloudflare-pages-shadow.yml`. The production apex hostname
  is attached and active. `www` is intentionally not the production serving
  surface; keep it on the GitHub Pages CNAME redirect path unless a separate
  reviewed cut changes that posture. Shadow domains `tss.tinyland.dev` and
  `tss.ephemera.tinyland.dev` may stay attached.

```text
DreamHost (registrar)          Cloudflare DNS (current)          Cloudflare Pages
  NS -> Cloudflare pair    -->  proxied apex CNAME          -->   transscendsurvival-org

www remains DNS-only:
  www CNAME -> jesssullivan.github.io -> 301 to https://transscendsurvival.org/
```

## ROLLBACK: revert apex serving to GitHub Pages

This is the normal application-level rollback if Cloudflare Pages serving
regresses but Cloudflare DNS authority is healthy. Do **not** revert NS for an
application-level Pages issue.

Replace the proxied apex CNAME with the GitHub Pages A/AAAA set, keeping `www`
unchanged:

| Name | Type | Value | Proxy |
| ---- | ---- | ----- | ----- |
| apex | A | `185.199.108.153`, `185.199.109.153`, `185.199.110.153`, `185.199.111.153` | DNS-only |
| apex | AAAA | `2606:50c0:8000::153`, `2606:50c0:8001::153`, `2606:50c0:8002::153`, `2606:50c0:8003::153` | DNS-only |
| `www` | CNAME | `jesssullivan.github.io` | DNS-only |

After the live change, update `infra/cloudflare/zone.json` back to the GitHub
Pages posture in review, run `scripts/cf-dns-check.mts`, then run
`npm run test:production-health`.

## ROLLBACK: revert authority to DreamHost

The GitHub Pages records are still **staged in the DreamHost zone**, so a
rollback from the current Cloudflare NS delegation is a registrar-side NS revert
— no record re-entry needed if the staged DreamHost zone still matches the table
above. If the parent already shows DreamHost, there is nothing to roll back at
the delegation layer.

**When to roll back:** Cloudflare is the DNS failure mode (zone-wide SERVFAIL,
signing breakage you can't fix forward, account/billing lockout) AND DreamHost
authoritative DNS is healthy again. Do **not** roll back casually to escape
application-level, Pages-custom-domain, or `www` canonical drift; those are
record/serving bugs. Also do **not** roll back to escape the original P0 unless
DreamHost has been re-verified healthy, because that P0 was DreamHost's
authoritative platform SERVFAILing apex AAAA/SOA with dead TCP/53.

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
   to `ns1.dreamhost.com`, `ns2.dreamhost.com`, `ns3.dreamhost.com`. Skip this
   if the `.org` parent already returns the DreamHost nameservers.
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

Only after the `.org` parent shows Cloudflare NS and Cloudflare signing is
**stable** (zone shows DNSSEC active, Cloudflare serving RRSIG/DNSKEY):

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

## HARD RULE: never proxy apex before the Pages custom domain is active

Pointing apex at the **proxied** `transscendsurvival-org.pages.dev` CNAME caused
**two transient outages on 2026-06-22**. Root cause: the Pages custom domain
validates via **public DNS** (which lagged the NS flip), so Cloudflare's anycast
edge received apex traffic **before** the Pages custom domain was active →
connection refused / timeout.

That does **not** mean "proxied apex is always wrong." It means the order
matters. The safe sequence for any future CF Pages serving-cut is:

1. Add apex + `www` as **custom domains** on the `transscendsurvival-org` Pages
   project. Let them **validate to ACTIVE** with a **cert issued** — while apex
   DNS still points at GitHub Pages anycast. (Validation rides the existing
   public DNS; serving is unaffected.)
2. Only **after** the custom domain reads ACTIVE / cert-issued, change the apex
   record in Cloudflare to the Pages target. Keep `www` a DNS-only CNAME unless
   a separate reviewed cut changes it.
3. Have this rollback ready: point apex back to the GitHub Pages
   A/AAAA set above (still the documented values), `www` CNAME unchanged.
4. Verify both families + TLS on apex and `www` before declaring the cut done.

Never let apex resolve to proxied `pages.dev` until the Pages domain is
pre-validated and serving. Once that is true and `zone.json` declares the Pages
posture, the drift guard is inverted: apex **must** remain the proxied Pages
CNAME, and a grey apex is a regression.

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
   on apex proxy-posture drift, apex drifting off its declared type/target, `www`
   off CNAME, any declared-vs-live mismatch, or DNSSEC disabled. DNSSEC pending
   is a warning while the registrar DS is not yet installed.
4. The host-agnostic checks (`scripts/check-production-health.mts`,
   `.github/workflows/production-health.yml`, the `workers/dns-guard/` Worker)
   then assert resolution health (non-empty A/AAAA/SOA over UDP + TCP).

Keep `zone.json` and the live zone in lockstep: never change one without the
other in the same change window. The declared apex posture controls the guard:
GitHub Pages rollback mode forbids a proxied apex; Cloudflare Pages mode
requires the proxied apex CNAME target.

## Cloudflare API auth rule

Use least-privilege API tokens. Do **not** ask for, store, or use a Cloudflare
Global API Key for this repo.

Cloudflare documents the Pages REST API with `Authorization: Bearer
$CLOUDFLARE_API_TOKEN` and `Pages Read` / `Pages Write` permissions. Cloudflare
also documents Global API Keys as a legacy auth scheme with the same full
permissions as the user and recommends API tokens when possible.

If a production Pages/DNS change must be made by API rather than the dashboard,
use a short-lived token scoped only to the target account/zone. Start with:

- Account: Cloudflare Pages Write/Edit for the `transscendsurvival-org` Pages
  project.
- Zone: DNS Write/Edit for `transscendsurvival.org`.
- Zone: Zone Read for `transscendsurvival.org`.
- Add SSL/TLS certificate permissions only if the specific endpoint returns a
  permission error that names that permission.

Before any mutation, verify the token with read-only calls. During mutation,
log only endpoint paths, status codes, object IDs, and Cloudflare Ray IDs. Never
log token values or authorization headers.

## Verification one-liners

```sh
# Current parent delegation — this is the real public authority today.
dig NS transscendsurvival.org @a0.org.afilias-nst.info +short
dig DS transscendsurvival.org @a0.org.afilias-nst.info +short

# Current Cloudflare authority — both families + SOA must answer non-empty.
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
- Never use broad SOPS decrypts for debugging, including `sops -d`, `sops --decrypt`,
  or `sops ... | grep`. Extract one key by path with `sops --extract`, put it in
  an environment variable without echoing it, and unset it after use.
- If a credential value is exposed in a terminal transcript, chat transcript, CI
  log, or PR comment, treat it as compromised. Revoke or rotate the credential,
  then update SOPS and CI secrets with the replacement.
