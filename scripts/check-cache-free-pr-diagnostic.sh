#!/usr/bin/env bash
# Supplemental exact-PR diagnostics only. Canonical check/test/e2e authority
# remains the shared-cache-backed bazel-remote-gates job in ci.yml.
set -euo pipefail

if [[ $# -ne 1 ]]; then
  echo "Usage: scripts/check-cache-free-pr-diagnostic.sh prepare|check|test|e2e" >&2
  exit 2
fi

case "$1" in
  prepare | check | test | e2e) phase="$1" ;;
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

work_prefix='/home/runner/_work'
resolved_work_prefix="$(realpath -e "${work_prefix}")"
if [[ ${phase} == prepare ]]; then
  mount_target="$(findmnt -n -T "${work_prefix}" -o TARGET)"
  mount_options="$(findmnt -n -T "${work_prefix}" -o OPTIONS)"
  if [[ "$(realpath -e "${mount_target}")" != "${resolved_work_prefix}" ||
        ",${mount_options}," != *,rw,* ]]; then
    echo "ERROR: runner work prefix must be its own writable mount" >&2
    exit 1
  fi
  if [[ ${RUNNER_TEMP:-} != /* || ! -d ${RUNNER_TEMP:-} || ! -w ${RUNNER_TEMP:-} ||
        ${GITHUB_ENV:-} != /* || ! -w ${GITHUB_ENV:-} ]]; then
    echo "ERROR: absolute writable RUNNER_TEMP and GitHub environment file are required" >&2
    exit 1
  fi
  resolved_temp="$(realpath -e "${RUNNER_TEMP}")"
  if [[ ${resolved_temp} != "${resolved_work_prefix}/"* ]]; then
    echo "ERROR: RUNNER_TEMP resolves outside the existing runner work prefix" >&2
    exit 1
  fi
  if [[ "$(realpath -e "${GITHUB_ENV}")" != "${resolved_temp}/"* ]]; then
    echo "ERROR: GitHub environment file resolves outside RUNNER_TEMP" >&2
    exit 1
  fi
  scratch="$(mktemp -d "${resolved_temp}/blog-cache-free.XXXXXXXX")"
  scratch="$(realpath -e "${scratch}")"
  if [[ ${scratch} != "${resolved_temp}/blog-cache-free."* || ! -w ${scratch} ]]; then
    echo "ERROR: diagnostic scratch did not resolve inside RUNNER_TEMP" >&2
    exit 1
  fi
  mkdir -p "${scratch}/bin" "${scratch}/bazelisk" "${scratch}/bazel-output" \
    "${scratch}/npm-cache" "${scratch}/playwright" "${scratch}/tmp"
  {
    printf 'BLOG_DIAGNOSTIC_SCRATCH=%s\n' "${scratch}"
    printf 'BAZELISK_HOME=%s/bazelisk\n' "${scratch}"
    printf 'NPM_CONFIG_CACHE=%s/npm-cache\n' "${scratch}"
    printf 'PLAYWRIGHT_BROWSERS_PATH=%s/playwright\n' "${scratch}"
  } >> "${GITHUB_ENV}"
  echo "Diagnostic scratch: ${scratch}"
  echo "Runner work mount: ${mount_target} (${mount_options})"
  echo 'Backing filesystem capacity (df); not a container writable-layer or Kubernetes ephemeral-storage limit:'
  df -P -h "${scratch}"
  exit 0
fi

if [[ ${BLOG_DIAGNOSTIC_SCRATCH:-} != /* || ! -d ${BLOG_DIAGNOSTIC_SCRATCH:-} ]]; then
  echo "ERROR: prepared absolute diagnostic scratch is required" >&2
  exit 1
fi
scratch="$(realpath -e "${BLOG_DIAGNOSTIC_SCRATCH}")"
if [[ ${scratch} != "${resolved_work_prefix}/"* || ! -w ${scratch} ||
      ${BAZELISK_HOME:-} != "${scratch}/bazelisk" ||
      ${NPM_CONFIG_CACHE:-} != "${scratch}/npm-cache" ||
      ${PLAYWRIGHT_BROWSERS_PATH:-} != "${scratch}/playwright" ||
      ! -d "${scratch}/tmp" || ! -w "${scratch}/tmp" ||
      ! -x "${scratch}/bin/bazel" ]]; then
  echo "ERROR: diagnostic tools and caches must use prepared runner scratch" >&2
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
export TMPDIR="${scratch}/tmp"
exec "${scratch}/bin/bazel" --output_user_root="${scratch}/bazel-output" \
  --host_jvm_args=-Xmx2560m test \
  --config=ci --config=no-remote-cache \
  --remote_cache= --remote_executor= --disk_cache= \
  --ignore_dev_dependency --lockfile_mode=error \
  --jobs=1 --local_test_jobs=1 \
  --action_env=NODE_OPTIONS=--max-old-space-size=1024 \
  --test_env="GF_RBE_CHROMIUM_EXECUTABLE=${GF_RBE_CHROMIUM_EXECUTABLE}" \
  "${targets[@]}"
