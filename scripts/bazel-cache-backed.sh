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

bazel_bin="${BAZEL_BIN:-bazel}"
remote_cache="${BAZEL_REMOTE_CACHE:-}"
remote_executor="${BAZEL_REMOTE_EXECUTOR:-}"
remote_executor_cache="${BAZEL_REMOTE_EXECUTOR_CACHE:-}"
remote_execution_platform="${GF_BAZEL_REMOTE_EXECUTION_PLATFORM:-gloriousflywheel-rbe-linux-x86_64}"
external_fetch_args=()
executor_args=()

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

bash ./scripts/cache-attachment-contract.sh --strict

if ! command -v "${bazel_bin}" >/dev/null 2>&1; then
  echo "ERROR: ${bazel_bin} is not on PATH; enter direnv or nix develop first." >&2
  exit 127
fi

case "${command}" in
info)
  exec "${bazel_bin}" info "${external_fetch_args[@]}" "$@"
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

  exec "${bazel_bin}" "${command}" \
    --config="${bazel_config}" \
    --remote_cache="${effective_remote_cache}" \
    "${executor_args[@]}" \
    "${external_fetch_args[@]}" \
    "$@"
  ;;
esac
