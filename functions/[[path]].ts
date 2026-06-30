/**
 * Cloudflare Pages Function — apex child-slug passthrough (B3, the 404-stopper).
 * TIN-2267 · Project B "Pages Aggregation & Federated Search" · initiative 879f6ad9.
 *
 * Runs ONLY on the apex CF Pages project `transscendsurvival-org`
 * (`transscendsurvival.org`, a proxied CNAME). For an allowlisted child slug it
 * passthrough-proxies the healthy github.io child origin and injects ONE
 * `<base href>` so the child's RELATIVE assets resolve straight back to the child
 * origin — sub-resources never transit this Function. Every other request falls
 * through to the hub's own static build via `env.ASSETS.fetch` (`/`, `/blog`,
 * `/cv`, the generated redirect stubs, `404.html`).
 *
 * MVP scope (no-hedge 404-stopper): NO chrome, ZERO Project-A dependency. Seed
 * allowlist = one zero-hydration static child (`zig-crypto`, MkDocs-Material,
 * relative assets). Later: widen the allowlist from the generated
 * `pages-manifest.json` (B9/B11), add apex chrome via HTMLRewriter (B6), and the
 * SvelteKit embed-rebuild lane (B8) for hydrating children.
 *
 * File-routed (not `_worker.js`) so the hub's static routes stay owned by the
 * default ASSETS handler. Cloudflare bundles a repo-root `functions/` when the
 * deploy runs `wrangler pages deploy build` from the repo root (see
 * .github/workflows/cloudflare-pages-shadow.yml).
 */

const CHILD_ORIGIN = "https://jesssullivan.github.io";

// Seed allowlist: one zero-hydration static child. Widen via pages-manifest.json (B9/B11).
const ALLOW = new Set<string>(["zig-crypto"]);

interface Env {
  ASSETS: { fetch: (request: Request) => Promise<Response> };
}

export const onRequest: PagesFunction<Env> = async ({ request, env }) => {
  const url = new URL(request.url);
  const slug = url.pathname.split("/").filter(Boolean)[0] ?? "";

  // Not an aggregated child → serve the hub's own static routes untouched.
  if (!ALLOW.has(slug)) return env.ASSETS.fetch(request);

  // github.io 301s slashless → trailing-slash; proxy the trailing-slash form so the
  // browser never sees a redirect bounce. Leave real file paths (with extension) as-is.
  const childUrl = new URL(url.pathname + url.search, CHILD_ORIGIN);
  if (!childUrl.pathname.endsWith("/") && !/\.[a-z0-9]+$/i.test(childUrl.pathname)) {
    childUrl.pathname += "/";
  }

  const upstream = await fetch(childUrl.toString(), {
    headers: { "user-agent": request.headers.get("user-agent") ?? "apex-aggregator" },
    redirect: "follow",
  });

  // Pass non-HTML straight through (any asset that DID transit, error bodies, etc.).
  const contentType = upstream.headers.get("content-type") ?? "";
  if (!contentType.includes("text/html")) return upstream;

  // Inject ONE <base href> at the child origin so relative sub-resources resolve
  // back to github.io. Drop a child-origin CSP — under the apex the document origin
  // is transscendsurvival.org, so a child `default-src 'self'` would wrongly block
  // the github.io-served assets.
  const headers = new Headers(upstream.headers);
  headers.delete("content-security-policy");
  headers.delete("content-security-policy-report-only");
  headers.set("x-apex-proxy", slug);

  const base = `${CHILD_ORIGIN}/${slug}/`;
  return new HTMLRewriter()
    .on("head", {
      element(el) {
        el.prepend(`<base href="${base}">`, { html: true });
      },
    })
    .transform(
      new Response(upstream.body, {
        status: upstream.status,
        statusText: upstream.statusText,
        headers,
      }),
    );
};
