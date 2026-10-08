import type { RequestHandler } from './$types';

// Liveness/readiness probe for the node-backend shadow (Containerfile.node ->
// adapter-node). Must stay dynamic: the static production build simply never
// crawls it (nothing links here, strict:false), so this endpoint is absent from
// the frozen adapter-static artifact and live only under BLOG_ADAPTER=node.
export const prerender = false;

// SvelteKit 3 deprecates the json() helper in favour of Response.json().
export const GET: RequestHandler = () => Response.json({ status: 'ok' });
