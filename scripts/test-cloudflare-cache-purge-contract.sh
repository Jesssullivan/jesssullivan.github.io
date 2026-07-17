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
require_fixed "request GET 'https://api.cloudflare.com/client/v4/user/tokens/verify'" "user-token verification"
require_fixed 'request GET "https://api.cloudflare.com/client/v4/accounts/$ACCOUNT_ID/tokens/verify"' "account-token verification"
require_fixed 'if ! token_is_active; then' "account-token fallback"
require_fixed '"$(jq -r '\''.result.status // ""'\'' <<<"$REQUEST_BODY")" == active' "active-token requirement"
require_fixed "ZONE_ID: 602400322c1ecac4983542c76af90115" "fixed zone authority"
require_fixed 'target_url="https://transscendsurvival.org${TARGET_PATH}"' "fixed production host"
require_fixed '{files:[$url]}' "one-URL purge payload"
require_fixed '[[ "$TARGET_PATH" == *%* || "$TARGET_PATH" == *\\* || "$TARGET_PATH" == *//* ]]' "encoded and ambiguous path rejection"
require_fixed '[[ "$TARGET_PATH" == "/." || "$TARGET_PATH" == *"/./"* || "$TARGET_PATH" == *"/." ]]' "dot-segment rejection"

for forbidden in purge_everything '"tags"' '"hosts"' '"prefixes"'; do
  if grep -Fq -- "${forbidden}" "${workflow}"; then
    echo "ERROR: cache purge workflow contains broad purge mode: ${forbidden}" >&2
    exit 1
  fi
done

if [[ "$(grep -Fc -- 'request POST "https://api.cloudflare.com/client/v4/zones/$ZONE_ID/purge_cache" "$payload"' "${workflow}")" != 1 ]]; then
  echo "ERROR: cache purge workflow must contain exactly one purge request" >&2
  exit 1
fi

user_verify_line="$(grep -Fn -- "request GET 'https://api.cloudflare.com/client/v4/user/tokens/verify'" "${workflow}" | cut -d: -f1)"
account_verify_line="$(grep -Fn -- 'request GET "https://api.cloudflare.com/client/v4/accounts/$ACCOUNT_ID/tokens/verify"' "${workflow}" | cut -d: -f1)"
zone_verify_line="$(grep -Fn -- 'request GET "https://api.cloudflare.com/client/v4/zones/$ZONE_ID"' "${workflow}" | cut -d: -f1)"
purge_line="$(grep -Fn -- 'request POST "https://api.cloudflare.com/client/v4/zones/$ZONE_ID/purge_cache" "$payload"' "${workflow}" | cut -d: -f1)"

if ! ((user_verify_line < account_verify_line && account_verify_line < zone_verify_line && zone_verify_line < purge_line)); then
  echo "ERROR: cache purge workflow must verify token and zone before purging" >&2
  exit 1
fi

echo "Cloudflare cache purge contract passed"
