#!/usr/bin/env bash
# shellcheck disable=SC2016 # GitHub expressions below are literal source contracts.
set -euo pipefail

if [[ -n "${TEST_SRCDIR:-}" && -n "${TEST_WORKSPACE:-}" ]]; then
  workspace="${TEST_SRCDIR}/${TEST_WORKSPACE}"
else
  workspace="${BUILD_WORKSPACE_DIRECTORY:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"
fi
workflow="${workspace}/.github/workflows/shadow-preview.yml"

require_fixed() {
  local needle="$1"
  local label="$2"

  if ! grep -Fq -- "${needle}" "${workflow}"; then
    echo "ERROR: shadow preview workflow missing ${label}: ${needle}" >&2
    exit 1
  fi
}

require_fixed "id: source_image" "build digest output"
require_fixed $'    permissions:\n      contents: read\n      packages: write' "job-scoped package authority"
require_fixed "sha = context.sha" "manual-dispatch selected-ref binding"
require_fixed 'SOURCE_DIGEST: ${{ steps.source_image.outputs.digest }}' "digest propagation"
require_fixed '[[ ! "${SOURCE_DIGEST}" =~ ^sha256:[0-9a-f]{64}$ ]]' "digest validation"
require_fixed "source_digest: process.env.SOURCE_DIGEST" "repository-dispatch digest"
require_fixed "source_workflow_run_id: String(context.runId)" "repository-dispatch run evidence"
require_fixed 'Source digest: \`${{ steps.source_image.outputs.digest }}\`' "digest evidence"

if grep -Fq -- "REQUESTED_REF" "${workflow}"; then
  echo "ERROR: shadow preview manual dispatch still accepts a second mutable ref" >&2
  exit 1
fi

resolve_block="$(sed -n '/^  resolve:/,/^  build:/p' "${workflow}")"
if grep -Fq -- "packages: write" <<<"${resolve_block}"; then
  echo "ERROR: shadow preview resolver has package-write authority" >&2
  exit 1
fi

echo "shadow preview digest contract passed"
