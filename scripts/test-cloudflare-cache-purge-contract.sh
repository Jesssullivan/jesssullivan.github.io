#!/usr/bin/env bash
# shellcheck disable=SC2016 # GitHub shell expressions below are literal source contracts.

set -euo pipefail

if [[ -n "${TEST_SRCDIR:-}" && -n "${TEST_WORKSPACE:-}" ]]; then
  workspace="${TEST_SRCDIR}/${TEST_WORKSPACE}"
else
  workspace="${BUILD_WORKSPACE_DIRECTORY:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"
fi
workflow="${workspace}/.github/workflows/cloudflare-cache-purge.yml"

require_fixed() {
  local needle="$1"
  local label="$2"

  if ! grep -Fq -- "${needle}" "${workflow}"; then
    echo "ERROR: cache purge workflow missing ${label}: ${needle}" >&2
    exit 1
  fi
}

require_fixed "ACCOUNT_ID: fdcb4fb750ab79be0800e885f09ddbdc" "fixed account authority"
require_fixed 'request GET "https://api.cloudflare.com/client/v4/accounts/$ACCOUNT_ID/tokens/verify"' "account-token verification"
require_fixed '"$token_status" != active' "active-token requirement"
require_fixed "ZONE_ID: 602400322c1ecac4983542c76af90115" "fixed zone authority"
require_fixed 'target_url="https://transscendsurvival.org${TARGET_PATH}"' "fixed production host"
require_fixed '{files:[$url]}' "one-URL purge payload"

if grep -Fq -- "/user/tokens/verify" "${workflow}"; then
  echo "ERROR: account-owned Cloudflare tokens must not use the user-token verifier" >&2
  exit 1
fi

echo "Cloudflare cache purge contract passed"
