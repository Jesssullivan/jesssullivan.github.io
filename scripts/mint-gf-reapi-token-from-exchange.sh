#!/usr/bin/env bash
# Mint a short-lived gf-reapi-cell token from the GF-hosted GitHub OIDC
# exchange. This script never prints bearer tokens.

set -euo pipefail

exchange_url="${GF_REAPI_TOKEN_EXCHANGE_URL:-http://gf-reapi-token-exchange.gf-rbe.svc.cluster.local:8081/v1/token/exchange}"
audience="${GF_REAPI_TOKEN_EXCHANGE_AUDIENCE:-gloriousflywheel-token-exchange}"
request_mode="${GF_REAPI_TOKEN_EXCHANGE_REQUEST:-executor}"
ttl="${GF_REAPI_TOKEN_EXCHANGE_TTL:-45m}"
token_file="${GF_REAPI_CREDENTIAL_HELPER_TOKEN_FILE:-${RUNNER_TEMP:-/tmp}/gf-reapi-cell-token.jwt}"

if [[ -z ${ACTIONS_ID_TOKEN_REQUEST_URL:-} || -z ${ACTIONS_ID_TOKEN_REQUEST_TOKEN:-} ]]; then
  echo "ERROR: GitHub Actions id-token environment is unavailable; check workflow permissions.id-token." >&2
  exit 1
fi

if ! command -v node >/dev/null 2>&1; then
  echo "ERROR: node is required to parse token-exchange JSON safely." >&2
  exit 127
fi

tmp_dir="$(mktemp -d)"
chmod 700 "${tmp_dir}"
request_body="${tmp_dir}/exchange-request.json"
response_body="${tmp_dir}/exchange-response.json"

cleanup() {
  rm -f "${request_body}" "${response_body}"
  rmdir "${tmp_dir}" 2>/dev/null || true
}
trap cleanup EXIT

oidc_url="$(
  ACTIONS_ID_TOKEN_REQUEST_URL="${ACTIONS_ID_TOKEN_REQUEST_URL}" \
  GF_REAPI_TOKEN_EXCHANGE_AUDIENCE="${audience}" \
    node -e 'const u = new URL(process.env.ACTIONS_ID_TOKEN_REQUEST_URL); u.searchParams.set("audience", process.env.GF_REAPI_TOKEN_EXCHANGE_AUDIENCE); process.stdout.write(u.toString());'
)"

github_oidc_response="$(
  curl --retry 3 --retry-all-errors --connect-timeout 10 -fsSL \
    -H "Authorization: Bearer ${ACTIONS_ID_TOKEN_REQUEST_TOKEN}" \
    "${oidc_url}"
)"

github_oidc_token="$(
  GITHUB_OIDC_RESPONSE="${github_oidc_response}" \
    node -e 'const body = JSON.parse(process.env.GITHUB_OIDC_RESPONSE); if (typeof body.value !== "string" || body.value.length === 0) { throw new Error("GitHub OIDC response did not include value"); } process.stdout.write(body.value);'
)"

GITHUB_OIDC_TOKEN="${github_oidc_token}" node -e '
const token = process.env.GITHUB_OIDC_TOKEN || "";
const parts = token.split(".");
if (parts.length < 2) {
  throw new Error("GitHub OIDC token did not look like a JWT");
}
const claims = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8"));
const show = (key) => typeof claims[key] === "string" && claims[key].length > 0 ? claims[key] : "unset";
console.log(`GF REAPI OIDC claims: repository=${show("repository")} owner=${show("repository_owner")} ref=${show("ref")} event=${show("event_name")} sub=${show("sub")}`);
'

REQUEST_MODE="${request_mode}" TOKEN_TTL="${ttl}" node -e '
const fs = require("node:fs");
fs.writeFileSync(process.argv[1], JSON.stringify({
  request: process.env.REQUEST_MODE,
  ttl: process.env.TOKEN_TTL,
  credential_helper_scope: "gf-reapi-cell.gf-rbe.svc.cluster.local",
  credential_helper_bin: "%workspace%/scripts/gf-reapi-bazel-credential-helper.mjs"
}) + "\n", { mode: 0o600 });
' "${request_body}"

http_status="$(
  curl --retry 3 --retry-all-errors --connect-timeout 10 -sS \
    -o "${response_body}" \
    -w "%{http_code}" \
    -X POST \
    -H "Authorization: Bearer ${github_oidc_token}" \
    -H "Content-Type: application/json" \
    --data-binary @"${request_body}" \
    "${exchange_url}"
)"

if [[ ! ${http_status} =~ ^2[0-9][0-9]$ ]]; then
  HTTP_STATUS="${http_status}" RESPONSE_BODY="${response_body}" node -e '
const fs = require("node:fs");
let message = "unavailable";
try {
  const body = JSON.parse(fs.readFileSync(process.env.RESPONSE_BODY, "utf8"));
  if (typeof body.error === "string" && body.error.length > 0) {
    message = body.error;
  }
} catch {}
console.error(`ERROR: GF REAPI token exchange failed: status=${process.env.HTTP_STATUS} error=${message}`);
'
  exit 22
fi

mkdir -p "$(dirname "${token_file}")"

TOKEN_FILE="${token_file}" RESPONSE_BODY="${response_body}" node -e '
const fs = require("node:fs");
const body = JSON.parse(fs.readFileSync(process.env.RESPONSE_BODY, "utf8"));
if (typeof body.token !== "string" || body.token.length === 0) {
  throw new Error("token-exchange response did not include token");
}
if (typeof body.instance_name !== "string" || body.instance_name.length === 0) {
  throw new Error("token-exchange response did not include instance_name");
}
fs.writeFileSync(process.env.TOKEN_FILE, body.token + "\n", { mode: 0o600 });
fs.chmodSync(process.env.TOKEN_FILE, 0o600);
console.log(`GF REAPI token minted: repository=${body.repository} ref=${body.ref} mode=${body.mode} tenant=${body.tenant} expires_at=${body.expires_at}`);
console.log(`GF_REAPI_EXCHANGE_INSTANCE_NAME=${body.instance_name}`);
' | tee "${tmp_dir}/exchange-metadata.txt"

instance_name="$(awk -F= '/^GF_REAPI_EXCHANGE_INSTANCE_NAME=/{print $2}' "${tmp_dir}/exchange-metadata.txt" | tail -1)"
if [[ -z ${instance_name} ]]; then
  echo "ERROR: token-exchange metadata did not include instance name." >&2
  exit 1
fi

if [[ -n ${GITHUB_ENV:-} ]]; then
  {
    echo "GF_REAPI_CREDENTIAL_HELPER_TOKEN_FILE=${token_file}"
    echo "BAZEL_REMOTE_INSTANCE_NAME=${BAZEL_REMOTE_INSTANCE_NAME:-${instance_name}}"
  } >>"${GITHUB_ENV}"
fi
