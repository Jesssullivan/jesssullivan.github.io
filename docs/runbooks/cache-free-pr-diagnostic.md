# Cache-free PR Bazel diagnostic (TIN-2413 / TIN-603)

This is a supplemental, nonproduction source diagnostic for a reviewed blog PR
when the shared GloriousFlywheel cache is unavailable. It is **not** the
canonical `bazel-remote-gates` check, remote execution, a deployment, or
permission to merge. Required CI and branch protection stay unchanged.

The workflow `.github/workflows/cache-free-pr-diagnostic.yml` listens only for
the `diagnostic/cache-free` label being applied to a same-repository PR targeting
`main`. Review the PR workflow and scripts, and coordinate capacity on the
existing `tinyland-dind` pool before applying the label. The label admits PR
code to that runner; the workflow uses read-only GitHub permissions, but this
does not mean the underlying DinD runner is unprivileged.

On the label event, the resolver compares the event's immutable PR head SHA
with the **current** open PR head returned by GitHub. A changed, closed, forked,
or retargeted PR fails before checkout. The diagnostic job checks out that
exact SHA without persisting checkout credentials and verifies `HEAD` again.
It runs the same public check, test, and e2e target lists as `package.json`,
serially, through direct Bazel with remote cache and executor explicitly empty.
The graph uses `.bazelversion`, `MODULE.bazel.lock`, `pnpm-lock.yaml`, and
`--lockfile_mode=error`; Chromium comes from `package-lock.json`. The Bazelisk
bootstrap follows the existing CI `/latest` download, while the actual Bazel
version is asserted as 8.1.1. The job is bounded to 90 minutes, with
`--jobs=1` and `--local_test_jobs=1`.

The run summary records PR number, exact source SHA, the three outcomes, and
the supplemental/no-deployment boundary. A failure or skip is not a pass. A
successful run adds local-execution evidence only; restore or separately
resolve the canonical GF cache-backed gate before claiming required CI green.
If the PR head changes after labeling, review the new source and coordinate
capacity before removing and reapplying the label; a `synchronize` event alone
does not start this diagnostic.
