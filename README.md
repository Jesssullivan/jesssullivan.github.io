Hi! This is just my boring personal static blog ^w^ 


| Surface | Route |
| --- | --- |
| Production | `https://transscendsurvival.org` |
| Cloudflare Pages shadow | `https://tss.tinyland.dev` |
| Alternate Cloudflare shadow | `https://tss.ephemera.tinyland.dev` |
| Tailnet-only shadow | `https://jesssullivan-blog-shadow.taila4c78d.ts.net` |
| Tailnet vanity target | `https://jesssullivan-blog-shadow.tailnet.tinyland.dev` |


## Build Chain

```mermaid
flowchart LR
    Posts["src/posts Markdown"] --> Mdsvex["mdsvex"]
    TinylandPosts["Tinyland post snapshot"] --> Ingest["ingest check"]
    PulseJson["Pulse public snapshot"] --> PulseCheck["snapshot validator"]
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
- `//:playwright_chromium_smoke` launches Playwright against the pinned GloriousFlywheel Chromium runtime path. It is a browser-runtime smoke target, not the full hosted Playwright regression suite.
- `//:puppeteer_chromium_smoke` launches Puppeteer against the same pinned Chromium runtime path. It proves Puppeteer can consume browser runtime authority without lifecycle downloads.
- `package-lock.json` remains the npm dependency authority for the app. `pnpm-lock.yaml` is the generated `rules_js` lock consumed by Bazel.
- Bazel npm lifecycle hooks skip Playwright and Puppeteer browser downloads. Browser-backed RBE must use the pinned worker Chromium path rather than downloading browsers during proof actions.
- GloriousFlywheel proof runs should use the external GF REAPI proof harness against this public repo checkout.

Current boundary: this proves narrow public SvelteKit/Vite/Vitest, Playwright/Chromium, and Puppeteer/Chromium target classes for remote execution evidence. It does not prove default repo-wide RBE, the full hosted Playwright suite, the full SvelteKit build, or deployment.



## Content Automation

```mermaid
flowchart LR
    SourceRepo["source repo blog/docs/posts"] --> Notify["repository_dispatch"]
    Notify --> Collect["collect-posts workflow"]
    Collect --> DraftPR["draft content PR"]
    DraftPR --> Bot["blog-agent review"]
    DraftPR --> DateGuard["future-date guard"]
    Bot --> Human["review and edit"]
    DateGuard --> Human
    Human --> Schedule["scheduled label and PR body gate"]
    Schedule --> AutoMerge["daily auto-merge check"]
    AutoMerge --> Main["main"]
```

## Federation Approach

```mermaid
flowchart TB
    Tinyland["tinyland.dev projection authority"] --> PostSnapshot["reviewed post snapshot"]
    Tinyland --> PulseSnapshot["public Pulse snapshot"]
    Tinyland --> StreamDemo["AP-shaped stream demo"]
    Tinyland --> Edge["projection-only public edge"]
    Edge --> WebFinger["WebFinger and NodeInfo"]

    PostSnapshot --> IngestPosts["materialize checked posts"]
    IngestPosts --> Blog["/blog"]

    PulseSnapshot --> PulseRoute["/pulse"]
    StreamDemo --> HiddenLab["/pulse/client/brokered-stream"]

    HiddenLab --> Boundary["projection demo only"]
    Boundary --> NotFederation["not public Fediverse delivery"]
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
