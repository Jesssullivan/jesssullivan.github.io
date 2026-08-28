# TSS shadow publish (`tss.tinyland.dev`)

`tss.tinyland.dev` is the public, site-wide-noindex development shadow (TIN-3026). `.github/workflows/tss-shadow-publish-v2.yml` publishes an exact CI-proven SHA — current `main`, or the head of an open same-repo PR — to the dedicated TSS Cloudflare Pages project; it never touches `transscendsurvival-org`.

Operator ceremony: set repo var `CLOUDFLARE_PAGES_TSS_PROJECT_NAME` (from the Cloudflare dashboard), set `BLOG_TSS_PUBLISH_ENABLED=true`, then send `repository_dispatch` type `tss-shadow-publish-v2` with `client_payload: {source_sha, deploy: "true"}` (add `source_pr` for a PR head). Verify with `curl https://tss.tinyland.dev/_app/version.json` and the `tinyland-source-sha` meta on any route.

Gates: canonical CI green at the exact SHA (`build-and-test` + `bazel-remote-gates`), kill switch and source revalidated immediately before `wrangler pages deploy`, production project name refused. Rotate the Cloudflare API token (TIN-2727) before the first publish.
