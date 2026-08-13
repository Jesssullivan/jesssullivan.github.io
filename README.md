Hi! This is just my boring personal static blog ^w^ 

[![dns guard](https://img.shields.io/endpoint?url=https%3A%2F%2Ftransscend-dns-guard.jess-fdc.workers.dev%2Fbadge)](https://transscendsurvival.org) [![production health](https://github.com/Jesssullivan/jesssullivan.github.io/actions/workflows/production-health-v2.yml/badge.svg)](https://github.com/Jesssullivan/jesssullivan.github.io/actions/workflows/production-health-v2.yml)


| Surface | Route |
| --- | --- |
| Production | `https://transscendsurvival.org` (Cloudflare Pages via proxied apex CNAME) |
| GitHub Pages manual rollback | `https://jesssullivan.github.io` / `static/CNAME` |
| Cloudflare Pages shadow | `https://tss.tinyland.dev` (development shadow) |
| Alternate Cloudflare shadow | `https://tss.ephemera.tinyland.dev` |
| Tailnet-only shadow | `https://jesssullivan-blog-shadow.taila4c78d.ts.net` |
| Tailnet vanity target | `https://jesssullivan-blog-shadow.tailnet.tinyland.dev` |


## Build Chain

The build produces a static SvelteKit artifact. Tinyland snapshots and local
Markdown remain first-paint, no-JS, and regression fixtures; canonical blog and
Pulse display hydrates in the browser from the public Tinyland broker when it is
available. `transscendsurvival.org` is the production consumer today and is served
by Cloudflare Pages through the proxied apex CNAME. GitHub Pages is retained only
as a disabled-by-default, explicitly manual rollback publisher.

```mermaid
flowchart LR
    Posts["src/posts Markdown"] --> Mdsvex["mdsvex"]
    TinylandPosts["Tinyland post snapshot fixture"] --> Ingest["fallback ingest check"]
    PulseJson["Pulse public snapshot fixture"] --> PulseCheck["snapshot validator"]
    Static["static assets"] --> Images["image optimization"]
    Routes["SvelteKit routes"] --> Svelte["Svelte 5 compiler"]

    Mdsvex --> Shiki["Shiki"]
    Mdsvex --> Mermaid["Mermaid cache"]
    Mdsvex --> Rehype["rehype cleanup"]
    Ingest --> Prebuild["prebuild"]
    Shiki --> Prebuild
    Mermaid --> Prebuild
    Rehype --> Prebuild
    Images --> Prebuild
    PulseCheck --> Prebuild

    Prebuild --> Vite["Vite via Rolldown"]
    Svelte --> Vite
    Vite --> Tailwind["Tailwind v4"]
    Vite --> Skeleton["Skeleton utilities"]
    Vite --> A11y["a11y plugin"]
    Tailwind --> Adapter["adapter-static"]
    Skeleton --> Adapter
    A11y --> Adapter
    Adapter --> Build["build/"]
    Build --> Redirects["redirect pages"]
    Build --> Pagefind["Pagefind index"]
    Build --> RuntimeHydration["browser runtime hydration"]
    HubBlog["hub.tinyland.dev blog broker stream"] --> RuntimeHydration
    HubPulse["hub.tinyland.dev Pulse public snapshot"] --> RuntimeHydration
    RuntimeHydration --> Blog["/blog and /blog/[slug]"]
    RuntimeHydration --> PulseRoute["/pulse"]

    CvTex["CV TeX"] --> Tectonic["Tectonic PDF workflow"]
```

## Icon Kit

Browser icons are generated from `https://github.com/Jesssullivan.png` by
`npm run icons:generate`. The script pins the fetched source at
`static/icons/favicon-source.jpg`, writes the favicon/Apple/Android/maskable
PNG set, emits the multi-size `favicon.ico`, and keeps the web app manifest,
Safari mask, and Microsoft tile config in `static/`.

## Checks And Deploys

```mermaid
flowchart LR
    PR["PR to main"] --> CI["CI"]
    Main["main push"] --> CI
    CI --> Scan["secret scan"]
    Scan --> Audit["prod dependency audit"]
    Audit --> Lint["lint"]
    Lint --> Check["svelte-check and validators"]
    Check --> Unit["Vitest"]
    Unit --> Pulse["pulse-core and pulse-client"]
    Pulse --> Agent["blog-agent"]
    Agent --> Build["npm run build"]
    Build --> StaticChecks["redirect, frontmatter, link, bundle checks"]
    StaticChecks --> Browser["Playwright smoke or regression"]
    Browser --> Lighthouse["Lighthouse report-only"]

    Main --> CfEvidence["Cloudflare production build evidence"]
    CfEvidence --> CfProdRequest["typed exact-main deploy request + live gate"]
    CfProdRequest --> CfProd["Cloudflare Pages production deploy"]
    CfProd --> Prod["transscendsurvival.org"]

    RollbackRequest["typed confirmed exact-main rollback request"] --> Pages["GitHub Pages rollback publish"]
    Pages --> PagesMirror["jesssullivan.github.io"]

    ManualParity["typed exact open-PR + SHA parity request"] --> CfBuild["secretless Cloudflare parity build"]
    TssReview["reviewed exact-SHA TSS artifact"] --> CfShadow["explicit tss-shadow apply"]
    CfShadow --> Shadow["tss.tinyland.dev — public noindex shadow"]

    ManualPR["typed exact open-PR + SHA request"] --> Preview["unprivileged shadow source build"]
    Preview --> SourceImage["gated exact-SHA source image"]
    SourceImage --> End["immutable publication evidence; no apply lane"]
```

## GloriousFlywheel Bazel Substrate Surface

This repo still uses the npm/SvelteKit workflow for normal local development and deployment. CI also carries a blocking GloriousFlywheel Bazel lane on the `tinyland-dind` ARC runner so check, test, and Chromium e2e coverage are not proven only by local `npm`/`npx` commands.

- `npm run remote:check`, `npm run remote:test`, and `npm run remote:e2e` route through `scripts/bazel-cache-backed.sh`, which refuses to run without a valid `BAZEL_REMOTE_CACHE` and the expected GloriousFlywheel substrate mode.
- Local developer shells attach through the endpoint-free GloriousFlywheel front-door kit (`justfile.flywheel` plus `.bazelrc.flywheel`). The managed Nix/Home Manager profile is the preferred source of `BAZEL_REMOTE_CACHE` and auth metadata; a gitignored `.env.flywheel.local` generated by `just flywheel-enroll ...` is only the fallback fixture, and is sourced by both `.envrc` and `scripts/bazel-cache-backed.sh`.
- GitHub CI runs the Bazel lane on `tinyland-dind` as the `shared-cache-backed` consumer recorded in the GloriousFlywheel registry. Pull requests mint cache-read tokens and disable result uploads; trusted `main` pushes mint cache-write tokens. Generic-runner executor hints are cleared so the workflow cannot silently claim executor-backed behavior.
- Shared-cache CI runs one local Bazel action at a time, caps the Bazel host JVM at 2560 MiB and each Node action at 1024 MiB, and serializes local test actions. It shuts the Bazel server down between public check, test, and e2e phases so retained analysis state cannot grow across the entire job. The hosted gate allows 90 minutes because this reliability-first envelope trades wall-clock speed for runner survival.
- PR CI calls the `remote:*:public` commands, which append `--ignore_dev_dependency`; neither the private `spear_resumes` repository nor its deploy key enters the PR graph. A default-owned exact-main workflow separately runs `//static/cv:pdfs_synced_test` with the read-only deploy key. That hosted consistency check is a private-source prerequisite, while GloriousFlywheel remains the public Bazel authority.
- Executor-backed mode remains available in the wrapper only as a separate opt-in contract. It requires a reviewed GloriousFlywheel registry promotion plus an explicit executor endpoint; this repository's normal CI does not use it.
- `gf-reapi-cell` endpoints also require scoped Bazel credential-helper auth. `scripts/bazel-cache-backed.sh` attaches `scripts/gf-reapi-bazel-credential-helper.mjs` only for the GF REAPI host, and the helper reads a short-lived JWT from `GF_REAPI_CREDENTIAL_HELPER_TOKEN_FILE`, `GF_REAPI_CREDENTIAL_HELPER_TOKEN`, or the projected-token file at `/var/run/secrets/tokens/gf-reapi-cell-token`.
- The token exchange supplies the repository-scoped `BAZEL_REMOTE_INSTANCE_NAME`. Literal shell placeholders are rejected before Bazel starts.
- `//:sveltekit_check` runs the SvelteKit check path under Bazel.
- `//static/cv:pdfs_synced_test` byte-compares the checked-in resume/CV PDFs against the Bazel-built `spear_resumes` outputs; `.bazelrc` pins `SOURCE_DATE_EPOCH` and `TZ` so Tectonic output stays reproducible across local sync, shared-cache CI, and explicit executor proofs.
- `//:vitest_unit_tests` wraps the root and Pulse Vitest suites through `vitest.bazel.config.ts`.
- `//:blog_agent_node_tests` wraps the blog-agent `node:test` suite through `tsx --test`.
- `//:sveltekit_vite_build_smoke` runs a copied-workdir SvelteKit/Vite production build smoke. It proves the build target class, not the full npm prebuild/postbuild publication chain.
- `//:playwright_chromium_e2e` runs the Chromium Playwright e2e suite through Bazel. Shared-cache CI provisions the package-lock-pinned Playwright browser before Bazel starts and passes its absolute executable path into the local test action.
- `//:playwright_chromium_smoke` remains a narrow diagnostic target for browser runtime authority, not the remote e2e gate.
- `//:puppeteer_chromium_smoke` launches Puppeteer against the same pinned Chromium runtime path. It proves Puppeteer and Playwright consume one explicit browser authority rather than relying on an undeclared host path.
- `package-lock.json` remains the npm dependency authority for the app. `pnpm-workspace.yaml` makes the package importers explicit for Bazel, and `pnpm-lock.yaml` is the generated `rules_js` lock consumed by Bazel.
- Bazel npm lifecycle hooks skip Playwright and Puppeteer browser downloads. Shared-cache CI provisions the lockfile-pinned Playwright browser outside Bazel actions; browser-backed RBE continues to use the pinned worker Chromium path and never downloads a browser inside proof actions.
- GloriousFlywheel proof runs use the external GF REAPI proof harness or the repository `remote:*` scripts against this public repo checkout; remote cache hits, hosted runners, and shared-cache-only execution do not count as RBE.

Current boundary: GloriousFlywheel gates the public Bazel check/test/Chromium-e2e graph with shared-cache attachment. A separate hosted default-owned workflow checks private CV PDF drift. This does not claim remote action execution. Production publication uses the exact-SHA Cloudflare Pages workflow; GitHub Pages is manual rollback only.

## Production DNS And Health

`transscendsurvival.org` is served by Cloudflare Pages at the apex and `www`,
with Cloudflare as the registrar, DNS authority, and DNSSEC signer as of
2026-06-23 (the registration moved off DreamHost). The declared Cloudflare zone
keeps both the apex and `www` as proxied CNAMEs to
`transscendsurvival-org.pages.dev`; `www` serves the blog with a canonical link
to the apex. DNSSEC is active — Cloudflare Registrar publishes the parent DS.

`npm run test:production-health` checks delegated authoritative DNS, major public
resolvers, direct HTTPS against resolved IPv4 targets, apex/`www` HTTPS responses
and redirects, live responses for the homepage plus slashless and trailing-slash
blog routes, the Tinyland blog broker contract, and browser hydration on `/blog`.
At the authoritative layer, apex and `www` must both expand to public A/AAAA
answers (Cloudflare anycast) for visitors. Direct operator-controlled DNS drift
checks assert the exact apex and `www` CNAME targets and proxy posture; the
legacy scheduled workflow is retired with no successor.
The static build keeps slashless canonical URLs but emits directory-index aliases
so copied, normalized, or legacy trailing-slash links do not 404. The
`Production Health v2` workflow runs every 30 minutes. It does not publish or
self-heal GitHub Pages. When `NTFY_TOPIC_URL` and optional `NTFY_TOKEN`
repository secrets are configured, it mirrors production-health failures to the
same ntfy topic used by the DNS guard Worker before failing the job. To prove
alert delivery without breaking the site, emit the typed `production-health-v2`
repository dispatch with `client_payload.send_ntfy_smoke="true"`; that sends a harmless ntfy smoke
notification and then runs the normal health checks.

This monitoring catches missing A/AAAA records, split-brain authority during
DNS changes, stale Cloudflare proxy targets that fail TLS, broken redirects, and
blog hydration regressions. Direct `scripts/cf-dns-check.mts` runs catch
record-level drift against `infra/cloudflare/zone.json`.

If production-health is red while apex routes and broker hydration pass, do not
weaken the checks. Reconcile live DNS/serving against
[docs/runbooks/dns-cutover-and-rollback.md](docs/runbooks/dns-cutover-and-rollback.md)
or change the desired posture in review first.

Automated stats commits and their Pages dispatch are retired. Stats generation
is parked as manual local work. Publication follows the canonical Cloudflare
production path and its exact-SHA CI and operator gates.


## Content Authority And Fallback Automation

```mermaid
flowchart LR
    Author["Jess edits greymatter in tinyland.dev"] --> Tinyland["tinyland.dev content authority"]
    Tinyland --> HubStream["hub.tinyland.dev broker stream"]
    HubStream --> RuntimeBlog["/blog runtime hydration"]

    Tinyland --> StaticSnapshots["checked snapshot fixtures"]
    StaticSnapshots --> FirstPaint["static first paint and no-JS fallback"]

    SourceRepo["reviewed legacy source repo posts"] --> Collect["manual collector tool"]
    Collect --> DraftPR["operator-authored fallback PR"]
    DraftPR --> Human["review before merge"]
```

Cross-repo collection is legacy/static intake for fallback content. It is not the
primary authoring path for Tinyland-managed posts.

## Brokered Display And Federation Boundary

```mermaid
flowchart TB
    TinylandEditor["tinyland.dev blog editor"] --> Greymatter["content/users/jesssullivan greymatter"]
    Greymatter --> BlogBroker["hub.tinyland.dev blog broker stream"]
    BlogBroker --> BlogRuntime["production + shadow /blog and /blog/[slug] runtime display"]

    PulseBroker["Tinyland Pulse broker/public policy"] --> PulseSnapshot["hub.tinyland.dev Pulse public snapshot"]
    PulseSnapshot --> PulseRuntime["CF Pages /pulse runtime refresh"]

    StaticFixtures["checked-in snapshots and src/posts"] --> FirstPaint["static first paint/fallback"]
    FirstPaint --> BlogRuntime
    FirstPaint --> PulseRuntime

    BlogBroker --> DisplayOnly["brokered display only"]
    PulseSnapshot --> DisplayOnly
    DisplayOnly --> NotFederation["not public Fediverse delivery"]

    ApLab["/pulse/client/brokered-stream"] --> ApDemo["AP-shaped hidden lab demo"]
    ApDemo --> NotFederation

    HubDiscovery["hub.tinyland.dev WebFinger and NodeInfo"] --> DiscoveryOnly["public discovery/projection metadata"]
    DiscoveryOnly --> NotFederation
```


## Pulse Lifecycle

```mermaid
stateDiagram-v2
    [*] --> draft
    draft --> accepted: submit
    draft --> failed: fail
    accepted --> queued: queue
    accepted --> public_projected: project_public
    accepted --> hidden: mark_hidden
    accepted --> updated: supersede
    accepted --> failed: fail
    queued --> enriched: enrich
    queued --> failed: fail
    enriched --> public_projected: project_public
    enriched --> hidden: mark_hidden
    enriched --> updated: supersede
    enriched --> failed: fail
    public_projected --> updated: supersede
    public_projected --> deleted: delete_public
    public_projected --> failed: fail
    hidden --> updated: supersede
    hidden --> failed: fail
    updated --> failed: fail
    deleted --> tombstoned: tombstone
    deleted --> failed: fail
    tombstoned --> [*]
    failed --> [*]
```
