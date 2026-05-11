# Site Pipeline Architecture

This is the public-safe map of the repo. It keeps the real public domains and repo concepts, but it deliberately generalizes private runner labels, tailnet hostnames, account identifiers, backend buckets, deployment hashes, and credential names.

## Source To Static Output

```mermaid
flowchart LR
    subgraph Source["Source inputs"]
        Posts["src/posts Markdown"]
        Routes["SvelteKit routes"]
        Components["Svelte components"]
        StaticAssets["static files"]
        CvTex["CV TeX source"]
        PulseJson["checked Pulse snapshot"]
        TinylandPosts["checked Tinyland post snapshot"]
    end

    subgraph Prebuild["npm prebuild"]
        TinylandCheck["Tinyland post ingest check"]
        SearchIndex["generate search index"]
        ImageOpt["optimize post images"]
        MermaidRender["render Mermaid cache"]
        BlogStats["generate blog stats"]
        TagGraph["generate tag graph SVGs"]
        Gallery["generate photo gallery"]
        PulseValidate["validate Pulse snapshot"]
    end

    subgraph Compile["SvelteKit and Vite compile"]
        Mdsvex["mdsvex Markdown compile"]
        Shiki["Shiki code HTML"]
        Rehype["rehype slug and content cleanup"]
        Svelte["Svelte 5 compiler"]
        Vite["Vite via Rolldown"]
        Tailwind["Tailwind v4 plugin"]
        SkeletonCompat["Skeleton v4 compatibility transform"]
        SkeletonColors["Skeleton color utility virtual module"]
        A11yPlugin["Vite accessibility plugin"]
    end

    subgraph StaticSite["Static site output"]
        Adapter["SvelteKit adapter-static"]
        BuildDir["build directory"]
        Redirects["redirect HTML files"]
        Pagefind["Pagefind search bundle"]
        Precompressed["precompressed assets"]
    end

    TinylandPosts --> TinylandCheck
    Posts --> Mdsvex
    Routes --> Svelte
    Components --> Svelte
    StaticAssets --> ImageOpt
    PulseJson --> PulseValidate

    TinylandCheck --> SearchIndex
    SearchIndex --> ImageOpt
    ImageOpt --> MermaidRender
    MermaidRender --> BlogStats
    BlogStats --> TagGraph
    TagGraph --> Gallery
    Gallery --> PulseValidate

    Mdsvex --> Shiki
    Mdsvex --> Rehype
    Shiki --> Svelte
    Rehype --> Svelte
    Svelte --> Vite
    SkeletonCompat --> Vite
    SkeletonColors --> Vite
    Tailwind --> Vite
    A11yPlugin --> Vite
    PulseValidate --> Vite

    Vite --> Adapter
    Adapter --> BuildDir
    BuildDir --> Redirects
    BuildDir --> Pagefind
    BuildDir --> Precompressed

    CvTex --> CvWorkflow["separate Tectonic PDF workflow"]
```

## Compiler Details

```mermaid
flowchart TB
    Markdown["Markdown or svx file"] --> Mdsvex["mdsvex highlighter hook"]
    Mdsvex --> LangChoice{"Code block language"}
    LangChoice -->|"mermaid"| Hash["hash diagram source"]
    Hash --> CacheHit{"SVG exists in Mermaid cache"}
    CacheHit -->|"yes"| InlineSvg["inline cached SVG"]
    CacheHit -->|"dev or optional"| TextFallback["show diagram source as text"]
    CacheHit -->|"production strict miss"| BuildError["fail build"]
    LangChoice -->|"code"| Shiki["Shiki theme and grammar"]
    Shiki --> EscapedHtml["escaped HTML for Svelte"]

    Markdown --> Rehype["rehype passes"]
    Rehype --> Slugs["heading ids"]
    Rehype --> Picture["local post picture wrappers"]
    Rehype --> ImageDims["image width and height"]
    Rehype --> A11yNames["link and image accessibility cleanup"]
    Rehype --> MissingImages["legacy missing-image notices"]
    Rehype --> BraceEscape["brace escaping for Svelte"]

    InlineSvg --> SvelteCompile["Svelte compile"]
    TextFallback --> SvelteCompile
    EscapedHtml --> SvelteCompile
    Slugs --> SvelteCompile
    Picture --> SvelteCompile
    ImageDims --> SvelteCompile
    A11yNames --> SvelteCompile
    MissingImages --> SvelteCompile
    BraceEscape --> SvelteCompile
```

## CI And Test Pipeline

```mermaid
flowchart LR
    subgraph Entry["Workflow entrypoints"]
        PR["PR to main"]
        Main["push to main or dev"]
        Manual["manual dispatch"]
        Schedule["scheduled run"]
        Dispatch["repository dispatch"]
    end

    subgraph CoreCI["CI workflow"]
        Gitleaks["secret scan"]
        Install["npm ci"]
        StaticAudit["static production dependency audit"]
        Cache["SvelteKit cache restore"]
        Lint["eslint"]
        Check["npm run check"]
        Unit["Vitest with coverage"]
        Agent["blog-agent typecheck and tests"]
        AgentAudit["blog-agent dependency audit report"]
        PulseCore["pulse-core tests, typecheck, proto guard"]
        PulseClient["pulse-client tests and typecheck"]
        Build["npm run build"]
        RedirectCheck["redirect validation"]
        Frontmatter["frontmatter validation"]
        LinkAudit["link audit"]
        Browser["Playwright smoke or regression"]
        Bundle["bundle report"]
        Lighthouse["Lighthouse report-only"]
    end

    PR --> CoreCI
    Main --> CoreCI
    Gitleaks --> Install
    Install --> StaticAudit
    StaticAudit --> Cache
    Cache --> Lint
    Lint --> Check
    Check --> Unit
    Unit --> Agent
    Agent --> AgentAudit
    AgentAudit --> PulseCore
    PulseCore --> PulseClient
    PulseClient --> Build
    Build --> RedirectCheck
    RedirectCheck --> Frontmatter
    Frontmatter --> LinkAudit
    LinkAudit --> Browser
    Browser --> Bundle
    Bundle --> Lighthouse

    subgraph ContentAutomation["Content automation"]
        Collect["collect external posts"]
        ReviewBot["blog review bot"]
        DateGuard["future-date guard"]
        ScheduledMerge["scheduled post merge gate"]
        Stats["content analytics"]
    end

    Dispatch --> Collect
    Schedule --> Collect
    Manual --> Collect
    PR --> ReviewBot
    PR --> DateGuard
    Schedule --> ScheduledMerge
    Manual --> ScheduledMerge
    Schedule --> Stats
    Manual --> Stats

    subgraph CvLane["CV PDF lane"]
        Tectonic["Tectonic build"]
        PdfValidate["tracked and generated PDF validation"]
        PdfCommit["commit regenerated PDFs on main only"]
    end

    PR --> PdfValidate
    Main --> Tectonic
    Tectonic --> PdfValidate
    PdfValidate --> PdfCommit
```

## Deployment And Preview Targets

```mermaid
flowchart LR
    subgraph Sources["Deploy sources"]
        Main["main branch"]
        ActivePR["active same-repo PR"]
        ShadowBranch["shadow-deploy branch"]
        ManualDispatch["manual dispatch"]
    end

    subgraph Production["GitHub Pages production"]
        PagesBuild["build static artifact"]
        PagesValidate["validate redirects"]
        PagesUpload["upload Pages artifact"]
        PagesDeploy["deploy Pages environment"]
        PublicDomain["transscendsurvival.org"]
        ProfileRefresh["profile README refresh dispatch"]
    end

    Main --> PagesBuild
    ManualDispatch --> PagesBuild
    PagesBuild --> PagesValidate
    PagesValidate --> PagesUpload
    PagesUpload --> PagesDeploy
    PagesDeploy --> PublicDomain
    PagesDeploy --> ProfileRefresh

    subgraph Cloudflare["Cloudflare Pages shadow"]
        CfBuild["build and validate"]
        CfEligibility["credential and event eligibility"]
        CfDeploy["Pages shadow upload"]
        CfShadow["public-safe shadow hostname"]
    end

    Main --> CfBuild
    PRBuildOnly["PR build-only mode"] --> CfBuild
    ManualDispatch --> CfBuild
    CfBuild --> CfEligibility
    CfEligibility --> CfDeploy
    CfDeploy --> CfShadow

    subgraph Tailnet["Tailnet-only shadow preview"]
        Resolve["resolve branch, SHA, and deploy permission"]
        ImageBuild["build Dockerfile.shadow"]
        SourceImage["push public source image"]
        Scan["container scan report-only"]
        PrivateDispatch["private infra dispatch"]
        Mirror["mirror to private deploy image"]
        Apply["operator-managed apply"]
        TailnetRoute["tailnet-only review route"]
    end

    ActivePR --> Resolve
    ManualDispatch --> Resolve
    ShadowBranch --> ImageBuild
    Resolve --> ImageBuild
    ImageBuild --> SourceImage
    SourceImage --> Scan
    Scan --> PrivateDispatch
    PrivateDispatch --> Mirror
    Mirror --> Apply
    Apply --> TailnetRoute
```

## Tinyland Static Spoke And Pulse Boundary

```mermaid
flowchart TB
    subgraph Tinyland["tinyland.dev authority"]
        Workbench["operator-reviewed content records"]
        BrokerModel["Pulse broker and policy model"]
        SnapshotWriter["static projection writer"]
        PublicEdge["projection-only public edge"]
        WebFinger["WebFinger and NodeInfo"]
    end

    subgraph BlogRepo["jesssullivan.github.io consumer"]
        PostSnapshot["static/data/tinyland/posts/public-snapshot.v1.json"]
        PulseSnapshot["static/data/pulse/public-snapshot.v1.json"]
        IngestScript["ingest-tinyland-posts check"]
        Posts["src/posts materialized Markdown"]
        PulseRoute["/pulse"]
        LiveClient["/pulse/client/brokered-stream"]
    end

    subgraph PublicSite["Rendered site"]
        BlogRoutes["blog routes"]
        PulseFeed["public Pulse feed"]
        HiddenDemo["hidden noindex live demo"]
    end

    Workbench --> SnapshotWriter
    BrokerModel --> SnapshotWriter
    SnapshotWriter --> PostSnapshot
    SnapshotWriter --> PulseSnapshot
    SnapshotWriter --> PublicEdge
    PublicEdge --> WebFinger

    PostSnapshot --> IngestScript
    IngestScript --> Posts
    Posts --> BlogRoutes
    PulseSnapshot --> PulseRoute
    PulseRoute --> PulseFeed
    PublicEdge --> LiveClient
    LiveClient --> HiddenDemo

    HiddenDemo --> ProjectionOnly["AP-shaped projection only"]
    ProjectionOnly --> NotFediverse["not ActivityPub delivery"]
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

## Package And Workspace Shape

```mermaid
flowchart LR
    Root["root npm workspace"] --> Site["SvelteKit site"]
    Root --> BlogAgent["packages/blog-agent"]
    Root --> PulseCore["packages/pulse-core"]
    Root --> PulseClient["packages/pulse-client"]

    PulseCore --> Proto["hand-authored Pulse proto"]
    PulseCore --> Schema["Zod runtime schemas"]
    PulseCore --> Policy["public-data policy"]
    PulseCore --> Broker["in-memory broker mock"]
    PulseCore --> Publisher["AP-shaped demo publisher"]
    PulseCore --> Pbt["unit and property tests"]

    PulseClient --> Drafts["draft and outbox model"]
    PulseClient --> Identity["client identity adapter"]
    PulseClient --> Media["media intent adapter"]
    PulseClient --> Storage["browser storage parser"]

    BlogAgent --> Review["PR prose review"]
    BlogAgent --> Commands["schedule, publish, draft, retitle commands"]

    Site --> PulseCore
    Site --> PulseClient
    Site --> BlogAgent
```

## Public-Safety Notes

- Public repo docs should name public domains and public GitHub workflow concepts.
- Public repo docs should not include private tailnet hostnames, private backend endpoints, cloud account identifiers, credential values, full deployment hashes, or local absolute paths.
- Secret and variable names are generalized here as credential gates unless they are necessary to understand a public workflow behavior.
- The live Pulse/AP demo is described as AP-shaped projection only. It is not described as real Fediverse delivery.
