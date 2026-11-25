#!/usr/bin/env bash
# Run the blog's public Bazel gate with local execution only (TIN-8703).
#
# CI runs this on the repository's own runner. It uses no remote cache, no
# remote executor and no credential helper. Runner pods may still inject old
# GloriousFlywheel endpoint variables; this script unsets them so a stale value
# can never route the build, and it also passes empty remote flags to Bazel.

set -euo pipefail

usage() {
  cat >&2 <<'EOF'
Usage: scripts/local-bazel-gate.sh <build|test|shutdown> [args...]

Environment:
  BLOG_GATE_CACHE_DIR      absolute directory for the Bazel disk and repository
                           caches; defaults to ~/.cache/bazel-blog-gate.
  BLOG_GATE_JOBS           Bazel --jobs value; defaults to 2.
  BLOG_GATE_JVM_HEAP_MB    Bazel server heap cap in MiB; defaults to 2048.
  BAZEL_BIN                Bazel binary; defaults to bazel.
EOF
}

command="${1:-}"
case "${command}" in
build | test | shutdown) shift ;;
-h | --help)
  usage
  exit 0
  ;;
*)
  usage
  exit 2
  ;;
esac

# Drop every remote-execution hint the runner environment may carry.
while IFS= read -r name; do
  case "${name}" in
  BAZEL_REMOTE_* | GF_REAPI_* | GF_BAZEL_*) unset "${name}" ;;
  esac
done < <(compgen -e)

bazel_bin="${BAZEL_BIN:-bazel}"
cache_dir="${BLOG_GATE_CACHE_DIR:-${HOME}/.cache/bazel-blog-gate}"
jobs="${BLOG_GATE_JOBS:-2}"
heap_mb="${BLOG_GATE_JVM_HEAP_MB:-2048}"

if [[ ${cache_dir} != /* ]]; then
  echo "ERROR: BLOG_GATE_CACHE_DIR must be an absolute path; got ${cache_dir}." >&2
  exit 2
fi
if [[ ! ${jobs} =~ ^[1-9][0-9]*$ ]]; then
  echo "ERROR: BLOG_GATE_JOBS must be a positive integer; got ${jobs}." >&2
  exit 2
fi
if [[ ! ${heap_mb} =~ ^[0-9]+$ ]] || ((heap_mb < 256 || heap_mb > 8192)); then
  echo "ERROR: BLOG_GATE_JVM_HEAP_MB must be an integer from 256 through 8192; got ${heap_mb}." >&2
  exit 2
fi

if ! command -v "${bazel_bin}" >/dev/null 2>&1; then
  echo "ERROR: ${bazel_bin} is not on PATH." >&2
  exit 127
fi

startup_args=(--host_jvm_args="-Xmx${heap_mb}m")

if [[ ${command} == shutdown ]]; then
  exec "${bazel_bin}" "${startup_args[@]}" shutdown
fi

mkdir -p "${cache_dir}/disk" "${cache_dir}/repos"

exec "${bazel_bin}" "${startup_args[@]}" "${command}" \
  --config=local-gate \
  --remote_cache= \
  --remote_executor= \
  --disk_cache="${cache_dir}/disk" \
  --repository_cache="${cache_dir}/repos" \
  --jobs="${jobs}" \
  --ignore_dev_dependency \
  --lockfile_mode=error \
  "$@"
