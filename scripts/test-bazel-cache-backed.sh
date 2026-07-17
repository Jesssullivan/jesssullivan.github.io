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
call_number=1
if [[ -n ${FAKE_BAZEL_CALLS_FILE:-} ]]; then
  if [[ -f ${FAKE_BAZEL_CALLS_FILE} ]]; then
    call_number=$(( $(wc -l <"${FAKE_BAZEL_CALLS_FILE}") + 1 ))
  fi
  printf 'call\n' >>"${FAKE_BAZEL_CALLS_FILE}"
fi
if [[ -n ${FAKE_BAZEL_SUCCESS_ON_CALL:-} ]] && ((call_number >= FAKE_BAZEL_SUCCESS_ON_CALL)); then
  exit 0
fi
if [[ -n ${FAKE_BAZEL_STDERR:-} ]]; then
  printf '%s\n' "${FAKE_BAZEL_STDERR}" >&2
fi
if [[ -n ${FAKE_BAZEL_EXIT_CODE:-} ]]; then
  exit "${FAKE_BAZEL_EXIT_CODE}"
fi
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
  if grep -Fxq -- "--noremote_cache_compression" "${args_file}"; then
    echo "ERROR: a generic cache endpoint received the GF-only compression override" >&2
    exit 1
  fi

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

gf_cache_args="${tmp_dir}/gf-cache.args"
BAZEL_BIN="${fake_bazel}" \
  BAZEL_REMOTE_CACHE="grpc://gf-reapi-cell.gf-rbe.svc.cluster.local:8980" \
  GF_BAZEL_SUBSTRATE_MODE="shared-cache-backed" \
  GF_REAPI_CREDENTIAL_HELPER_TOKEN="test-token" \
  FAKE_BAZEL_ARGS="${gf_cache_args}" \
  bash "${repo_root}/scripts/bazel-cache-backed.sh" build //:fake_target >/dev/null
grep -Fx -- "--noremote_cache_compression" "${gf_cache_args}" >/dev/null
gf_config_line="$(awk '$0 == "--config=ci-cached" { print NR; exit }' "${gf_cache_args}")"
gf_compat_line="$(awk '$0 == "--noremote_cache_compression" { print NR; exit }' "${gf_cache_args}")"
if [[ -z ${gf_config_line} || -z ${gf_compat_line} || ${gf_config_line} -ge ${gf_compat_line} ]]; then
  echo "ERROR: GF cache compression override must follow the selected Bazel config" >&2
  exit 1
fi

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

connection_calls="${tmp_dir}/connection-refused.calls"
connection_stderr="${tmp_dir}/connection-refused.stderr"
set +e
BAZEL_BIN="${fake_bazel}" \
  BAZEL_REMOTE_CACHE="grpc://cache.example:9092" \
  GF_BAZEL_SUBSTRATE_MODE="shared-cache-backed" \
  GF_BAZEL_QUOTA_RETRIES=3 \
  FAKE_BAZEL_ARGS="${tmp_dir}/connection-refused.args" \
  FAKE_BAZEL_CALLS_FILE="${connection_calls}" \
  FAKE_BAZEL_STDERR="Failed to query remote execution capabilities: Connection refused" \
  FAKE_BAZEL_EXIT_CODE=34 \
  bash "${repo_root}/scripts/bazel-cache-backed.sh" build //:fake_target >/dev/null 2>"${connection_stderr}"
connection_rc=$?
set -e
if [[ ${connection_rc} -ne 34 ]]; then
  echo "ERROR: non-quota exit 34 propagated as ${connection_rc}, expected 34" >&2
  exit 1
fi
if [[ $(wc -l <"${connection_calls}") -ne 1 ]]; then
  echo "ERROR: non-quota exit 34 was retried" >&2
  exit 1
fi
grep -F -- "exit 34 did not match GF tenant concurrent-execution exhaustion; not retrying" "${connection_stderr}" >/dev/null
grep -F -- "Failed to query remote execution capabilities: Connection refused" "${connection_stderr}" >/dev/null
if grep -Fq -- "tenant quota exhausted" "${connection_stderr}"; then
  echo "ERROR: non-quota exit 34 was mislabeled as quota exhaustion" >&2
  exit 1
fi

near_miss_calls="${tmp_dir}/near-miss.calls"
near_miss_stderr="${tmp_dir}/near-miss.stderr"
set +e
BAZEL_BIN="${fake_bazel}" \
  BAZEL_REMOTE_CACHE="grpc://cache.example:9092" \
  GF_BAZEL_SUBSTRATE_MODE="shared-cache-backed" \
  GF_BAZEL_QUOTA_RETRIES=3 \
  FAKE_BAZEL_ARGS="${tmp_dir}/near-miss.args" \
  FAKE_BAZEL_CALLS_FILE="${near_miss_calls}" \
  FAKE_BAZEL_STDERR=$'RESOURCE_EXHAUSTED: cache capacity limit\nconcurrent execution enabled' \
  FAKE_BAZEL_EXIT_CODE=34 \
  bash "${repo_root}/scripts/bazel-cache-backed.sh" build //:fake_target >/dev/null 2>"${near_miss_stderr}"
near_miss_rc=$?
set -e
if [[ ${near_miss_rc} -ne 34 || $(wc -l <"${near_miss_calls}") -ne 1 ]]; then
  echo "ERROR: split-line quota near-miss was retried or changed exit status" >&2
  exit 1
fi
grep -F -- "exit 34 did not match GF tenant concurrent-execution exhaustion; not retrying" "${near_miss_stderr}" >/dev/null

fake_sleep="${tmp_dir}/sleep"
cat >"${fake_sleep}" <<'EOF'
#!/usr/bin/env bash
set -euo pipefail
: "${FAKE_SLEEP_CALLS:?}"
printf '%s\n' "$*" >>"${FAKE_SLEEP_CALLS}"
EOF
chmod +x "${fake_sleep}"

quota_calls="${tmp_dir}/quota.calls"
quota_sleeps="${tmp_dir}/quota.sleeps"
quota_stderr="${tmp_dir}/quota.stderr"
set +e
PATH="${tmp_dir}:${PATH}" \
  BAZEL_BIN="${fake_bazel}" \
  BAZEL_REMOTE_CACHE="grpc://cache.example:9092" \
  GF_BAZEL_SUBSTRATE_MODE="shared-cache-backed" \
  GF_BAZEL_QUOTA_RETRIES=3 \
  FAKE_BAZEL_ARGS="${tmp_dir}/quota.args" \
  FAKE_BAZEL_CALLS_FILE="${quota_calls}" \
  FAKE_BAZEL_STDERR='RESOURCE_EXHAUSTED: instance "consumer-test" is at its concurrent-execution limit 4' \
  FAKE_BAZEL_EXIT_CODE=34 \
  FAKE_SLEEP_CALLS="${quota_sleeps}" \
  bash "${repo_root}/scripts/bazel-cache-backed.sh" build //:fake_target >/dev/null 2>"${quota_stderr}"
quota_rc=$?
set -e
if [[ ${quota_rc} -ne 34 ]]; then
  echo "ERROR: exhausted quota propagated as ${quota_rc}, expected 34" >&2
  exit 1
fi
if [[ $(wc -l <"${quota_calls}") -ne 3 || $(wc -l <"${quota_sleeps}") -ne 2 ]]; then
  echo "ERROR: confirmed quota exhaustion did not use the bounded three-attempt retry" >&2
  exit 1
fi
if [[ $(grep -Fc -- "tenant quota exhausted (exit 34)" "${quota_stderr}") -ne 2 ]]; then
  echo "ERROR: confirmed quota retries were not reported accurately" >&2
  exit 1
fi
grep -F -- 'RESOURCE_EXHAUSTED: instance "consumer-test" is at its concurrent-execution limit 4' "${quota_stderr}" >/dev/null

quota_success_calls="${tmp_dir}/quota-success.calls"
quota_success_sleeps="${tmp_dir}/quota-success.sleeps"
quota_success_stderr="${tmp_dir}/quota-success.stderr"
PATH="${tmp_dir}:${PATH}" \
  BAZEL_BIN="${fake_bazel}" \
  BAZEL_REMOTE_CACHE="grpc://cache.example:9092" \
  GF_BAZEL_SUBSTRATE_MODE="shared-cache-backed" \
  GF_BAZEL_QUOTA_RETRIES=3 \
  FAKE_BAZEL_ARGS="${tmp_dir}/quota-success.args" \
  FAKE_BAZEL_CALLS_FILE="${quota_success_calls}" \
  FAKE_BAZEL_SUCCESS_ON_CALL=2 \
  FAKE_BAZEL_STDERR='RESOURCE_EXHAUSTED: instance "consumer-test" is at its concurrent execution limit 4' \
  FAKE_BAZEL_EXIT_CODE=34 \
  FAKE_SLEEP_CALLS="${quota_success_sleeps}" \
  bash "${repo_root}/scripts/bazel-cache-backed.sh" build //:fake_target >/dev/null 2>"${quota_success_stderr}"
if [[ $(wc -l <"${quota_success_calls}") -ne 2 || $(wc -l <"${quota_success_sleeps}") -ne 1 ]]; then
  echo "ERROR: quota-then-success did not stop after the successful retry" >&2
  exit 1
fi
if [[ $(grep -Fc -- "tenant quota exhausted (exit 34)" "${quota_success_stderr}") -ne 1 ]]; then
  echo "ERROR: quota-then-success retry was not reported accurately" >&2
  exit 1
fi
