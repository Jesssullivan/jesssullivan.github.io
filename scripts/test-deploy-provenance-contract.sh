#!/usr/bin/env bash
# shellcheck disable=SC2016 # GitHub expressions below are literal source contracts.
set -euo pipefail

if [[ -n "${TEST_SRCDIR:-}" && -n "${TEST_WORKSPACE:-}" ]]; then
  workspace="${TEST_SRCDIR}/${TEST_WORKSPACE}"
else
  workspace="${BUILD_WORKSPACE_DIRECTORY:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"
fi

production="${workspace}/.github/workflows/cloudflare-pages-production.yml"
shadow_preview="${workspace}/.github/workflows/shadow-preview.yml"
shadow_image="${workspace}/.github/workflows/shadow-image.yml"
dockerfile="${workspace}/Dockerfile.shadow"
layout="${workspace}/src/routes/+layout.svelte"
vite="${workspace}/vite.config.ts"
package_json="${workspace}/package.json"
stamper="${workspace}/scripts/stamp-deploy-tier-output.mjs"

require_in_file() {
  local file="$1"
  local needle="$2"
  local label="$3"
  if ! grep -Fq -- "${needle}" "${file}"; then
    echo "ERROR: ${label} missing: ${needle}" >&2
    exit 1
  fi
}

require_in_file "${production}" "workflows: ['CI']" "canonical CI workflow_run trigger"
require_in_file "${production}" "github.event.workflow_run.conclusion == 'success'" "successful workflow conclusion gate"
require_in_file "${production}" "github.event.workflow_run.event == 'push'" "push-event gate"
require_in_file "${production}" "github.event.workflow_run.head_branch == 'main'" "main-branch gate"
require_in_file "${production}" "github.event.workflow_run.head_repository.full_name == github.repository" "same-repository gate"
require_in_file "${production}" 'for (const requiredName of ["build-and-test", "bazel-remote-gates"])' "required authority-job names"
require_in_file "${production}" 'job.conclusion !== "success"' "required authority-job conclusion gate"
require_in_file "${production}" 'workflow_id: "ci.yml"' "manual canonical-CI lookup"
require_in_file "${production}" 'mainRef.data.object.sha !== sourceSha' "manual current-main binding"
require_in_file "${production}" 'Successful CI SHA ${sourceSha} is stale; current main is ${mainRef.data.object.sha}.' "automatic current-main binding"
require_in_file "${production}" "PRODUCTION_ENABLED: \${{ vars.CLOUDFLARE_PAGES_PRODUCTION_ENABLED || 'false' }}" "fail-closed operator gate"
require_in_file "${production}" 'deploy = process.env.PRODUCTION_ENABLED === "true"' "automatic operator gate"
require_in_file "${production}" 'deploy = process.env.MANUAL_DEPLOY === "true" && process.env.PRODUCTION_ENABLED === "true"' "manual operator gate"
require_in_file "${production}" 'ref: ${{ needs.resolve.outputs.source_sha }}' "exact production checkout"
require_in_file "${production}" 'PUBLIC_DEPLOY_TIER: production' "production deploy tier"
require_in_file "${production}" '--commit-hash=${{ needs.resolve.outputs.source_sha }} --commit-dirty=false' "Cloudflare commit provenance"
require_in_file "${production}" 'cloudflare/wrangler-action@ebbaa1584979971c8614a24965b4405ff95890e0 # v4' "credential-bearing Wrangler action pin"
require_in_file "${production}" 'Static content digest:' "static artifact digest evidence"
require_in_file "${production}" 'Revalidate current main immediately before publish' "pre-publish current-main gate"
require_in_file "${production}" 'Refusing stale production publish:' "pre-publish stale-SHA failure"

revalidate_line="$(grep -nF 'Revalidate current main immediately before publish' "${production}" | cut -d: -f1)"
publish_line="$(grep -nF 'Publish exact production build to Cloudflare Pages' "${production}" | cut -d: -f1)"
if [[ -z "${revalidate_line}" || -z "${publish_line}" || "${revalidate_line}" -ge "${publish_line}" ]]; then
  echo "ERROR: current-main revalidation must run immediately before the production publish step" >&2
  exit 1
fi

if grep -Eq '^  push:' "${production}"; then
  echo "ERROR: production workflow must not race canonical CI from a concurrent push trigger" >&2
  exit 1
fi
if [[ -e "${workspace}/.github/workflows/cloudflare-pages-shadow.yml" ]]; then
  echo "ERROR: misleading Cloudflare Pages shadow workflow still exists" >&2
  exit 1
fi

require_in_file "${vite}" "process.env.PUBLIC_DEPLOY_TIER || 'production'" "local production default"
require_in_file "${vite}" "deployTier === 'shadow' && !/^[0-9a-f]{40}$/.test(sourceSha)" "shadow exact-SHA fail-closed gate"
require_in_file "${layout}" '<meta name="robots" content="noindex,nofollow" data-deploy-tier="shadow" />' "site-wide shadow robots marker"
require_in_file "${layout}" '<meta name="tinyland-source-sha" content={__BLOG_SOURCE_SHA__} data-deploy-tier="shadow" />' "site-wide shadow SHA marker"
require_in_file "${package_json}" 'node scripts/stamp-deploy-tier-output.mjs' "fallback HTML shadow stamping"
require_in_file "${stamper}" 'rewriteCompressedSibling' "precompressed fallback provenance"
require_in_file "${production}" 'node scripts/validate-deploy-tier-output.mjs production' "generated production HTML proof"
require_in_file "${dockerfile}" 'node scripts/validate-deploy-tier-output.mjs shadow "${PUBLIC_SOURCE_SHA}"' "generated shadow HTML proof"
require_in_file "${workspace}/scripts/validate-deploy-tier-output.mjs" "'.bg-surface-200-800'" "emitted Skeleton paired-utility proof"
require_in_file "${dockerfile}" 'ARG PUBLIC_SOURCE_SHA' "required Docker source SHA"
require_in_file "${dockerfile}" "grep -Eq '^[0-9a-f]{40}$'" "Docker exact-SHA fail-closed gate"
require_in_file "${shadow_preview}" 'PUBLIC_SOURCE_SHA=${{ needs.resolve.outputs.sha }}' "PR shadow source SHA"
require_in_file "${shadow_preview}" 'SOURCE_DIGEST: ${{ steps.source_image.outputs.digest }}' "PR shadow OCI digest"
require_in_file "${shadow_preview}" "BLOG_SHADOW_APPLY_ENABLED: \${{ vars.BLOG_SHADOW_APPLY_ENABLED || 'false' }}" "fail-closed shadow apply gate"
require_in_file "${shadow_preview}" 'const applyEnabled = process.env.BLOG_SHADOW_APPLY_ENABLED === "true"' "shadow apply gate resolver"
require_in_file "${shadow_preview}" "if: needs.resolve.outputs.deploy == 'true' && needs.resolve.outputs.apply == 'true'" "private receiver dispatch gate"
require_in_file "${shadow_preview}" 'if (pr.draft)' "draft PR gate"
require_in_file "${shadow_image}" 'source_sha="$(git rev-parse HEAD)"' "legacy shadow checked-out SHA"
require_in_file "${shadow_image}" 'PUBLIC_SOURCE_SHA=${{ steps.source.outputs.source_sha }}' "legacy shadow source SHA build arg"

echo "deploy provenance contract passed"
