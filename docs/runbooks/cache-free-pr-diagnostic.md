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

Before tool setup, the job resolves `RUNNER_TEMP`, requires that it be an
absolute writable directory beneath the existing `/home/runner/_work` mount,
and creates a task-owned scratch directory there. Bazel's
`--output_user_root`, Bazelisk's home and binary, npm's package cache, and
Playwright's browser and temporary archive downloads all use this scratch;
`TMPDIR` is scoped to provisioning and Bazel phases, not set globally. The
preflight also requires
`_work` itself to resolve to a separate writable mount via `findmnt`, not just
a writable path on the container root filesystem. The existing
`playwright install --with-deps chromium` prerequisite remains: apt may write
modest OS runtime dependencies to the container layer, while the large browser
download stays on scratch. The checkout and its `node_modules` remain in the
runner's normal `_work` workspace. The workflow does not delete scratch
explicitly; normal runner/pod lifecycle owns cleanup.

The preflight log and run summary print `df -P -h` for the scratch mount. That
is **backing-filesystem free space**, not proof of available container
writable-layer space or the Kubernetes ephemeral-storage limit. The current
operator observation is a 1 GiB limit for the runner container and a 24 GiB
limit for the restartable DinD init container. Neither figure is a reservation
of `_work` capacity or an exact enforcement observation. [Kubernetes counts
container writable layers and logs separately from the pod aggregate, which
also includes `emptyDir`](https://kubernetes.io/docs/concepts/storage/ephemeral-storage/).
Reassess actual capacity separately before labeling.

The run summary records PR number, exact source SHA, the three outcomes, and
the supplemental/no-deployment boundary. A failure or skip is not a pass. A
successful run adds local-execution evidence only; restore or separately
resolve the canonical GF cache-backed gate before claiming required CI green.
If the PR head changes after labeling, review the new source and coordinate
capacity before removing and reapplying the label; a `synchronize` event alone
does not start this diagnostic.
