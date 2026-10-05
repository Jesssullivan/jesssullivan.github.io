#!/usr/bin/env bash
set -euo pipefail
source_sha=${1:?exact source SHA required}
artifact=${2:?new absolute artifact directory required}
[[ $source_sha =~ ^[0-9a-f]{40}$ && $artifact == /* && ! -e $artifact ]]
[[ $(git rev-parse HEAD) == "$source_sha" && -z $(git status --porcelain) ]]
[[ $(git log -1 --format=%G?) == G ]]
command -v bazelisk >/dev/null
# Private-CV resolution retains its pinned private repository custody. No public
# --ignore_dev_dependency shortcut qualifies a production artifact.
bazelisk test --config=local --lockfile_mode=error --remote_cache= --remote_executor= \
  //:sveltekit_check //:vitest_unit_tests //:bazel_graph_hygiene //:local_production_artifact_contract //static/cv:pdfs_synced_test
bazelisk run --config=local --lockfile_mode=error --remote_cache= --remote_executor= \
  //:local_production_build -- --export-production "$artifact" "$source_sha"
node scripts/local-production-artifact.mjs verify "$artifact" "$source_sha"
bazelisk run --config=local --lockfile_mode=error --remote_cache= --remote_executor= \
  //:local_production_browser -- --production-artifact "$artifact"
# A changed byte after qualification is never republished by inference.
node scripts/local-production-artifact.mjs verify "$artifact" "$source_sha"
node scripts/local-production-artifact.mjs seal "$artifact" "$source_sha"
