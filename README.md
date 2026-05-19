Hi! This is just my boring personal static blog ^w^ 


| Surface | Route |
| --- | --- |
| Production | `https://transscendsurvival.org` (current production, GitHub Pages) |
| Cloudflare Pages shadow | `https://tss.tinyland.dev` (development shadow) |
| Alternate Cloudflare shadow | `https://tss.ephemera.tinyland.dev` |
| Tailnet-only shadow | `https://jesssullivan-blog-shadow.taila4c78d.ts.net` |
| Tailnet vanity target | `https://jesssullivan-blog-shadow.tailnet.tinyland.dev` |


## Build Chain

The build produces a static SvelteKit artifact. Tinyland snapshots and local
Markdown remain first-paint, no-JS, and regression fixtures; canonical blog and
Pulse display hydrates in the browser from the public Tinyland broker when it is
available. `transscendsurvival.org` is the production consumer today even while
it is still served by GitHub Pages; `tss.tinyland.dev` is the Cloudflare Pages
development shadow until the production cutover is explicitly proven.

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

    Main --> Pages["GitHub Pages deploy"]
    Pages --> Prod["transscendsurvival.org"]
    Pages --> Profile["profile refresh dispatch"]

    Main --> CfShadow["Cloudflare Pages shadow"]
    CfShadow --> Tss["tss.tinyland.dev"]
    CfShadow --> Ephemera["tss.ephemera.tinyland.dev"]

    PR --> Preview["shadow preview"]
    Preview --> SourceImage["public source image"]
    SourceImage --> PrivateMirror["private deploy mirror"]
    PrivateMirror --> Tailnet["jesssullivan-blog-shadow.taila4c78d.ts.net"]
```

## GloriousFlywheel Bazel/RBE Pilot Surface

This repo still uses the npm/SvelteKit workflow for normal local development and deployment. The Bazel files are a narrow GloriousFlywheel consumer proof surface, not a wholesale migration of the blog build.

- `//:types_unit_tests` wraps Vitest through `vitest.bazel.config.ts` and runs the existing `src/lib/types.test.ts` slice.
- `//:sveltekit_vite_build_smoke` runs a copied-workdir SvelteKit/Vite production build smoke. It proves the build target class, not the full npm prebuild/postbuild publication chain.
- `//:playwright_chromium_smoke` launches Playwright against the pinned GloriousFlywheel Chromium runtime path. It is a browser-runtime smoke target, not the full hosted Playwright regression suite.
- `//:puppeteer_chromium_smoke` launches Puppeteer against the same pinned Chromium runtime path. It proves Puppeteer can consume browser runtime authority without lifecycle downloads.
- `package-lock.json` remains the npm dependency authority for the app. `pnpm-lock.yaml` is the generated `rules_js` lock consumed by Bazel.
- Bazel npm lifecycle hooks skip Playwright and Puppeteer browser downloads. Browser-backed RBE must use the pinned worker Chromium path rather than downloading browsers during proof actions.
- GloriousFlywheel proof runs should use the external GF REAPI proof harness against this public repo checkout.

Current boundary: this proves narrow public SvelteKit/Vite/Vitest, SvelteKit/Vite build-smoke, Playwright/Chromium, and Puppeteer/Chromium target classes for remote execution evidence. It does not prove default repo-wide RBE, the full hosted Playwright suite, the full npm prebuild/postbuild publication chain, or deployment.



## Content Authority And Fallback Automation

```mermaid
flowchart LR
    Author["Jess edits greymatter in tinyland.dev"] --> Tinyland["tinyland.dev content authority"]
    Tinyland --> HubStream["hub.tinyland.dev broker stream"]
    HubStream --> RuntimeBlog["/blog runtime hydration"]

    Tinyland --> StaticSnapshots["checked snapshot fixtures"]
    StaticSnapshots --> FirstPaint["static first paint and no-JS fallback"]

    SourceRepo["legacy source repo posts"] --> Notify["repository_dispatch"]
    Notify --> Collect["collect-posts workflow"]
    Collect --> DraftPR["draft fallback PR"]
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
