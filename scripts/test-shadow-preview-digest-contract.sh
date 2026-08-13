#!/usr/bin/env bash
# shellcheck disable=SC2016 # GitHub expressions below are literal source contracts.
set -euo pipefail

if [[ -n "${TEST_SRCDIR:-}" && -n "${TEST_WORKSPACE:-}" ]]; then
  workspace="${TEST_SRCDIR}/${TEST_WORKSPACE}"
else
  workspace="${BUILD_WORKSPACE_DIRECTORY:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"
fi
source_workflow="${workspace}/.github/workflows/shadow-source-build-v2.yml"
trusted_workflow="${workspace}/.github/workflows/shadow-source-publish-v2.yml"
ambiguous_workflow="${workspace}/.github/workflows/shadow-publish-apply-v2.yml"
legacy_workflow="${workspace}/.github/workflows/shadow-preview.yml"

require_in_file() {
  local file="$1"
  local needle="$2"
  local label="$3"
  if ! grep -Fq -- "${needle}" "${file}"; then
    echo "ERROR: ${label} missing: ${needle}" >&2
    exit 1
  fi
}

if [[ -e "${legacy_workflow}" ]]; then
  echo "ERROR: legacy shadow-preview workflow path must remain retired" >&2
  exit 1
fi
if [[ -e "${ambiguous_workflow}" ]]; then
  echo "ERROR: publish-only workflow must not retain an apply-shaped path" >&2
  exit 1
fi

require_in_file "${source_workflow}" "name: Build shadow source v2" "new source workflow identity"
require_in_file "${source_workflow}" "permissions: {}" "deny-by-default workflow permissions"
if grep -Eq '^  pull_request:|workflow_dispatch:' "${source_workflow}"; then
  echo "ERROR: source workflow must be default-owned repository dispatch only" >&2
  exit 1
fi
require_in_file "${source_workflow}" "types: [shadow-source-build-v2]" "exact repository dispatch type"
require_in_file "${source_workflow}" 'github.event.client_payload.source_pr' "exact PR payload"
require_in_file "${source_workflow}" 'github.event.client_payload.source_sha' "exact SHA payload"
require_in_file "${source_workflow}" 'pr.state !== "open"' "open PR gate"
require_in_file "${source_workflow}" 'pr.head.repo?.full_name !== expectedRepository' "same-repo PR gate"
require_in_file "${source_workflow}" 'pr.head.sha !== sha' "current PR head gate"
require_in_file "${source_workflow}" 'allowedSourceRunners = new Set(["ubuntu-latest"])' "unprivileged runner allowlist"
require_in_file "${source_workflow}" "Build unprivileged OCI archive" "build-only PR job"
require_in_file "${source_workflow}" "push: false" "no registry write in PR job"
require_in_file "${source_workflow}" "type=docker,dest=" "OCI archive output"
require_in_file "${source_workflow}" "actions/upload-artifact@043fb46d1a93c77aae656e7c1c64a875d1fc6a0a" "pinned immutable artifact upload"
if grep -Eq 'cache-from:|cache-to:' "${source_workflow}"; then
  echo "ERROR: PR Dockerfile builds must not consume or write cross-run GHA caches" >&2
  exit 1
fi

if grep -Eq 'secrets\.|packages: write|create-github-app-token|docker/login-action|createWorkflowDispatch' "${source_workflow}"; then
  echo "ERROR: branch-authored source workflow contains publish, dispatch, or secret authority" >&2
  exit 1
fi

require_in_file "${trusted_workflow}" "workflow_run:" "default-branch trusted consumer"
require_in_file "${trusted_workflow}" "workflows: ['Build shadow source v2']" "exact upstream identity"
require_in_file "${trusted_workflow}" 'candidate.name === "Build unprivileged OCI archive"' "successful build-job evidence"
require_in_file "${trusted_workflow}" "if: steps.upstream.outputs.consume == 'true'" "draft/fork no-artifact skip"
require_in_file "${trusted_workflow}" 'workflowPath !== ".github/workflows/shadow-source-build-v2.yml"' "exact workflow path check"
require_in_file "${trusted_workflow}" "actions/download-artifact@3e5f45b2cfb9172054b4087a40e8e0b5a5461e7c" "pinned exact-run artifact download"
require_in_file "${trusted_workflow}" "BLOG_SHADOW_SOURCE_PUBLISH_ENABLED" "package publication kill switch"
require_in_file "${trusted_workflow}" 'upstream.event !== "repository_dispatch"' "default-owned trusted upstream"
require_in_file "${trusted_workflow}" 'const exactTag = `shadow-pr-${pr.number}-${metadata.sourceSha.slice(0, 12)}-amd64`' "immutable exact tag"
require_in_file "${trusted_workflow}" 'pr.draft ||' "draft publication gate"
require_in_file "${trusted_workflow}" "Revalidate publish authority immediately before package write" "last-moment publish gate"
require_in_file "${trusted_workflow}" 'name: "BLOG_SHADOW_SOURCE_PUBLISH_ENABLED"' "live publication variable read"
require_in_file "${trusted_workflow}" '[[ ! "${digest}" =~ ^sha256:[0-9a-f]{64}$ ]]' "published digest validation"
if grep -Eq 'request_apply|requestApply|apply_requested|createWorkflowDispatch|createDispatchEvent|create-github-app-token|BLOG_SHADOW_APPLY_ENABLED|BLOG_SHADOW_DISPATCH_APP|blog-shadow-preview-deploy\.yml|blog-shadow-preview-apply-v2\.yml|environment:[[:space:]]*blog-shadow-dispatch' "${source_workflow}" "${trusted_workflow}"; then
  echo "ERROR: trusted workflow must not carry private apply credential or dispatch authority" >&2
  exit 1
fi

if grep -Fq -- "actions/checkout" "${trusted_workflow}"; then
  echo "ERROR: secret-bearing trusted workflow must never check out PR source" >&2
  exit 1
fi
if grep -Fq -- "BLOG_SHADOW_DISPATCH_TOKEN" "${trusted_workflow}"; then
  echo "ERROR: trusted workflow references retired long-lived dispatch token" >&2
  exit 1
fi

publish_line="$(grep -nF 'name: Login and publish exact source image' "${trusted_workflow}" | cut -d: -f1)"
publish_recheck_line="$(grep -nF 'name: Revalidate publish authority immediately before package write' "${trusted_workflow}" | cut -d: -f1)"
if [[ "${publish_recheck_line}" -ge "${publish_line}" ]]; then
  echo "ERROR: live package kill-switch recheck must precede publication" >&2
  exit 1
fi

echo "shadow preview v2 authority contract passed"
