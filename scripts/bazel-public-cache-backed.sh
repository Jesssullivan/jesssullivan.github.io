#!/usr/bin/env bash
# Public PR/GF wrapper. Root-only dev dependencies include private CV source;
# public lanes must never resolve them.

set -euo pipefail

case "${1:-}" in
build | test | run | coverage) ;;
*)
  echo "ERROR: expected build, test, run, or coverage" >&2
  exit 2
  ;;
esac

exec bash scripts/bazel-cache-backed.sh "$@" --ignore_dev_dependency --lockfile_mode=error
