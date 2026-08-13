#!/usr/bin/env bash
set -euo pipefail

if [[ -n ${TEST_SRCDIR:-} && -n ${TEST_WORKSPACE:-} ]]; then
  repo_root="${TEST_SRCDIR}/${TEST_WORKSPACE}"
else
  repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
fi

wrapper="${repo_root}/scripts/bazel-public-cache-backed.sh"
grep -Fq -- 'exec bash scripts/bazel-cache-backed.sh "$@" --ignore_dev_dependency --lockfile_mode=error' "${wrapper}"
grep -Fq -- 'bazel_dep(name = "spear_resumes", version = "0.2.0", dev_dependency = True)' "${repo_root}/MODULE.bazel"
grep -Fq -- 'bazel_dep(name = "rules_tectonic", version = "0.2.1", dev_dependency = True)' "${repo_root}/MODULE.bazel"

ci="${repo_root}/.github/workflows/ci.yml"
grep -Fq -- 'npm run remote:check:public' "${ci}"
grep -Fq -- 'npm run remote:test:public' "${ci}"
grep -Fq -- 'npm run remote:e2e:public' "${ci}"
if grep -Eq 'SPEAR_RESUMES_DEPLOY_KEY|webfactory/ssh-agent|@spear_resumes|static/cv:pdfs_synced_test' "${ci}"; then
  echo "ERROR: PR-capable CI still carries private CV authority" >&2
  exit 1
fi

echo "public Bazel graph contract passed"
