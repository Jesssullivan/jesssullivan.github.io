# Review packet: blog #288 (project map) with spear-resumes #173 (R170 palette)

Read-only review packet for the operator. It was prepared at 2026-10-06T18:58Z by lane U3 of the
2026-10-06 estate workstream board (TIN-3692 §3.6). Ruling: R-HOOK-CONVERGENCE-20261004.
No review, comment, merge, rebase or push was made on either PR.

## Facts as of 2026-10-06T18:58Z

| | blog #288 | spear-resumes #173 |
|---|---|---|
| Head | `jess/profile-v2-map-c` @ `a6d5555` (6 commits, last 10-01) | `jess/profile-palette-r170` @ `b7130ce` (2 commits, 10-01 22:45Z) |
| vs base | 6 ahead / 8 behind `main` (`0ed227c`) | 2 ahead / 12 behind `main` (`1b8b278`) |
| GitHub merge state | MERGEABLE / CLEAN | **CONFLICTING / DIRTY** |
| Checks | substrate-boundary, bazel-remote-gates, build-and-test: SUCCESS (all run on the 10-01 head; **not** on the current merge with main) | **none reported** |
| Reviews | 0 | 0 |
| Size | 91 files, +22,799 / -447 (mostly `static/profile/v2` data) | 20 files, +923 / -615 |
| Linear | TIN-4675 (In Progress), TIN-5023 (In Review), TIN-5260 (Backlog) | R170, the receipt note in its own repo |

- **#173 conflict.** A read-only `git merge-tree` of `1b8b278` with `b7130ce` conflicts in one file only: `docs/agent-notes/INDEX.md`, where both sides appended a line. It is a trivial rebase.
- **#288 vs current main.** A read-only `git merge-tree` reports no textual conflict. Both sides touch `AGENTS.md` and `BUILD.bazel`, and main's 8 commits since 10-01 add the local exact-artifact release path (`0850789` to `0ed227c`). The green checks predate that, so they need a fresh run on the merge result.

## Blocking finding: merging #288 freezes production publish until rules_tectonic 0.2.3

- #288 bumps the spear_resumes `git_override` to `28b3670`. Its own body says that `//static/cv:pdfs_synced_test` is **red** against that pin until rules_tectonic 0.2.3 is in the registry and the blog bumps 0.2.1 to 0.2.3 (R155/R162, TIN-5259).
- On current `main`, both production paths require that test:
  - the local exact-artifact release: `scripts/local-production-artifact.mjs` lists `//static/cv:pdfs_synced_test` in its checks, and the 0ed receipt's "Checks/private CV" stage ran it;
  - #288's new hosted gate: `npm run cv:authority` runs the same test before posting the `private-cv-authority` status.
- Result: after a merge, no production publish (local or hosted) can pass until the U5 lane publishes rules_tectonic v0.2.3 (operator OK needed) and the blog bump lands.

Recommended order:

1. The operator approves and publishes the rules_tectonic v0.2.3 release (U5).
2. Add the rules_tectonic 0.2.1 to 0.2.3 bump to #288 (its body already plans this) and rerun the two R155 commands.
3. Rebase #288 on main and get fresh remote CI.
4. Operator content review, then merge #288.
5. Rebase #173, which only needs the INDEX.md conflict resolved, and get its CI to report.
6. Operator render ack, then merge #173.
7. Later: when the blog next bumps its spear pin, resync `static/profile/v2`. The #173 SVGs match the blog palette by construction, so this should be a no-op for colours.

## Review notes (#288)

- **R163 trust model.** The `private-cv-authority` commit status proves that the owner's gh credential posted it after a local test run. It does not prove an independent run. This is acceptable as stated in the PR, but anyone with that credential can post the status by hand. The PR documents this ("posting it by hand defeats the gate").
- **R163 vs the new local release path.** Main now publishes through the local exact-artifact path (`0850789`+). Before merge, confirm that the hosted `cloudflare-pages-production-v2.yml` and `github-pages-rollback-v2.yml` changes still matter, or whether they should be narrowed so they do not conflict with the local publisher's authority.
- **Known leftover.** `static/profile/svg/languages-{light,dark}.svg` are still served after R134. This needs a spear change or a sync exclusion.
- **Process disclosures in the PR body.** An unauthorised `bazel info`, an R165 guard false positive, and a direct run of the script once. All are disclosed and none affects the source.
- **Accessibility claims to spot-check in review.** Keyboard: the search box and legend keys no longer drive the map. `?focus=` deep links. The 390 px phone fallback. Palette contrast is at least 3.53:1 (light) and 5.52:1 (dark).

## Review notes (#173)

- One palette definition (`profile/render/category_palette.py`) is pinned to the blog's `a6d5555` tokens and tested as 8+8 hex values plus at least 3:1 contrast on each frame. That pins spear to an **unmerged** blog head, so #288 should merge first.
- The re-render diff is colour-only: 12 of 46 SVGs, all map SVGs. `profile.v1.json` and the manifest are unchanged. The PR also refreshes the org review manifest, which was already stale on main.
- The PR says "Do not merge before Jess's ack". No CI ran. The repo has one workflow, `spoke-ci-v4.yml`, and recent merged PRs (#172, #174, #175) also report zero checks, so missing CI here matches the repo norm and is not specific to #173. Merge evidence is the local `just profile-test` and `profile-v2-test` receipts.

## Operator decisions

1. Approve the rules_tectonic v0.2.3 release (U5) or accept a production-publish freeze after merging #288.
2. Content review of #288, the /about and /projects copy.
3. Render ack for #173.
4. What "real t-SNE navigation" means: #288 only, or #288 plus t-SNE over posts (see `2026-10-06-tsne-over-posts-spec.md`).
