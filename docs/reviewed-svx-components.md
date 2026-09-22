# Reviewed interactive SVX components

Public Tinyland blog content remains Markdown/SVX text. It never contains a
Svelte import, a component file path, script source, event handler, dynamic
component name, or a payload that the spoke evaluates. The Jess static
projection importer owns all component imports.

The first reviewed component is `InlineDisclosure`. An operator-authored,
reviewed post may use this native SVX form:

````svx
<InlineDisclosure label="Show the tested command" defaultOpen={false}>

```sh
nix develop --command npm run check
```

The full Markdown body remains here.

</InlineDisclosure>
````

Only `label` (a non-empty quoted string of at most 160 characters) and
`defaultOpen` (an optional literal boolean) are accepted. Components cannot
nest. The static importer rejects unknown component names, malformed props,
Svelte special elements/directives, imports, scripts, and event handlers. Code
fences remain literal examples and are not treated as executable document
surface.

For a reviewed record with this invocation, Tinyland's checked static snapshot
must set `targetFile` to `src/posts/<slug>.svx`. The importer validates the
content and adds the sole repository-owned import:

```svelte
import InlineDisclosure from '$lib/components/InlineDisclosure.svelte';
```

That produces the normal statically prerendered article path. Before JavaScript
the disclosure body is expanded and readable. On hydration, `defaultOpen` is
applied through an accessible button with `aria-expanded`; keyboard activation
keeps the body available. The dynamic broker remains an enhancement only. It
uses the same validation and converts the approved invocation to native
`<details>` markup because it cannot compile Svelte at request time.

The minimal Tinyland follow-up before an operator publishes this syntax is to
preserve these reviewed native-SVX tags verbatim in `contentMarkdown`, validate
the same allowlist at projection review, and emit the existing `targetFile` as
`.svx` for records that contain a reviewed component. No broker schema field,
spoke mutation API, or runtime backend is required.
