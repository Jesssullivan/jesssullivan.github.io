#!/usr/bin/env bash
# Run Bazel through the GloriousFlywheel shared cache-backed contract, with an
# opt-in executor-backed mode after the explicit REAPI proof gate.
#
# Bazel rc files do not expand shell environment variables in option values, so
# the remote cache endpoint must be passed as an explicit CLI option after the
# ci-cached config is selected.

set -euo pipefail

usage() {
  cat >&2 <<'EOF'
Usage: scripts/bazel-cache-backed.sh <command> [args...]

Commands:
  build     Run a cache-backed Bazel build
  test      Run cache-backed Bazel tests
  run       Run a cache-backed Bazel target
  coverage  Run cache-backed Bazel coverage
  info      Validate cache attachment, then run bazel info

Environment:
  BAZEL_REMOTE_CACHE must be a real grpc://, grpcs://, http://, or https:// endpoint.
  GF_BAZEL_SUBSTRATE_MODE must be shared-cache-backed, or executor-backed when
    BAZEL_REMOTE_EXECUTOR is set.
  BAZEL_REMOTE_EXECUTOR optionally enables executor-backed mode.
  BAZEL_REMOTE_EXECUTOR_CACHE optionally overrides the executor-backed CAS/cache
    endpoint; defaults to BAZEL_REMOTE_EXECUTOR so Execute can read uploaded
    action/input digests from the same REAPI service.
  GF_BAZEL_REMOTE_EXECUTION_PLATFORM optionally overrides the executor platform
    property; defaults to gloriousflywheel-rbe-linux-x86_64.
  GF_BAZEL_REMOTE_UPLOAD controls remote result uploads. Set it to false for
    cache-read-only refs and true for trusted cache-write refs; defaults to true.
  GF_BAZEL_HOST_JVM_MAX_HEAP_MB optionally caps the Bazel server JVM heap in
    MiB. CI sets this explicitly to fit the shared-cache runner memory limit.
  TECTONIC_CACHE_DIR optionally names an absolute, runner-local cache for
    shared-cache builds. The wrapper makes it writable inside Bazel sandboxes;
    executor-backed mode rejects this host path.
  GF_REAPI_CREDENTIAL_HELPER_TOKEN_FILE or GF_REAPI_CREDENTIAL_HELPER_TOKEN
    must be set when a gf-reapi-cell endpoint requires JWT auth. The helper
    also uses /var/run/secrets/tokens/gf-reapi-cell-token when present.
  GF_REAPI_BAZEL_CREDENTIAL_HELPER optionally overrides the repo-local Bazel
    credential helper path.
  BAZEL_REMOTE_INSTANCE_NAME optionally routes requests to a named REAPI
    instance/tenant.
  BAZEL_REPOSITORY_CACHE optionally points at a Bazel repository cache directory.
  BAZEL_DISTDIR optionally contains one or more colon-separated Bazel distdir paths.
EOF
}

if [[ $# -lt 1 ]]; then
  usage
  exit 2
fi

command="$1"
shift

case "${command}" in
build | test | run | coverage | info) ;;
-h | --help)
  usage
  exit 0
  ;;
*)
  echo "ERROR: unsupported Bazel command for cache-backed wrapper: ${command}" >&2
  usage
  exit 2
  ;;
esac

if [[ -f .env.flywheel.local ]]; then
  set -a
  # shellcheck disable=SC1091
  source ./.env.flywheel.local
  set +a
fi

bazel_bin="${BAZEL_BIN:-bazel}"
remote_cache="${BAZEL_REMOTE_CACHE:-}"
remote_executor="${BAZEL_REMOTE_EXECUTOR:-}"
remote_executor_cache="${BAZEL_REMOTE_EXECUTOR_CACHE:-}"
remote_execution_platform="${GF_BAZEL_REMOTE_EXECUTION_PLATFORM:-gloriousflywheel-rbe-linux-x86_64}"
gf_reapi_token_file="${GF_REAPI_CREDENTIAL_HELPER_TOKEN_FILE:-}"
gf_reapi_inline_token="${GF_REAPI_CREDENTIAL_HELPER_TOKEN:-}"
gf_reapi_default_token_file="/var/run/secrets/tokens/gf-reapi-cell-token"
gf_reapi_credential_helper="${GF_REAPI_BAZEL_CREDENTIAL_HELPER:-%workspace%/scripts/gf-reapi-bazel-credential-helper.mjs}"
external_fetch_args=()
executor_args=()
credential_args=()
routing_args=()
upload_args=()
browser_args=()
local_action_args=()
startup_args=()
remote_upload="${GF_BAZEL_REMOTE_UPLOAD:-true}"
tectonic_cache_dir="${TECTONIC_CACHE_DIR:-}"
host_jvm_max_heap_mb="${GF_BAZEL_HOST_JVM_MAX_HEAP_MB:-}"

endpoint_host() {
  local endpoint="$1"
  local without_scheme="${endpoint#*://}"
  local authority="${without_scheme%%/*}"

  echo "${authority%%:*}"
}

is_gf_reapi_host() {
  local host="$1"

  [[ ${host} == gf-reapi-cell* || ${host} == *.gf-rbe.svc || ${host} == *.gf-rbe.svc.* ]]
}

configure_gf_reapi_credentials() {
  local endpoint="$1"
  local host=""

  if [[ -z ${endpoint} ]]; then
    return 0
  fi

  host="$(endpoint_host "${endpoint}")"
  if ! is_gf_reapi_host "${host}"; then
    return 0
  fi

  if [[ -n ${gf_reapi_token_file} && -n ${gf_reapi_inline_token} ]]; then
    echo "ERROR: set either GF_REAPI_CREDENTIAL_HELPER_TOKEN_FILE or GF_REAPI_CREDENTIAL_HELPER_TOKEN, not both." >&2
    exit 1
  fi

  if [[ -z ${gf_reapi_token_file} && -z ${gf_reapi_inline_token} && ! -f ${gf_reapi_default_token_file} ]]; then
    echo "ERROR: ${host} requires GF REAPI credentials, but no token source is attached." >&2
    echo "Set GF_REAPI_CREDENTIAL_HELPER_TOKEN_FILE, GF_REAPI_CREDENTIAL_HELPER_TOKEN, or mount ${gf_reapi_default_token_file}." >&2
    exit 1
  fi

  credential_args+=(--credential_helper="${host}=${gf_reapi_credential_helper}")
}

validate_runtime_value() {
  local name="$1"
  local value="$2"

  if [[ ${value} == *'${'* ]] || [[ ${value} == *'}'* ]]; then
    echo "ERROR: ${name} contains a literal shell placeholder, not a real value." >&2
    exit 1
  fi
}

if [[ -n ${host_jvm_max_heap_mb} ]]; then
  if [[ ! ${host_jvm_max_heap_mb} =~ ^[0-9]+$ ]] ||
    ((host_jvm_max_heap_mb < 256 || host_jvm_max_heap_mb > 4096)); then
    echo "ERROR: GF_BAZEL_HOST_JVM_MAX_HEAP_MB must be an integer from 256 through 4096; got ${host_jvm_max_heap_mb}." >&2
    exit 2
  fi
  startup_args+=(--host_jvm_args="-Xmx${host_jvm_max_heap_mb}m")
fi

if [[ -n ${BAZEL_REPOSITORY_CACHE:-} ]]; then
  external_fetch_args+=(--repository_cache="${BAZEL_REPOSITORY_CACHE}")
fi

if [[ -n ${BAZEL_DISTDIR:-} ]]; then
  IFS=: read -r -a bazel_distdirs <<<"${BAZEL_DISTDIR}"
  for bazel_distdir in "${bazel_distdirs[@]}"; do
    if [[ -n ${bazel_distdir} ]]; then
      external_fetch_args+=(--distdir="${bazel_distdir}")
    fi
  done
fi

case "${remote_upload}" in
true | 1)
  upload_args+=(--remote_upload_local_results=true)
  ;;
false | 0)
  upload_args+=(--remote_upload_local_results=false)
  ;;
*)
  echo "ERROR: GF_BAZEL_REMOTE_UPLOAD must be true, false, 1, or 0; got ${remote_upload}." >&2
  exit 2
  ;;
esac

bash ./scripts/cache-attachment-contract.sh --strict

if ! command -v "${bazel_bin}" >/dev/null 2>&1; then
  echo "ERROR: ${bazel_bin} is not on PATH; enter direnv or nix develop first." >&2
  exit 127
fi

case "${command}" in
info)
  exec "${bazel_bin}" "${startup_args[@]}" info "${external_fetch_args[@]}" "$@"
  ;;
*)
  bazel_config="ci-cached"
  effective_remote_cache="${remote_cache}"
  if [[ -n ${remote_executor} ]]; then
    bazel_config="executor-backed"
    effective_remote_cache="${remote_executor_cache:-${remote_executor}}"
    executor_args+=(
      --remote_executor="${remote_executor}"
      --remote_default_exec_properties="gf.platform=${remote_execution_platform}"
    )
  fi
  # GF cache-read tokens (PR refs) cannot upload; skip the writes rather
  # than spraying per-action upload warnings against the denied scope.
  if [[ ${GF_BAZEL_CACHE_ROLE:-} == "read-only" ]]; then
    executor_args+=(--remote_upload_local_results=false)
  fi
  configure_gf_reapi_credentials "${remote_executor:-${effective_remote_cache}}"
  if [[ -n ${BAZEL_REMOTE_INSTANCE_NAME:-} ]]; then
    validate_runtime_value "BAZEL_REMOTE_INSTANCE_NAME" "${BAZEL_REMOTE_INSTANCE_NAME}"
    routing_args+=(--remote_instance_name="${BAZEL_REMOTE_INSTANCE_NAME}")
  fi
  if [[ ${command} == test || ${command} == coverage ]] && [[ -n ${GF_RBE_CHROMIUM_EXECUTABLE:-} ]]; then
    validate_runtime_value "GF_RBE_CHROMIUM_EXECUTABLE" "${GF_RBE_CHROMIUM_EXECUTABLE}"
    browser_args+=(--test_env="GF_RBE_CHROMIUM_EXECUTABLE=${GF_RBE_CHROMIUM_EXECUTABLE}")
  fi
  if [[ -n ${tectonic_cache_dir} ]]; then
    validate_runtime_value "TECTONIC_CACHE_DIR" "${tectonic_cache_dir}"
    if [[ ${tectonic_cache_dir} != /* ]]; then
      echo "ERROR: TECTONIC_CACHE_DIR must be an absolute path; got ${tectonic_cache_dir}." >&2
      exit 2
    fi
    if [[ -n ${remote_executor} ]]; then
      echo "ERROR: TECTONIC_CACHE_DIR is runner-local and cannot be used in executor-backed mode." >&2
      exit 2
    fi
    mkdir -p "${tectonic_cache_dir}"
    local_action_args+=(
      --action_env="TECTONIC_CACHE_DIR=${tectonic_cache_dir}"
      --sandbox_writable_path="${tectonic_cache_dir}"
    )
  fi

  # Bounded retry on the gf-reapi-cell per-tenant quota (Bazel exit 34,
  # RESOURCE_EXHAUSTED: concurrent-execution limit). Mirrors the
  # tinyland.dev lane's 3-attempt pattern. Any other exit code propagates
  # immediately. Concurrency-group serialization was tried first but GitHub
  # evicts (cancels) middle pending jobs in a shared group, which breaks
  # required checks.
  quota_attempts="${GF_BAZEL_QUOTA_RETRIES:-3}"
  attempt=1
  while :; do
    rc=0
    "${bazel_bin}" "${startup_args[@]}" "${command}" \
      --config="${bazel_config}" \
      --remote_cache="${effective_remote_cache}" \
      "${upload_args[@]}" \
      "${executor_args[@]}" \
      "${credential_args[@]}" \
      "${routing_args[@]}" \
      "${external_fetch_args[@]}" \
      "${browser_args[@]}" \
      "${local_action_args[@]}" \
      "$@" || rc=$?
    if [[ ${rc} -ne 34 || ${attempt} -ge ${quota_attempts} ]]; then
      exit "${rc}"
    fi
    backoff=$((75 * attempt + RANDOM % 30))
    echo "bazel-cache-backed: tenant quota exhausted (exit 34); retry ${attempt}/${quota_attempts} in ${backoff}s" >&2
    sleep "${backoff}"
    attempt=$((attempt + 1))
  done
  ;;
esac
