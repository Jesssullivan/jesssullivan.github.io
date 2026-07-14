#!/usr/bin/env bash

set -euo pipefail

if [[ -n ${TEST_SRCDIR:-} && -n ${TEST_WORKSPACE:-} ]]; then
  repo_root="${TEST_SRCDIR}/${TEST_WORKSPACE}"
else
  repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
fi
tmp_dir="$(mktemp -d "${TMPDIR:-/tmp}/blog-bazel-cache-contract.XXXXXX")"
trap 'rm -rf "${tmp_dir}"' EXIT

grep -Fx -- "build:ci-cached --jobs=1" "${repo_root}/.bazelrc" >/dev/null
grep -Fx -- "build:ci-cached --action_env=NODE_OPTIONS=--max-old-space-size=1024" "${repo_root}/.bazelrc" >/dev/null
grep -Fx -- "test:ci-cached --local_test_jobs=1" "${repo_root}/.bazelrc" >/dev/null

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
    GF_BAZEL_HOST_JVM_MAX_HEAP_MB="1536" \
    GF_RBE_CHROMIUM_EXECUTABLE="/opt/pinned-chromium" \
    TECTONIC_CACHE_DIR="${tmp_dir}/tectonic-cache" \
    FAKE_BAZEL_ARGS="${args_file}" \
    bash "${repo_root}/scripts/bazel-cache-backed.sh" test //:fake_target >/dev/null

  grep -Fx -- "--remote_upload_local_results=${expected}" "${args_file}" >/dev/null
  grep -Fx -- "--host_jvm_args=-Xmx1536m" "${args_file}" >/dev/null
  grep -Fx -- "--test_env=GF_RBE_CHROMIUM_EXECUTABLE=/opt/pinned-chromium" "${args_file}" >/dev/null
  grep -Fx -- "--action_env=TECTONIC_CACHE_DIR=${tmp_dir}/tectonic-cache" "${args_file}" >/dev/null
  grep -Fx -- "--sandbox_writable_path=${tmp_dir}/tectonic-cache" "${args_file}" >/dev/null
}

run_upload_case false false
run_upload_case true true

if BAZEL_BIN="${fake_bazel}" \
  BAZEL_REMOTE_CACHE="grpc://cache.example:9092" \
  GF_BAZEL_SUBSTRATE_MODE="shared-cache-backed" \
  GF_BAZEL_HOST_JVM_MAX_HEAP_MB="unbounded" \
  FAKE_BAZEL_ARGS="${tmp_dir}/invalid-heap.args" \
  bash "${repo_root}/scripts/bazel-cache-backed.sh" test //:fake_target >/dev/null 2>&1; then
  echo "ERROR: invalid GF_BAZEL_HOST_JVM_MAX_HEAP_MB unexpectedly succeeded" >&2
  exit 1
fi

if BAZEL_BIN="${fake_bazel}" \
  BAZEL_REMOTE_CACHE="grpc://cache.example:9092" \
  GF_BAZEL_SUBSTRATE_MODE="shared-cache-backed" \
  GF_BAZEL_REMOTE_UPLOAD="sometimes" \
  FAKE_BAZEL_ARGS="${tmp_dir}/invalid.args" \
  bash "${repo_root}/scripts/bazel-cache-backed.sh" test //:fake_target >/dev/null 2>&1; then
  echo "ERROR: invalid GF_BAZEL_REMOTE_UPLOAD unexpectedly succeeded" >&2
  exit 1
fi

if BAZEL_BIN="${fake_bazel}" \
  BAZEL_REMOTE_CACHE="grpc://cache.example:9092" \
  GF_BAZEL_SUBSTRATE_MODE="shared-cache-backed" \
  TECTONIC_CACHE_DIR="relative/cache" \
  FAKE_BAZEL_ARGS="${tmp_dir}/relative.args" \
  bash "${repo_root}/scripts/bazel-cache-backed.sh" build //:fake_target >/dev/null 2>&1; then
  echo "ERROR: relative TECTONIC_CACHE_DIR unexpectedly succeeded" >&2
  exit 1
fi

if BAZEL_BIN="${fake_bazel}" \
  BAZEL_REMOTE_CACHE="grpc://cache.example:9092" \
  BAZEL_REMOTE_EXECUTOR="grpc://executor.example:9092" \
  GF_BAZEL_SUBSTRATE_MODE="executor-backed" \
  TECTONIC_CACHE_DIR="${tmp_dir}/executor-cache" \
  FAKE_BAZEL_ARGS="${tmp_dir}/executor.args" \
  bash "${repo_root}/scripts/bazel-cache-backed.sh" build //:fake_target >/dev/null 2>&1; then
  echo "ERROR: runner-local TECTONIC_CACHE_DIR unexpectedly reached executor-backed mode" >&2
  exit 1
fi
