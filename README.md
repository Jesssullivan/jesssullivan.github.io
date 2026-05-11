Hi! This is just my personal static github pages blog ^w^ 


| Surface | Route |
| --- | --- |
| Production | `https://transscendsurvival.org` |
| Cloudflare Pages shadow | `https://tss.tinyland.dev` |
| Alternate Cloudflare shadow | `https://tss.ephemera.tinyland.dev` |
| Tailnet-only shadow | `https://jesssullivan-blog-shadow.taila4c78d.ts.net` |
| Tailnet vanity target | `https://jesssullivan-blog-shadow.tailnet.tinyland.dev` |



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

## AP Federation Approach

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

