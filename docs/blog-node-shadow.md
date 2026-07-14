# Blog node-backend shadow

Tailnet-only SHADOW that runs the blog as a SvelteKit `adapter-node` server
container instead of the static build. For QA of server-rendered routes and
live endpoints (e.g. `/healthz`) that the static artifact cannot serve.

## Adapter selection

`svelte.config.js` picks the adapter from `BLOG_ADAPTER`:

- unset / anything else -> `@sveltejs/adapter-static` (default, production)
- `BLOG_ADAPTER=node` -> `@sveltejs/adapter-node` (server bundle `build/index.js`)

## Build the node image

```
podman build -t blog-node:dev -f Containerfile.node .
```

`Containerfile.node` builds with `BLOG_ADAPTER=node`, runs as non-root uid 1000
under `tini`, listens on `PORT=3000`, and starts `node build/index.js`.

## Scope

Production (transscendsurvival.org, GitHub Pages / Cloudflare Pages) stays
`adapter-static` and is FROZEN — it never consumes this adapter or image. This
shadow is tailnet-only and operator-gated. Infra stack lives in
`jesssullivan-infra` (`tofu/stacks/jesssullivan-blog-node-shadow`).
