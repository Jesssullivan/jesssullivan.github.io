#!/usr/bin/env bash
# shellcheck disable=SC2016 # GitHub expressions below are literal source contracts.
set -euo pipefail

if [[ -n "${TEST_SRCDIR:-}" && -n "${TEST_WORKSPACE:-}" ]]; then
  workspace="${TEST_SRCDIR}/${TEST_WORKSPACE}"
else
  workspace="${BUILD_WORKSPACE_DIRECTORY:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"
fi

production="${workspace}/.github/workflows/cloudflare-pages-production-v2.yml"
parity="${workspace}/.github/workflows/cloudflare-pages-parity-v2.yml"
shadow_source="${workspace}/.github/workflows/shadow-source-build-v2.yml"
shadow_publish="${workspace}/.github/workflows/shadow-source-publish-v2.yml"
pages_rollback="${workspace}/.github/workflows/github-pages-rollback-v2.yml"
production_health="${workspace}/.github/workflows/production-health-v2.yml"
private_cv="${workspace}/.github/workflows/private-cv-authority-v2.yml"
theme_switcher="${workspace}/src/lib/components/ThemeSwitcher.svelte"
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
require_in_file "${production}" "types: [cloudflare-pages-production-v2]" "default-owned production repository dispatch"
require_in_file "${production}" "github.event.workflow_run.conclusion == 'success'" "successful workflow conclusion gate"
require_in_file "${production}" "github.event.workflow_run.event == 'push'" "push-event gate"
require_in_file "${production}" "github.event.workflow_run.head_branch == 'main'" "main-branch gate"
require_in_file "${production}" "github.event.workflow_run.head_repository.full_name == github.repository" "same-repository gate"
require_in_file "${production}" 'for (const requiredName of ["build-and-test", "bazel-remote-gates"])' "required authority-job names"
require_in_file "${production}" 'job.conclusion !== "success"' "required authority-job conclusion gate"
require_in_file "${production}" 'workflow_id: "ci.yml"' "manual canonical-CI lookup"
require_in_file "${production}" 'workflow_id: "private-cv-authority-v2.yml"' "exact-SHA private CV prerequisite"
require_in_file "${production}" 'mainRef.data.object.sha !== sourceSha' "manual current-main binding"
require_in_file "${production}" 'Successful CI SHA ${sourceSha} is stale; current main is ${mainRef.data.object.sha}.' "automatic current-main binding"
require_in_file "${production}" "PRODUCTION_ENABLED: \${{ vars.CLOUDFLARE_PAGES_PRODUCTION_ENABLED || 'false' }}" "fail-closed operator gate"
require_in_file "${production}" 'deploy = false' "automatic build-only gate"
require_in_file "${production}" 'process.env.REQUEST_DEPLOY !== "true"' "explicit deploy request gate"
require_in_file "${production}" 'process.env.PRODUCTION_ENABLED !== "true"' "live operator production gate"
require_in_file "${production}" 'deploy = true' "typed operator dispatch deploy decision"
require_in_file "${production}" "if: github.event_name == 'repository_dispatch' && needs.resolve.outputs.deploy == 'true'" "typed-dispatch-only credential step gate"
require_in_file "${production}" 'ref: ${{ needs.resolve.outputs.source_sha }}' "exact production checkout"
require_in_file "${production}" 'PUBLIC_DEPLOY_TIER: production' "production deploy tier"
require_in_file "${production}" '--commit-hash=${{ needs.resolve.outputs.source_sha }} --commit-dirty=false' "Cloudflare commit provenance"
require_in_file "${production}" 'cloudflare/wrangler-action@ebbaa1584979971c8614a24965b4405ff95890e0 # v4' "credential-bearing Wrangler action pin"
require_in_file "${production}" 'actions/checkout@d23441a48e516b6c34aea4fa41551a30e30af803 # v6' "pinned production checkout"
require_in_file "${production}" 'actions/setup-node@249970729cb0ef3589644e2896645e5dc5ba9c38 # v6' "pinned production Node setup"
require_in_file "${production}" 'Static content digest:' "static artifact digest evidence"
require_in_file "${production}" 'Revalidate production kill switch and current main immediately before publish' "pre-publish kill-switch/current-main gate"
require_in_file "${production}" 'name: "CLOUDFLARE_PAGES_PRODUCTION_ENABLED"' "live production kill-switch read"
require_in_file "${production}" 'Refusing stale production publish:' "pre-publish stale-SHA failure"

revalidate_line="$(grep -nF 'Revalidate production kill switch and current main immediately before publish' "${production}" | cut -d: -f1)"
publish_line="$(grep -nF 'Publish exact production build to Cloudflare Pages' "${production}" | cut -d: -f1)"
if [[ -z "${revalidate_line}" || -z "${publish_line}" || "${revalidate_line}" -ge "${publish_line}" ]]; then
  echo "ERROR: current-main revalidation must run immediately before the production publish step" >&2
  exit 1
fi

if grep -Eq '^  push:' "${production}"; then
  echo "ERROR: production workflow must not race canonical CI from a concurrent push trigger" >&2
  exit 1
fi
if grep -Eq '^  pull_request:' "${production}"; then
  echo "ERROR: credentialed Cloudflare production workflow must not have a PR trigger" >&2
  exit 1
fi
if grep -Eq 'deployments:[[:space:]]*write|secrets\.GITHUB_TOKEN|github\.token' "${production}"; then
  echo "ERROR: production workflow carries unnecessary GitHub mutation authority" >&2
  exit 1
fi
if [[ -e "${workspace}/.github/workflows/cloudflare-pages-production.yml" ]]; then
  echo "ERROR: legacy credentialed Cloudflare workflow path still exists" >&2
  exit 1
fi
require_in_file "${parity}" "types: [cloudflare-pages-parity-v2]" "default-owned Cloudflare parity dispatch"
require_in_file "${parity}" 'pr.head.repo?.full_name !== `${owner}/${repo}`' "same-repo parity gate"
require_in_file "${parity}" 'pr.head.sha !== sourceSha' "exact PR-head parity gate"
require_in_file "${parity}" 'actions/checkout@d23441a48e516b6c34aea4fa41551a30e30af803 # v6' "pinned parity checkout"
require_in_file "${parity}" 'actions/setup-node@249970729cb0ef3589644e2896645e5dc5ba9c38 # v6' "pinned parity Node setup"
if grep -Eq 'secrets\.|deployments: write|cloudflare/wrangler-action|pages deploy' "${parity}"; then
  echo "ERROR: Cloudflare parity workflow contains deployment or secret authority" >&2
  exit 1
fi

while IFS= read -r workflow_file; do
  has_pr_trigger=false
  has_manual_carrier=false
  has_authority=false
  grep -Eq '^[[:space:]]+(pull_request|pull_request_target)[[:space:]]*:' "${workflow_file}" && has_pr_trigger=true
  grep -Eq '^[[:space:]]+workflow_dispatch[[:space:]]*:' "${workflow_file}" && has_manual_carrier=true
  grep -Eq 'secrets\.|github\.token|id-token:[[:space:]]*write|contents:[[:space:]]*write|pull-requests:[[:space:]]*write|issues:[[:space:]]*write|actions:[[:space:]]*write|deployments:[[:space:]]*write|pages:[[:space:]]*write|packages:[[:space:]]*write|createWorkflowDispatch|create-pull-request|git push|pulls\.merge' "${workflow_file}" && has_authority=true

  if [[ "${has_pr_trigger}" == true ]] && grep -Eq 'secrets\.|github\.token|GITHUB_TOKEN' "${workflow_file}"; then
    echo "ERROR: PR-triggered workflow references a token or secret: ${workflow_file}" >&2
    exit 1
  fi
  if [[ "${has_manual_carrier}" == true ]] && [[ "${has_authority}" == true ]]; then
    echo "ERROR: branch-selectable workflow_dispatch carries credential or mutation authority: ${workflow_file}" >&2
    exit 1
  fi
done < <(find -L "${workspace}/.github/workflows" -maxdepth 1 -type f \( -name '*.yml' -o -name '*.yaml' \) -print)
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
require_in_file "${shadow_source}" 'PUBLIC_SOURCE_SHA=${{ needs.resolve.outputs.sha }}' "PR shadow source SHA"
require_in_file "${shadow_source}" "push: false" "unprivileged source build"
require_in_file "${shadow_publish}" "workflow_run:" "trusted default-branch publication path"
require_in_file "${dockerfile}" "RUN npm ci --no-audit --no-fund" "lock-enforced shadow install"

if [[ -e "${workspace}/.github/workflows/shadow-image.yml" ]]; then
  echo "ERROR: legacy branch-authored shadow package-write workflow still exists" >&2
  exit 1
fi

require_in_file "${pages_rollback}" "types: [github-pages-rollback-v2]" "default-owned GitHub Pages rollback dispatch"
require_in_file "${pages_rollback}" 'github.event.client_payload.confirm_rollback' "explicit rollback confirmation"
require_in_file "${pages_rollback}" "BLOG_GITHUB_PAGES_ROLLBACK_ENABLED" "rollback kill switch"
require_in_file "${pages_rollback}" 'mainRef.data.object.sha !== sourceSha' "rollback current-main binding"
require_in_file "${pages_rollback}" 'for (const requiredName of ["build-and-test", "bazel-remote-gates"])' "rollback canonical authority jobs"
require_in_file "${pages_rollback}" 'workflow_id: "private-cv-authority-v2.yml"' "rollback private CV prerequisite"
require_in_file "${pages_rollback}" "Revalidate rollback kill switch and current main" "last-moment rollback gate"
if grep -Eq '^  push:|deploy-pages\.yml' "${pages_rollback}"; then
  echo "ERROR: GitHub Pages rollback workflow must not carry automatic or legacy dispatch triggers" >&2
  exit 1
fi
if grep -Eq 'workflow_dispatch:' "${production}" "${parity}" "${shadow_source}" "${pages_rollback}" "${private_cv}"; then
  echo "ERROR: v2 authority paths must be default-owned repository dispatch, workflow_run, schedule, or main push" >&2
  exit 1
fi

for legacy in \
  blog-post-bot.yml \
  build-cv.yml \
  cloudflare-cache-purge.yml \
  cloudflare-dns-drift.yml \
  cloudflare-dns-drift-v2.yml \
  collect-posts.yml \
  production-health.yml \
  auto-merge-scheduled.yml \
  content-stats.yml \
  content-stats-v2.yml \
  collect-posts-v2.yml \
  notify-blog-template.yml \
  shadow-preview.yml \
  shadow-image.yml \
  shadow-publish-apply-v2.yml \
  deploy-pages.yml; do
  if [[ -e "${workspace}/.github/workflows/${legacy}" ]]; then
    echo "ERROR: retired branch-selectable workflow path remains: ${legacy}" >&2
    exit 1
  fi
done
if grep -Eq 'github-pages|deploy-pages\.yml|pages_deployment' "${production_health}"; then
  echo "ERROR: production health must observe Cloudflare production, not self-heal deprecated GitHub Pages" >&2
  exit 1
fi
if grep -Fq -- "actions/workflows/deploy-pages.yml" "${theme_switcher}"; then
  echo "ERROR: public UI still links to the deprecated GitHub Pages CI/CD workflow" >&2
  exit 1
fi

while IFS= read -r workflow_file; do
  while IFS= read -r uses_ref; do
    action_ref="${uses_ref##*@}"
    action_ref="${action_ref%% *}"
    if [[ ! "${action_ref}" =~ ^[0-9a-f]{40}$ ]]; then
      echo "ERROR: workflow action is not pinned to an exact commit: ${workflow_file}: ${uses_ref}" >&2
      exit 1
    fi
  done < <(sed -nE '/^[[:space:]]*-?[[:space:]]*uses:[[:space:]]+\.\//d; s/^[[:space:]]*-?[[:space:]]*uses:[[:space:]]+([^[:space:]#]+).*/\1/p' "${workflow_file}")
done < <(find -L "${workspace}/.github/workflows" -maxdepth 1 -type f \( -name '*.yml' -o -name '*.yaml' \) -print)

echo "deploy provenance contract passed"
