# Shared Bazel Package Workflow Rollout Matrix — 2026-04-16

This memo captures the current rollout state for the reusable Bazel-backed JS package workflow and the package repos now consuming it.

## Shared Workflow

- Repo: `tinyland-inc/ci-templates`
- Branch: `jess/tin-164-add-bazel-js-package-workflow`
- PR: <https://github.com/tinyland-inc/ci-templates/pull/6>
- Current head: `51b1727`
- Workflow ref pinned in callers: `51b1727b6977aa26b82604d7e6455f6d1ef1e9f2`

Current reusable workflow features:

- self-hosted runner routing via `runner_labels_json`
- stale workspace cleanup via `cleanup_paths`
- optional post-install prep via `prepare_command`
- optional advisory lint/typecheck lanes via `lint_continue_on_error` and `typecheck_continue_on_error`
- npm publish provenance on GitHub-hosted runners, with automatic fallback on self-hosted runners
- npmjs and GitHub Packages publication from the extracted Bazel package artifact

## Consumer Rollout

### `tinyland-inc/tinyvectors`

- Branch: `jess/tin-170-adopt-shared-bazel-package-workflow`
- PR: <https://github.com/tinyland-inc/tinyvectors/pull/16>
- Head: `ebd1f08`
- Status: migrated to shared workflow

Notes:

- simple consumer
- no GitHub Packages path
- now pinned to `tinyland-inc/ci-templates/.github/workflows/js-bazel-package.yml@51b1727b6977aa26b82604d7e6455f6d1ef1e9f2`

### `Jesssullivan/acuity-middleware`

- Branch: `jess/tin-104-adopt-shared-bazel-package-workflow`
- PR: <https://github.com/Jesssullivan/acuity-middleware/pull/42>
- Head: `8ed1866`
- Status: migrated to shared workflow

Notes:

- preserves self-hosted runner routing
- preserves manual `workflow_dispatch` dry-run publish semantics
- preserves GitHub Packages rewrite/publication as `@jesssullivan/scheduling-bridge`
- now pinned to `tinyland-inc/ci-templates/.github/workflows/js-bazel-package.yml@51b1727b6977aa26b82604d7e6455f6d1ef1e9f2`

### `Jesssullivan/scheduling-kit`

- Branch: `jess/tin-101-adopt-shared-bazel-package-workflow`
- PR: <https://github.com/Jesssullivan/scheduling-kit/pull/62>
- Head: `ea01fa9`
- Status: migrated to shared workflow

Notes:

- preserves self-hosted runner routing
- uses `prepare_command: pnpm exec svelte-kit sync`
- preserves GitHub Packages rewrite/publication as `@jesssullivan/scheduling-kit`
- keeps the now-clean canonical repo on the shared authority contract
- now pinned to `tinyland-inc/ci-templates/.github/workflows/js-bazel-package.yml@51b1727b6977aa26b82604d7e6455f6d1ef1e9f2`

### `tinyland-inc/scheduling-kit`

- Branch: `jess/tin-103-disable-org-fork-publish-and-align-metadata`
- PR: <https://github.com/tinyland-inc/scheduling-kit/pull/11>
- Head: `e2b8f88`
- Status: migrated to shared workflow as a rehearsal-only downstream fork

Notes:

- preserves downstream non-authoritative posture
- `publish.yml` stays rehearsal-only with `dry_run: true`
- keeps `pnpm lint` and `pnpm check` visible as advisory lanes because the fork still has real debt
- now pinned to `tinyland-inc/ci-templates/.github/workflows/js-bazel-package.yml@51b1727b6977aa26b82604d7e6455f6d1ef1e9f2`

## Merge Order

1. Merge `tinyland-inc/ci-templates` `TIN-164` first.
2. Merge `tinyland-inc/tinyvectors` `TIN-170`.
3. Merge `Jesssullivan/acuity-middleware` `TIN-104` shared-workflow adoption.
4. Merge `Jesssullivan/scheduling-kit` `TIN-101` shared-workflow adoption.
5. Merge `tinyland-inc/scheduling-kit` `TIN-103` shared-workflow adoption.

Rationale:

- every caller now references the exact reviewed workflow commit from `TIN-164`
- merging callers before `TIN-164` still leaves them dependent on an unmerged workflow revision, but no longer on a moving branch tip
- the downstream fork should land last because it is rehearsal-only and less critical than the authoritative repos

## Required Post-Merge Cleanup

For each consumer repo:

- replace `@51b1727b6977aa26b82604d7e6455f6d1ef1e9f2` with the merged reusable workflow ref
- rerun workflow YAML parse locally if any repo-specific adjustments are made during review
- verify GitHub Actions permissions stayed minimal after any review edits

For `tinyland-inc/scheduling-kit` specifically:

- keep `lint` and `check` advisory until the fork debt is actually cleaned up
- do not convert the rehearsal workflow into a real publish lane

## Known Operational Gap

Linear issue comments were blocked during the earlier pass because the connector hit a usage limit.

GitHub auth/tooling ended up in a strange but workable state:

- local `gh auth status` still reports invalid credentials for both `GH_TOKEN` and the default `Jesssullivan` account
- the GitHub app PR creation path still returned `403 Resource not accessible by integration` when tested directly
- despite that, `gh repo view`, `gh pr list`, and `gh pr create` worked and were enough to open the draft PRs above

The draft PR URLs above are now the current source of truth for the rollout.
