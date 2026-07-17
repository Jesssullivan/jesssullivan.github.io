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
require_fixed "source_digest: process.env.SOURCE_DIGEST" "workflow-dispatch digest"
require_fixed "source_workflow_run_id: String(context.runId)" "workflow-dispatch run evidence"
require_fixed 'Source digest: \`${{ steps.source_image.outputs.digest }}\`' "digest evidence"
require_fixed "actions/create-github-app-token@bcd2ba49218906704ab6c1aa796996da409d3eb1" "pinned GitHub App token action"
require_fixed "actions/github-script@3a2844b7e9c422d3c10d287c895573f7108da1b3" "pinned GitHub Script action"
require_fixed 'app-id: ${{ vars.BLOG_SHADOW_DISPATCH_APP_ID }}' "GitHub App ID authority"
require_fixed 'private-key: ${{ secrets.BLOG_SHADOW_DISPATCH_APP_PRIVATE_KEY }}' "GitHub App private-key authority"
require_fixed "permission-actions: write" "actions-only App token permission"
require_fixed "environment: blog-shadow-dispatch" "review-gated secret boundary"
require_fixed "group: blog-shadow-preview-dispatch" "dispatch serialization"
require_fixed 'github-token: ${{ steps.overlay_token.outputs.token }}' "short-lived dispatch token"
require_fixed 'workflow_id: "blog-shadow-preview-deploy.yml"' "private receiver workflow"
require_fixed "github.rest.actions.createWorkflowDispatch" "workflow-dispatch API"
require_fixed 'const expectedRunName = `Blog shadow ${process.env.SOURCE_SHA} (source run ${context.runId})`' "source-correlated receiver name"
require_fixed 'core.setOutput("expected_run_name", expectedRunName)' "receiver correlation output"
require_fixed "github.rest.actions.listWorkflowRuns" "receiver discovery"
require_fixed "candidate.display_title === expectedRunName" "race-safe receiver correlation"
require_fixed "github.rest.actions.getWorkflowRun" "receiver conclusion polling"
require_fixed 'run.conclusion !== "success"' "private receiver fail-closed gate"
require_fixed 'steps.await_deploy.outputs.receiver_run_url' "private receiver evidence"
require_fixed 'SUMMARY_BRANCH: ${{ needs.resolve.outputs.branch }}' "shell-safe branch summary input"
require_fixed 'echo "- Branch: \`${SUMMARY_BRANCH}\`"' "shell-safe branch summary rendering"

if grep -Fq -- "REQUESTED_REF" "${workflow}"; then
  echo "ERROR: shadow preview manual dispatch still accepts a second mutable ref" >&2
  exit 1
fi

if grep -Fq -- "BLOG_SHADOW_DISPATCH_TOKEN" "${workflow}"; then
  echo "ERROR: shadow preview still references the retired long-lived dispatch token" >&2
  exit 1
fi

if grep -Fq -- "createDispatchEvent" "${workflow}"; then
  echo "ERROR: shadow preview must use actions-scoped workflow_dispatch" >&2
  exit 1
fi

if grep -Fq -- "actions/github-script@v9" "${workflow}"; then
  echo "ERROR: shadow preview still references a mutable GitHub Script tag" >&2
  exit 1
fi

resolve_block="$(sed -n '/^  resolve:/,/^  build:/p' "${workflow}")"
if grep -Fq -- "packages: write" <<<"${resolve_block}"; then
  echo "ERROR: shadow preview resolver has package-write authority" >&2
  exit 1
fi

dispatch_block="$(sed -n '/^  dispatch:/,$p' "${workflow}")"
if grep -Fq -- "actions/checkout" <<<"${dispatch_block}"; then
  echo "ERROR: secret-bearing dispatch job must not check out PR source" >&2
  exit 1
fi
if grep -Fq -- '${{ needs.resolve.outputs.branch }}' <<<"$(sed -n '/run: |/,$p' <<<"${dispatch_block}")"; then
  echo "ERROR: untrusted PR branch is interpolated directly into dispatch shell" >&2
  exit 1
fi

echo "shadow preview digest contract passed"
