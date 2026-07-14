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
grep -Fx -- "      GF_REAPI_TOKEN_EXCHANGE_TTL: 45m" "${repo_root}/.github/workflows/ci.yml" >/dev/null
mint_count="$(grep -c -F -- "run: bash scripts/mint-gf-reapi-token-from-exchange.sh" "${repo_root}/.github/workflows/ci.yml")"
if [[ ${mint_count} -ne 5 ]]; then
  echo "ERROR: CI must mint once for attachment validation and refresh before all four Bazel phases; found ${mint_count}." >&2
  exit 1
fi

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
    GF_BAZEL_HOST_JVM_MAX_HEAP_MB="2560" \
    GF_RBE_CHROMIUM_EXECUTABLE="/opt/pinned-chromium" \
    TECTONIC_CACHE_DIR="${tmp_dir}/tectonic-cache" \
    FAKE_BAZEL_ARGS="${args_file}" \
    bash "${repo_root}/scripts/bazel-cache-backed.sh" test //:fake_target >/dev/null

  grep -Fx -- "--remote_upload_local_results=${expected}" "${args_file}" >/dev/null
  grep -Fx -- "--host_jvm_args=-Xmx2560m" "${args_file}" >/dev/null
  grep -Fx -- "--test_env=GF_RBE_CHROMIUM_EXECUTABLE=/opt/pinned-chromium" "${args_file}" >/dev/null
  grep -Fx -- "--action_env=TECTONIC_CACHE_DIR=${tmp_dir}/tectonic-cache" "${args_file}" >/dev/null
  grep -Fx -- "--sandbox_writable_path=${tmp_dir}/tectonic-cache" "${args_file}" >/dev/null

  host_jvm_line="$(awk '$0 == "--host_jvm_args=-Xmx2560m" { print NR; exit }' "${args_file}")"
  command_line="$(awk '$0 == "test" { print NR; exit }' "${args_file}")"
  config_line="$(awk '$0 == "--config=ci-cached" { print NR; exit }' "${args_file}")"
  upload_line="$(awk -v expected="--remote_upload_local_results=${expected}" '$0 == expected { print NR; exit }' "${args_file}")"
  if [[ -z ${host_jvm_line} || -z ${command_line} || ${host_jvm_line} -ge ${command_line} ]]; then
    echo "ERROR: Bazel host JVM startup option must precede the command." >&2
    exit 1
  fi
  if [[ -z ${config_line} || -z ${upload_line} || ${config_line} -ge ${upload_line} ]]; then
    echo "ERROR: explicit remote-upload policy must follow the selected Bazel config." >&2
    exit 1
  fi
}

run_upload_case false false
run_upload_case true true

shutdown_args="${tmp_dir}/shutdown.args"
BAZEL_BIN="${fake_bazel}" \
  BAZEL_REMOTE_CACHE="grpc://cache.example:9092" \
  GF_BAZEL_SUBSTRATE_MODE="shared-cache-backed" \
  GF_BAZEL_HOST_JVM_MAX_HEAP_MB="2560" \
  FAKE_BAZEL_ARGS="${shutdown_args}" \
  bash "${repo_root}/scripts/bazel-cache-backed.sh" shutdown >/dev/null
grep -Fx -- "--host_jvm_args=-Xmx2560m" "${shutdown_args}" >/dev/null
grep -Fx -- "shutdown" "${shutdown_args}" >/dev/null

invalid_heap_stderr="${tmp_dir}/invalid-heap.stderr"
if BAZEL_BIN="${fake_bazel}" \
  BAZEL_REMOTE_CACHE="grpc://cache.example:9092" \
  GF_BAZEL_SUBSTRATE_MODE="shared-cache-backed" \
  GF_BAZEL_HOST_JVM_MAX_HEAP_MB="unbounded" \
  FAKE_BAZEL_ARGS="${tmp_dir}/invalid-heap.args" \
  bash "${repo_root}/scripts/bazel-cache-backed.sh" test //:fake_target >/dev/null 2>"${invalid_heap_stderr}"; then
  echo "ERROR: invalid GF_BAZEL_HOST_JVM_MAX_HEAP_MB unexpectedly succeeded" >&2
  exit 1
fi
grep -F -- "GF_BAZEL_HOST_JVM_MAX_HEAP_MB must be an integer from 256 through 4096" "${invalid_heap_stderr}" >/dev/null

invalid_upload_stderr="${tmp_dir}/invalid-upload.stderr"
if BAZEL_BIN="${fake_bazel}" \
  BAZEL_REMOTE_CACHE="grpc://cache.example:9092" \
  GF_BAZEL_SUBSTRATE_MODE="shared-cache-backed" \
  GF_BAZEL_REMOTE_UPLOAD="sometimes" \
  FAKE_BAZEL_ARGS="${tmp_dir}/invalid.args" \
  bash "${repo_root}/scripts/bazel-cache-backed.sh" test //:fake_target >/dev/null 2>"${invalid_upload_stderr}"; then
  echo "ERROR: invalid GF_BAZEL_REMOTE_UPLOAD unexpectedly succeeded" >&2
  exit 1
fi
grep -F -- "GF_BAZEL_REMOTE_UPLOAD must be true, false, 1, or 0" "${invalid_upload_stderr}" >/dev/null

relative_cache_stderr="${tmp_dir}/relative-cache.stderr"
if BAZEL_BIN="${fake_bazel}" \
  BAZEL_REMOTE_CACHE="grpc://cache.example:9092" \
  GF_BAZEL_SUBSTRATE_MODE="shared-cache-backed" \
  TECTONIC_CACHE_DIR="relative/cache" \
  FAKE_BAZEL_ARGS="${tmp_dir}/relative.args" \
  bash "${repo_root}/scripts/bazel-cache-backed.sh" build //:fake_target >/dev/null 2>"${relative_cache_stderr}"; then
  echo "ERROR: relative TECTONIC_CACHE_DIR unexpectedly succeeded" >&2
  exit 1
fi
grep -F -- "TECTONIC_CACHE_DIR must be an absolute path" "${relative_cache_stderr}" >/dev/null

executor_cache_stderr="${tmp_dir}/executor-cache.stderr"
if BAZEL_BIN="${fake_bazel}" \
  BAZEL_REMOTE_CACHE="grpc://cache.example:9092" \
  BAZEL_REMOTE_EXECUTOR="grpc://executor.example:9092" \
  GF_BAZEL_SUBSTRATE_MODE="executor-backed" \
  TECTONIC_CACHE_DIR="${tmp_dir}/executor-cache" \
  FAKE_BAZEL_ARGS="${tmp_dir}/executor.args" \
  bash "${repo_root}/scripts/bazel-cache-backed.sh" build //:fake_target >/dev/null 2>"${executor_cache_stderr}"; then
  echo "ERROR: runner-local TECTONIC_CACHE_DIR unexpectedly reached executor-backed mode" >&2
  exit 1
fi
grep -F -- "TECTONIC_CACHE_DIR is runner-local and cannot be used in executor-backed mode" "${executor_cache_stderr}" >/dev/null
