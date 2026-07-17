#!/usr/bin/env bash
# shellcheck disable=SC2016 # GitHub expressions below are literal source contracts.
set -euo pipefail

if [[ -n "${TEST_SRCDIR:-}" && -n "${TEST_WORKSPACE:-}" ]]; then
  workspace="${TEST_SRCDIR}/${TEST_WORKSPACE}"
else
  workspace="${BUILD_WORKSPACE_DIRECTORY:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"
fi
workflow="${workspace}/.github/workflows/shadow-image.yml"

require_fixed() {
  local needle="$1"
  local label="$2"

  if ! grep -Fq -- "${needle}" "${workflow}"; then
    echo "ERROR: shadow image workflow missing ${label}: ${needle}" >&2
    exit 1
  fi
}

require_fixed "id: source" "selected-source identity step"
require_fixed 'source_sha="$(git rev-parse HEAD)"' "checked-out commit binding"
require_fixed 'SHA_SHORT="${{ steps.source.outputs.short_sha }}"' "tag-to-selected-source binding"
require_fixed "id: source_image" "build digest output"
require_fixed 'SOURCE_DIGEST: ${{ steps.source_image.outputs.digest }}' "source digest propagation"
require_fixed '[[ ! "${SOURCE_DIGEST}" =~ ^sha256:[0-9a-f]{64}$ ]]' "source digest validation"
require_fixed 'echo "  ${IMAGE_NAME}@${SUMMARY_SOURCE_DIGEST}"' "digest-pinned private mirror"
require_fixed 'echo "operator_digest=\"\$(docker buildx imagetools inspect \\"' "operator digest resolution"
require_fixed 'echo "export TF_VAR_image_digest=\"\${operator_digest}\""' "operator digest apply evidence"
require_fixed 'echo "export TF_VAR_source_sha=${SUMMARY_SOURCE_SHA}"' "source SHA apply evidence"
require_fixed 'echo "export TF_VAR_source_workflow_run_id=${SUMMARY_SOURCE_RUN_ID}"' "source run apply evidence"

if grep -Fq -- 'SHA_SHORT="${GITHUB_SHA:0:12}"' "${workflow}"; then
  echo "ERROR: shadow image tag still binds to the dispatch ref instead of the selected checkout" >&2
  exit 1
fi

if grep -Fq -- '${IMAGE_NAME}:${SUMMARY_IMAGE_TAG}"' "${workflow}"; then
  echo "ERROR: private mirror source must be digest-pinned, not tag-only" >&2
  exit 1
fi

echo "shadow image digest contract passed"
