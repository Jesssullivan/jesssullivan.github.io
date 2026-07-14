#!/usr/bin/env bash

set -euo pipefail

if [[ -n ${TEST_SRCDIR:-} && -n ${TEST_WORKSPACE:-} ]]; then
  repo_root="${TEST_SRCDIR}/${TEST_WORKSPACE}"
else
  repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
fi
tmp_dir="$(mktemp -d "${TMPDIR:-/tmp}/blog-bazel-cache-contract.XXXXXX")"
trap 'rm -rf "${tmp_dir}"' EXIT

fake_bazel="${tmp_dir}/bazel"
cat >"${fake_bazel}" <<'EOF'
#!/usr/bin/env bash
set -euo pipefail
: "${FAKE_BAZEL_ARGS:?}"
printf '%s\n' "$@" >"${FAKE_BAZEL_ARGS}"
EOF
chmod +x "${fake_bazel}"

run_upload_case() {
  local value="$1"
  local expected="$2"
  local args_file="${tmp_dir}/${value}.args"

  BAZEL_BIN="${fake_bazel}" \
    BAZEL_REMOTE_CACHE="grpc://cache.example:9092" \
    GF_BAZEL_SUBSTRATE_MODE="shared-cache-backed" \
    GF_BAZEL_REMOTE_UPLOAD="${value}" \
    GF_RBE_CHROMIUM_EXECUTABLE="/opt/pinned-chromium" \
    FAKE_BAZEL_ARGS="${args_file}" \
    bash "${repo_root}/scripts/bazel-cache-backed.sh" test //:fake_target >/dev/null

  grep -Fx -- "--remote_upload_local_results=${expected}" "${args_file}" >/dev/null
  grep -Fx -- "--test_env=GF_RBE_CHROMIUM_EXECUTABLE=/opt/pinned-chromium" "${args_file}" >/dev/null
}

run_upload_case false false
run_upload_case true true

if BAZEL_BIN="${fake_bazel}" \
  BAZEL_REMOTE_CACHE="grpc://cache.example:9092" \
  GF_BAZEL_SUBSTRATE_MODE="shared-cache-backed" \
  GF_BAZEL_REMOTE_UPLOAD="sometimes" \
  FAKE_BAZEL_ARGS="${tmp_dir}/invalid.args" \
  bash "${repo_root}/scripts/bazel-cache-backed.sh" test //:fake_target >/dev/null 2>&1; then
  echo "ERROR: invalid GF_BAZEL_REMOTE_UPLOAD unexpectedly succeeded" >&2
  exit 1
fi
