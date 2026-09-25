#!/usr/bin/env bash
# Supplemental exact-PR diagnostics only. Canonical check/test/e2e authority
# remains the shared-cache-backed bazel-remote-gates job in ci.yml.
set -euo pipefail

if [[ $# -ne 1 ]]; then
  echo "Usage: scripts/check-cache-free-pr-diagnostic.sh check|test|e2e" >&2
  exit 2
fi

case "$1" in
  check | test | e2e) phase="$1" ;;
  *)
    echo "ERROR: unsupported diagnostic phase: $1" >&2
    exit 2
    ;;
esac

if [[ ${GF_BAZEL_SUBSTRATE_MODE:-} != compatibility-local-only ||
      -n ${BAZEL_REMOTE_CACHE:-} || -n ${BAZEL_REMOTE_EXECUTOR:-} ||
      -n ${BAZEL_REMOTE_EXECUTOR_CACHE:-} ]]; then
  echo "ERROR: cache-free diagnostic requires compatibility-local-only mode and no remote cache or executor" >&2
  exit 1
fi
if [[ -z ${GF_RBE_CHROMIUM_EXECUTABLE:-} || ! -x ${GF_RBE_CHROMIUM_EXECUTABLE} ]]; then
  echo "ERROR: package-lock-pinned Chromium executable is required" >&2
  exit 1
fi

# Keep the exact public target set owned by package.json. The public wrapper
# cannot be called here because it correctly requires the GF cache contract.
script_name="remote:${phase}:public"
recipe="$(BLOG_DIAGNOSTIC_SCRIPT_NAME="${script_name}" node -e \
  "const { scripts } = require('./package.json'); process.stdout.write(scripts[process.env.BLOG_DIAGNOSTIC_SCRIPT_NAME] || '')")"
prefix='bash scripts/bazel-public-cache-backed.sh test '
if [[ ${recipe} != "${prefix}"* || ${recipe} == *$'\n'* ]]; then
  echo "ERROR: ${script_name} is not the expected public Bazel test recipe" >&2
  exit 1
fi
read -r -a targets <<< "${recipe#"${prefix}"}"
if [[ ${#targets[@]} -eq 0 ]]; then
  echo "ERROR: ${script_name} has no Bazel targets" >&2
  exit 1
fi
for target in "${targets[@]}"; do
  if [[ ! ${target} =~ ^//[A-Za-z0-9_./:-]+$ ]]; then
    echo "ERROR: ${script_name} contains a non-target argument" >&2
    exit 1
  fi
done

echo "Supplemental cache-free ${phase} diagnostic: ${#targets[@]} public Bazel targets; no GF cache or RBE"
exec bazel --host_jvm_args=-Xmx2560m test \
  --config=ci --config=no-remote-cache \
  --remote_cache= --remote_executor= --disk_cache= \
  --ignore_dev_dependency --lockfile_mode=error \
  --jobs=1 --local_test_jobs=1 \
  --action_env=NODE_OPTIONS=--max-old-space-size=1024 \
  --test_env="GF_RBE_CHROMIUM_EXECUTABLE=${GF_RBE_CHROMIUM_EXECUTABLE}" \
  "${targets[@]}"
