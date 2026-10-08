# TSS development shadow: exact-source direct upload

This lane updates only the existing `tss-shadow` Cloudflare Pages project,
serving branch `main`, at `https://tss.tinyland.dev`. The Pages branch is not a
Git merge. It does not update production, create a domain or project, publish
GHCR images, apply private-tailnet infrastructure, or prove GF qualification.

## Preconditions

1. Land the reviewed publisher on default `main` through normal exact-head
   required CI. A PR-authored publisher cannot authorize its own upload.
2. Retain the exact open same-repository PR and successful default-owned
   `Build shadow source v2` run, including run attempt. Keep its metadata and
   OCI artifacts unexpired. The requested SHA must still be that PR's head.
3. Obtain successful check, test and Chromium e2e steps from the exact-head
   reviewed cache-free diagnostic. The resolver pins both diagnostic source
   blobs. This supplemental proof is admitted only for this approved
   nonproduction upload; canonical CI remains required for source integration,
   production publication and claims of GF-backed qualification.
4. For the recovered mothership/blog rollout, deploy and verify the separately
   qualified compatible reader first. Preserve its immutable image receipt and
   safe projection smoke results. A static build alone is not live pairing.
5. Confirm the existing Pages-scoped `CLOUDFLARE_API_TOKEN`, account ID and
   `VARIABLES_READ_TOKEN` are configured by their owner; never copy values into
   chat, commits or logs. Do not use a Global API Key. The publisher's read-only
   project preflight requires the existing `tss-shadow/main` target, the TSS
   custom domain and no other domains except `tss-shadow.pages.dev`. Successful
   read access does not establish write permission.
6. Explicitly enable only repository variable `TSS_SHADOW_PAGES_ENABLED=true`
   for the approved upload. The workflow checks it initially and rereads it
   immediately before upload. This does not enable any production switch.

## Typed request

Send the existing repository-dispatch API to
`Jesssullivan/jesssullivan.github.io` with event type
`tss-shadow-pages-publish-v2`. Its `client_payload` requires exactly:

| Field | Type and meaning |
|---|---|
| `deploy` | Boolean `true`, not the string `"true"` |
| `source_pr` | Positive integer, the still-open same-repository PR |
| `source_sha` | Full lowercase 40-character PR commit |
| `source_run_id`, `source_run_attempt` | Positive integers for the successful source build |
| `diagnostic_run_id`, `diagnostic_run_attempt` | Positive integers for the successful exact-head diagnostic |

Draft source PRs are allowed for this explicit development upload. Forks,
changed heads, failed or mismatched receipts and unknown request fields fail
closed. No requested PR code is checked out or executed with the Pages token.

## Artifact and content boundary

The hosted Linux publisher independently checks archive, blob, config and
ordered layer digests, source identity and final static COPY provenance. It
extracts only that final COPY onto a case-sensitive filesystem. Case-distinct
tag URLs remain distinct; never normalize or overwrite them on macOS. Every
HTML page must carry the exact source SHA and shadow noindex marker.

The PR artifact cannot supply Pages Functions, workers or Wrangler config.
An isolated working directory preserves only the existing default-owned
TIN-2979 held-post denial function. The artifact's `_routes.json` must be
byte-identical to the trusted route map. Static-file and trusted-guard receipts
are saved separately before upload. Thus the deployed payload is the validated
static tree plus one trusted denial function, not arbitrary PR server code.

## Verification and recovery

The publisher checks the served home page for HTTP 200, the exact source marker
and noindex, without following redirects. Both slash variants of the held post
must return 404 with `no-store` and `noindex`. Requests and retries are bounded;
raw response bodies, headers and credentials are not printed.

After upload, separately verify the browser against the deployed reader and
shadow together, including broker/Pulse hydration, reviewed display content,
media and expected navigation. Supplemental predeployment tests cannot stand
in for that paired acceptance. Production remains unchanged.

Record the workflow run, source/build/diagnostic identities, extraction and guard
receipts, Pages deployment receipt and served checks. Turn the TSS-only switch
off after the bounded operation. If post-upload verification fails, stop and
preserve the failure; do not promote production or report the old site as
verified. Recovery requires a separately identified, reviewed prior TSS
deployment/artifact and deliberate owner action, not an implicit rollback to
an unqualified or expired source.
