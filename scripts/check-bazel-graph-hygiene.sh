#!/usr/bin/env bash
set -euo pipefail

if [[ -n "${TEST_SRCDIR:-}" && -n "${TEST_WORKSPACE:-}" && -f "${TEST_SRCDIR}/${TEST_WORKSPACE}/.bazelignore" ]]; then
  repo_root="${TEST_SRCDIR}/${TEST_WORKSPACE}"
else
  repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
fi

bazelignore="${repo_root}/.bazelignore"

if [[ ! -f "${bazelignore}" ]]; then
  echo "ERROR: .bazelignore is missing" >&2
  exit 1
fi

require_ignored_dir() {
  local path="$1"

  if ! grep -Fxq -- "${path}" "${bazelignore}"; then
    echo "ERROR: ${path} must stay in .bazelignore so broad //... queries do not traverse agent scratch worktrees" >&2
    exit 1
  fi
}

require_ignored_dir ".claude"
require_ignored_dir ".gstack"
require_ignored_dir ".worktrees"

if [[ "${CHECK_BAZEL_QUERY:-0}" == "1" ]]; then
  bazel_bin="${BAZEL_BIN:-bazelisk}"
  if ! command -v "${bazel_bin}" >/dev/null 2>&1; then
    bazel_bin="bazel"
  fi
  if ! command -v "${bazel_bin}" >/dev/null 2>&1; then
    echo "ERROR: bazelisk or bazel is required when CHECK_BAZEL_QUERY=1" >&2
    exit 127
  fi

  query_output="$(mktemp)"
  trap 'rm -f "${query_output}"' EXIT
  cd "${repo_root}"
  "${bazel_bin}" query //... >"${query_output}"

  if grep -E '^//(\.claude|\.gstack|\.worktrees)(/|:)' "${query_output}" >&2; then
    echo "ERROR: broad Bazel package discovery traversed an ignored agent scratch tree" >&2
    exit 1
  fi
fi

echo "Bazel graph hygiene check passed"
