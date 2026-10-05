# Local exact-artifact flagged production release

Authority: operator requested autonomous default-off public-data constellation
rollout and local repo-managed Bazel qualification without a GF wait. R-N12
advisory tooling findings; R-N13 durable receipt; lane 4, TIN-2413/TIN-603.
This successor preserves signed minimal 37ba6c9 and its original worktree.
No deployment, token extraction, tool realization or heavy gate ran here.

## Actual metadata and custody

Read-only Cloudflare account metadata on 2026-10-05 confirmed account
`fdcb4fb750ab79be0800e885f09ddbdc`, project `transscendsurvival-org`, ID
`a5bca5d5-d565-43fd-8456-f62b297605e5`, production branch `main`, and domain
`transscendsurvival.org`. Project metadata also lists the pages.dev domain,
www and tss.ephemera.tinyland.dev; neither shadow nor provider domain substitutes
for production readback.

Existing Lab Pages Write custody is leaf
`infrastructure.cloudflare_api_token_xoxd_pages` in
`/Users/jess/git/lab/nix/secrets/common.yaml`. Its name is not a blanket
authorization grant: root coordinates existing publisher ownership and scoped
reuse. The local publisher accepts only an operator-owned 0600/0400 regular,
single-link `CLOUDFLARE_API_TOKEN_FILE`; it neither decrypts secrets nor prints
token bytes. Keep the credential outside this repository.

The existing xoxd Nix devShell declares Wrangler 4.62.0. Read-only evaluation
identified `/nix/store/xzc34b9vs5q4045pjz8m1q0096h29a4w-wrangler-4.62.0/bin/wrangler`
on the current Darwin substrate; it was not executable/realized during audit.
Use that existing declaration through the owner-managed Nix environment, or its
platform-equivalent declared output; do not download a CLI with npm/npx.
Workflow Wrangler remains pinned 4.95.0; AGENTS records the explicit local
4.62.0 exception rather than claiming byte-identical tooling.

## Executable path

Root transfers a normal signed exact-source Git bundle and verifies bundle
prerequisites, SHA, signature and clean detached checkout on the designated
producer. Preserve existing trees. Choose a new private absolute artifact path
outside git; do not reuse or overwrite an existing export. The heavy owner runs:

```sh
just production-local-qualify EXACT_SIGNED_SHA /absolute/new-blog-artifact
```

This invokes local pinned Bazelisk with lockfile error mode and remote execution
and cache explicitly empty: type/unit/graph/private-CV gates, declared production
build including images/Mermaid/Pagefind/redirects/aliases, actual sanitizer pin,
unpublished-post client-asset scan and default SSR exclusion. The build exports
`build/` plus per-file hashes in `artifact.json`. Browser qualification consumes
that export without rebuilding, including the opt-in and same-route-off tests.
Hashes are verified before and after browser tests. Only success seals
`qualification.json`; failed gates never create a qualifying receipt.

The full private-CV graph uses the existing pinned private spear-resumes source
and its existing checkout/SSH custody; public ignore-dev shortcuts are forbidden.
The browser runner needs an already-declared Chromium executable via existing
`PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH`, `GF_RBE_CHROMIUM_EXECUTABLE` or `CHROME_BIN`.
No lifecycle browser/tool download is introduced.

After normal reviewed source landing, root verifies this SHA is live main. The
same artifact remains in operator custody. With the owned private token file,
declared Wrangler path and exact-source confirmation supplied in environment:

```sh
just production-local-publish EXACT_CURRENT_MAIN_SHA /absolute/new-blog-artifact
```

Required environment is `LOCAL_WRANGLER_EXECUTABLE`,
`CLOUDFLARE_API_TOKEN_FILE`, and
`CONFIRM_LOCAL_PRODUCTION=publish-EXACT_CURRENT_MAIN_SHA`. The GH CLI must be
able to read current main and `CLOUDFLARE_PAGES_PRODUCTION_ENABLED`; a 403 is a
closed evidence gap, not permission to bypass the switch. The script rechecks
source cleanliness/signature, exact manifest hash, local qualification,
declared CLI version, account/project ID/domain and immediately rechecks live
main + switch before the sole mutation. It uses the existing Wrangler
`pages deploy ... --branch=main --commit-hash=... --commit-dirty=false` shape.

Readback checks canonical deployment success/source SHA and exact qualified
homepage bytes at transscendsurvival.org, then writes `published.json` outside
git. It does not claim browser live proof. Root separately checks public browser
default, `?flags=constellation`, `?flags=none`, public hydration/media where
present, and records any empty/unavailable projection honestly. Public Pulse
503 remains a separately owned finding, not an unflagged repair authorization.

No production DNS, switch value, repository setting, workflow dispatch or
existing deployed site changed in this source implementation.

## Review corrections to 0850789

The source reviewer caught Bazel subpackage pruning: `static/**` does not carry
the public CV PDFs across `static/cv/BUILD.bazel`. Both local build and browser
binaries now explicitly include the narrow `//static/cv:public_files` group
(exactly resume, precis and full generic CV; no targeted/private lane). Export
requires each PDF present with its PDF header and bytes equal to its already
private-source-qualified static input. Per-file manifest hashing includes all
three, and verification/publishing reject an artifact missing that public lane.

Standalone `seal` has been removed. The qualification orchestrator executes the
fixed actual Bazel checks, export and same-artifact browser stages itself. It
records each actual exit status, command/arguments, timestamps, source SHA and
final artifact manifest hash only after all stages return success and source
remains clean/signed. Publisher requires the receipt schema, same-UID operator
custody and the exact successful bound stage sequence. This is operator custody
evidence, not cryptographic remote attestation or a new signing-key framework.
Three lightweight Node fixtures cover byte/source/symlink rejection, absent
qualification, removed standalone seal and fabricated fixed-success rejection.

## Bounded producer admission

Before launching on Sting, the producer review found local defaults jobs=auto
and Node heap4096 inappropriate for the proposed high3GiB/max4GiB own scope.
Root approved the adjusted post-Darkmap high5GiB/max6GiB slot. The local recipe
now explicitly selects JVM1024MiB, jobs1, local-test-jobs1 and Node heap3072MiB
for both build actions and launched binaries; inspected runners do not override
it. Targets, pinned locks, private-CV and browser gates are
unchanged, and receipts validate those actual bounded command arguments.
Use the existing `tinyland-heavy -p MemoryHigh=5G -p MemoryMax=6G -p CPUWeight=25`
wrapper only after fresh shared-parent/host admission. No heavy task ran during
the source-only bundle import. Its former c304 source remains preserved in the
new producer checkout; qualification must import this successor exactly before
use. Owned JVM settlement follows the actual checkout/output-base live check,
not a broad/default-server shutdown.

## First actual producer attempt — cc2

Sting exact clean signed `cc2c9367c39887a5ffbd20d196eb89cfd344629c` was admitted
2026-10-05 22:22:24 UTC under owned `heavy-just-1791238944-19063.scope`, high5GiB,
max6GiB, CPUWeight25. All five initial locked local gates passed: type 18.6s,
unit 9.9s, private CV 0.2s, graph 0.0s, artifact contract 0.8s. First invocation
`15ddf18a-c034-487e-8eb1-15bda3d55f49` resolved 1143 packages/11732 targets.

Build export failed at analysis, not app compilation: the new js_binary targets
omitted `copy_data_to_bin=False`, causing Aspect to try copying cross-package
blog-agent AGENTS.md into the root package. Both binaries now use the exact
existing js_test runfiles setting. Original session2689 ended exit1 at22:28:32;
no artifact, qualification receipt, browser acceptance or publication occurred.
Scope peak4444590080B stayed below high5368709120B, and high/max/oom/oom_kill
events were zero. Actual PID19296 output base72baa5e0a972242784b33e070c1181cf and
workspace directory were live-checked before normal owned Bazel shutdown,
R-N11. Source, bundle and complete log remain preserved; retry is a new exact
successor and must rerun the declared gates, not inherit cc2's claim by inference.

Producer log: `/srv/fast-local/jess/blog-c304-20261005.yQNbm5/qualification-cc2.log`.
Verified shared immutable tool: Chromium138.0.7204.49 wrapper
`/nix/store/7xr3qnq93srn4dgak7qw74dw836wpp1y-chromium-138.0.7204.49/bin/chromium`;
underlying ELF SHA256
`bd6ba86cb6202044e6d6dbec136aa6bd8933493405913550e18237f9b0a2676f`.
This is recorded tool compatibility, not a Playwright bundled-revision claim.
# Second qualified-source attempt: declared CLI linkage

Exact signed `cb24d7c03207bdb48e88fad7e3590fa59b0cd4a2` ran on Sting from
22:32:45 UTC under `heavy-just-1791239565-159159.scope` (5 GiB high, 6 GiB
maximum, CPUWeight 25). Original session 9045 terminated with exit 1 after all
five checks/private-CV targets passed. The build target analyzed and launched,
but strict Mermaid rendering rejected the absent Bazel `.bin/mmdc` wrapper.
No artifact export, browser qualification, qualification receipt, or publication
occurred. Log remains at
`/srv/fast-local/jess/blog-c304-20261005.yQNbm5/qualification-cb24.log`.
Peak was 5,369,233,408 bytes. Actor: this blog lane; target: owned PID 159201,
exact cb24 workspace and output base `9be8388d39b1fc2eefc87cc1af76593a`;
reason: settle terminated qualification; ruling: R-N11; prior state: live
owned Bazel daemon; result: normal Bazel shutdown, PID absent and scope inactive.

Successor supplies only a temporary-workspace Mermaid CLI wrapper executing
the locked package through the Bazel Node runtime, and the existing locked
Pagefind CLI entrypoint in the runner's resolver. No download, fallback,
renderer policy change, or default public UI change is introduced. Strict
Mermaid rendering and every qualification gate remain required; prior passes
are not inherited by a new source SHA.
