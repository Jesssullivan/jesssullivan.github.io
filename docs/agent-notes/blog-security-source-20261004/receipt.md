# Blog security-main reconciliation — 2026-10-04

Authority: R-HOOK-CONVERGENCE-20261004; R-N13 durable receipt; root's explicit
isolated-source implementation assignment. Lane 4, TIN-2413/TIN-603; content
and media companion TIN-2414. New production security changes belong to the
existing TIN-4972/R99 owner. This receipt grants no activation or release.

Actor: `/root/blog_constellation_sol61`. Worktree:
`/Users/jess/git/jesssullivan.github.io.worktrees/security-source-reconcile-20261004`.
Branch: `candidate/blog-security-source-reconcile-20261004`.

## Exact identity and scope

- Remote main was freshly read as `930233d5f356a84c0c3ea6f9fa8562c24ac95e24`
  immediately before worktree creation; the object already existed locally.
- HEAD remains that exact base. This is an unsigned, uncommitted source
  proposal, not an immutable commit, artifact, qualified image or served site.
- Consumer authority is `0af9b1559de187febb3afd297f66ce291c694278`.
  Nineteen selected consumer files match it byte-for-byte. `BUILD.bazel` and
  `package.json` explicitly union the approved consumer additions with main.
- Exactly 21 implementation paths are enumerated in `source-manifest.json`.
  Six additional files in this receipt directory preserve documentation,
  manifest, apply-patch source and the bounded reproducible diagnostic harness.
- Manifest identity: `b5e17c0cdad8d039845895095cc86a633f7e05daede856e8dffef95ff879a61a`.
  It hashes UTF-8 `JSON.stringify(manifest)` without final newline, with keys
  `base`, `consumerSource`, `files`; files are lexicographically sorted objects
  with `path` and lowercase `sha256` of their exact bytes. Receipt/harness files
  are deliberately excluded to avoid recursive source identity.
- `source.apply.patch` SHA-256:
  `f12f66f672090dcead40917fbfed77ecce41a9e15939e75ec2868e51dbd39372`.
  It describes all 21 implementation changes relative to the exact base using
  apply_patch syntax and relative repository paths. Do not apply it elsewhere
  or to mutable main by inference.

The preceding production-base-81a proposal and its manifest
`e183671ee8112c366aa1dec9f020089259e0a92092baf1693c1e3eb4eb25b8c7`
remain preserved in `source-reconcile-20261001`; it was not merged, rebased,
reset, staged or overwritten. Producer
`32937f3dbe9ed79bde0233e69e3f1160b615e059` remains a separate clean unpromoted
candidate. Its source is not silently adopted by this consumer proposal.

## Preservation actually checked

Package JSON semantic equality to base plus only the three approved script
changes passed. DOMPurify remains `^3.4.16`; profile-sync and remote-check
changes remain. Removing the exact existing 12-line shadow-reader contract
target from candidate BUILD reproduces base BUILD byte-for-byte, preserving
`//static/profile:public_files`.

Both `package-lock.json` and `pnpm-lock.yaml`, `.bazelrc`,
`scripts/test-bazel-cache-backed.sh`, `MODULE.bazel` and `MODULE.bazel.lock`
were byte-compared to base. This preserves the production connection limit,
security pin, rules_shell/private-CV pins and graph. The implementation path
set contains no profile/CV/about/sidebar output or production domain/config.

Six held paths remain at exact base or absent as in base: cache-free workflow,
cache-free runbook, cache-free launcher, workflow-authority test,
production-resolver fixture and Dockerfile.shadow. No CI packaging/publisher
successor was absorbed. Bundled-static/broker precedence, personal-only broker
membership and outbound federation gates were not widened.

Worktree hook reported the repository already had 17 linked trees. Under the
advisory ruling, the explicitly requested new isolated source tree was created;
no existing tree, branch, cache, process or session was removed or signalled.

## Actual bounded local diagnostics

October 4, 2026, run start 17:20:57 UTC:

- Seven focused Node Vitest files: **76/76 passed**, duration 2.11 seconds.
- Existing shadow-reader-pair Node contract passed.
- Producer/consumer harness: **19 paired/fail-closed scenarios passed**;
  **14 reviewed native adapter outputs unchanged** against immutable producer
  baseline `f1d3844515e46e423faaa80131000d2401bc7a1e`.
- Installed real mdsvex confirms dangerous bare-CR fence source retains raw
  executable script/SVX; both candidate guards reject it. Safe bare-CR code
  remains escaped, with original source bytes/offset boundaries preserved.
- Exact new candidate browser-fixture confinement helper passed pure mocks:
  loopback only, GET/HEAD only, no credential URLs, external origin or redirect
  escape. This did not launch a browser.
- Cheap source-only Bazel graph-hygiene script passed with
  `CHECK_BAZEL_QUERY=0`; no Bazel query/server/build was launched.
- Implementation diff whitespace check passed.

Dependencies reuse an ignored symlink to the pre-existing root node_modules;
ignored `.svelte-kit/tsconfig.json` is a minimal transform fixture, not generated
application/type authority. No install or lock rewrite occurred.
**Reused installed DOMPurify is 3.4.13**, despite source and both locks correctly
retaining the production 3.4.16 security successor. These cheap diagnostics
therefore do not prove the new lock-resolved sanitizer runtime, vulnerability
closure or a compiled application. Qualification must use the actual 3.4.16
dependency graph before release. This scope forbade installation.

Reproduce bounded diagnostics from this exact worktree:

```bash
node node_modules/vitest/vitest.mjs run \
  --config docs/agent-notes/blog-security-source-20261004/vitest.config.mjs \
  src/lib/tinyland/markdownFences.test.ts \
  src/lib/tinyland/reviewedComponents.test.ts \
  src/lib/tinyland/runtimeMarkdown.test.ts \
  src/lib/tinyland/blogBrokerStream.test.ts \
  src/lib/reader/homeProjection.test.ts \
  src/lib/reader/collection.test.ts \
  src/lib/pulse/load.test.ts
node scripts/test-shadow-reader-pair-contract.mjs
node --import /Users/jess/git/jesssullivan.github.io/node_modules/tsx/dist/loader.mjs \
  docs/agent-notes/blog-security-source-20261004/verify-producer-fences.mjs
node docs/agent-notes/blog-security-source-20261004/verify-browser-fixture.mjs
CHECK_BAZEL_QUERY=0 bash scripts/check-bazel-graph-hygiene.sh
git --no-optional-locks diff --check
```

Harness absolute source paths intentionally bind the verified consumer and
separate producer; do not silently repoint them or claim another source passed.

## Remaining evidence and ownership

Return this unsigned source to root/Astra review. No normal signing lease,
commit, push, build, browser, provider credential, publication or deployment
was requested or used. Production activation is not automatic on resume.

Actual Svelte component transform/type/full projection/build/browser checks
remain pending; the earlier pure Node harness's missing Svelte transform was
not a proven component regression. Coordinate the producer and sole heavy
owner before compiled work. Installed old sanitizer is an explicit runtime
qualification limitation, not permission to install or bypass security.

Actual shadow acceptance requires a separately authorized qualified/applied
consumer, independently custodied deployed producer SHA/broker hash/receipt,
matching source stamp/noindex, real loaded broker/Pulse, full post body and
reviewed media decode when present. Empty media or broker-only corpus must be
reported as unexercised, not fabricated coverage. No actual shadow producer
receipt, media decode, rendered constellation or private author session was
proved here. GF, protected CI and production serving proof remain distinct.
