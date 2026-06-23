#!/usr/bin/env bash
# scripts/cache-attachment-contract.sh - Classify the current cache attachment
# state without contacting cache services or running Bazel.

set -euo pipefail

STRICT=false
STRICT_NIX=false

usage() {
  cat >&2 <<'EOF'
Usage: scripts/cache-attachment-contract.sh [--strict] [--strict-nix]

Print the current GloriousFlywheel cache attachment contract.

Without --strict, this command is descriptive and exits 0 even when local Bazel
is in compatibility-local-only mode. With --strict, it exits nonzero unless a
real BAZEL_REMOTE_CACHE endpoint is set and the derived substrate mode is
shared-cache-backed.

With --strict-nix, it also exits nonzero unless ATTIC_SERVER, ATTIC_CACHE, and
ATTIC_PUBLIC_KEY are configured and NIX_CONFIG includes the matching Attic
substituter and trusted public key. This is a configuration preflight, not a
cache hit-rate or remote-execution proof.

Set BAZEL_REMOTE_EXECUTOR only for the opt-in executor-backed mode. That mode
requires BAZEL_REMOTE_CACHE to prove the runner received cache wiring and
GF_BAZEL_SUBSTRATE_MODE=executor-backed. The Bazel wrapper may still use the
executor endpoint as the effective REAPI CAS/cache so Execute can read uploaded
action/input digests.
EOF
}

for arg in "$@"; do
  case "${arg}" in
  --strict)
    STRICT=true
    ;;
  --strict-nix)
    STRICT_NIX=true
    ;;
  -h | --help)
    usage
    exit 0
    ;;
  *)
    usage
    exit 2
    ;;
  esac
done

BAZEL_REMOTE_CACHE_VALUE="${BAZEL_REMOTE_CACHE:-}"
BAZEL_REMOTE_EXECUTOR_VALUE="${BAZEL_REMOTE_EXECUTOR:-}"
GF_BAZEL_MODE_VALUE="${GF_BAZEL_SUBSTRATE_MODE:-}"
GF_REAPI_TOKEN_FILE_VALUE="${GF_REAPI_CREDENTIAL_HELPER_TOKEN_FILE:-}"
GF_REAPI_INLINE_TOKEN_VALUE="${GF_REAPI_CREDENTIAL_HELPER_TOKEN:-}"
GF_REAPI_DEFAULT_TOKEN_FILE="/var/run/secrets/tokens/gf-reapi-cell-token"
ATTIC_SERVER_VALUE="${ATTIC_SERVER:-}"
ATTIC_CACHE_RAW_VALUE="${ATTIC_CACHE:-}"
ATTIC_CACHE_VALUE="${ATTIC_CACHE_RAW_VALUE:-main}"
ATTIC_PUBLIC_KEY_VALUE="${ATTIC_PUBLIC_KEY:-}"
NIX_CONFIG_VALUE="${NIX_CONFIG:-}"

nix_config_list_contains() {
  local key="$1"
  local expected="$2"
  local line=""
  local value=""
  local item=""

  while IFS= read -r line; do
    [[ $line =~ ^[[:space:]]*# ]] && continue
    [[ $line =~ ^[[:space:]]*${key}[[:space:]]*= ]] || continue
    value="${line#*=}"
    value="${value%%#*}"
    for item in $value; do
      if [[ $item == "$expected" ]]; then
        return 0
      fi
    done
  done <<<"${NIX_CONFIG_VALUE}"

  return 1
}

if [[ -n ${BAZEL_REMOTE_EXECUTOR_VALUE} ]]; then
  EXPECTED_BAZEL_MODE="executor-backed"
elif [[ -n ${BAZEL_REMOTE_CACHE_VALUE} ]]; then
  EXPECTED_BAZEL_MODE="shared-cache-backed"
else
  EXPECTED_BAZEL_MODE="compatibility-local-only"
fi

if [[ -z ${GF_BAZEL_MODE_VALUE} ]]; then
  EFFECTIVE_BAZEL_MODE="${EXPECTED_BAZEL_MODE}"
else
  EFFECTIVE_BAZEL_MODE="${GF_BAZEL_MODE_VALUE}"
fi

CONTEXT="developer-machine"
if [[ ${GITHUB_ACTIONS:-} == "true" ]]; then
  CONTEXT="github-actions"
elif [[ -n ${CI:-} ]]; then
  CONTEXT="ci"
fi

STALE_ENDPOINT=false
if [[ ${BAZEL_REMOTE_CACHE_VALUE} =~ (attic-cache-dev|fuzzy-dev|attic\.dev-cluster|attic\.tinyland) ]]; then
  STALE_ENDPOINT=true
fi

STALE_EXECUTOR_ENDPOINT=false
if [[ ${BAZEL_REMOTE_EXECUTOR_VALUE} =~ (attic-cache-dev|fuzzy-dev|attic\.dev-cluster|attic\.tinyland) ]]; then
  STALE_EXECUTOR_ENDPOINT=true
fi

LITERAL_ENDPOINT=false
if [[ ${BAZEL_REMOTE_CACHE_VALUE} == *'${'* ]] || [[ ${BAZEL_REMOTE_CACHE_VALUE} == *'}'* ]]; then
  LITERAL_ENDPOINT=true
fi

LITERAL_EXECUTOR_ENDPOINT=false
if [[ ${BAZEL_REMOTE_EXECUTOR_VALUE} == *'${'* ]] || [[ ${BAZEL_REMOTE_EXECUTOR_VALUE} == *'}'* ]]; then
  LITERAL_EXECUTOR_ENDPOINT=true
fi

UNSUPPORTED_ENDPOINT=false
if [[ -n ${BAZEL_REMOTE_CACHE_VALUE} ]] && [[ ! ${BAZEL_REMOTE_CACHE_VALUE} =~ ^(grpc|grpcs|http|https):// ]]; then
  UNSUPPORTED_ENDPOINT=true
fi

UNSUPPORTED_EXECUTOR_ENDPOINT=false
if [[ -n ${BAZEL_REMOTE_EXECUTOR_VALUE} ]] && [[ ! ${BAZEL_REMOTE_EXECUTOR_VALUE} =~ ^(grpc|grpcs|http|https):// ]]; then
  UNSUPPORTED_EXECUTOR_ENDPOINT=true
fi

EXPECTED_ATTIC_SUBSTITUTER=""
if [[ -n ${ATTIC_SERVER_VALUE} ]]; then
  EXPECTED_ATTIC_SUBSTITUTER="${ATTIC_SERVER_VALUE%/}/${ATTIC_CACHE_VALUE}"
fi

ATTIC_DECLARED=false
if [[ -n ${ATTIC_SERVER_VALUE} || -n ${ATTIC_PUBLIC_KEY_VALUE} ]]; then
  ATTIC_DECLARED=true
fi

ATTIC_CONFIGURED=false
if [[ -n ${EXPECTED_ATTIC_SUBSTITUTER} && -n ${ATTIC_PUBLIC_KEY_VALUE} ]]; then
  ATTIC_CONFIGURED=true
fi

NIX_HAS_ATTIC_SUBSTITUTER=false
if [[ -n ${EXPECTED_ATTIC_SUBSTITUTER} ]] && nix_config_list_contains "extra-substituters" "${EXPECTED_ATTIC_SUBSTITUTER}"; then
  NIX_HAS_ATTIC_SUBSTITUTER=true
fi

NIX_HAS_ATTIC_PUBLIC_KEY=false
if [[ -n ${ATTIC_PUBLIC_KEY_VALUE} ]] && nix_config_list_contains "extra-trusted-public-keys" "${ATTIC_PUBLIC_KEY_VALUE}"; then
  NIX_HAS_ATTIC_PUBLIC_KEY=true
fi

NIX_ATTACHED=false
if [[ ${ATTIC_CONFIGURED} == "true" && ${NIX_HAS_ATTIC_SUBSTITUTER} == "true" && ${NIX_HAS_ATTIC_PUBLIC_KEY} == "true" ]]; then
  NIX_ATTACHED=true
fi

NIX_ATTACHMENT_STATE="not-attached"
if [[ ${NIX_ATTACHED} == "true" ]]; then
  NIX_ATTACHMENT_STATE="attached"
elif [[ ${ATTIC_CONFIGURED} == "true" || ${NIX_HAS_ATTIC_SUBSTITUTER} == "true" || ${NIX_HAS_ATTIC_PUBLIC_KEY} == "true" ]]; then
  NIX_ATTACHMENT_STATE="partial"
fi

STALE_NIX_ENDPOINT=false
if [[ ${NIX_CONFIG_VALUE} =~ (attic-cache-dev|fuzzy-dev|attic\.dev-cluster|attic\.tinyland) ]]; then
  STALE_NIX_ENDPOINT=true
  NIX_ATTACHMENT_STATE="stale"
fi

display_value() {
  local value="$1"

  if [[ -z ${value} ]]; then
    echo "unset"
  elif [[ ${GITHUB_ACTIONS:-} == "true" ]]; then
    echo "configured"
  else
    echo "${value}"
  fi
}

endpoint_host() {
  local endpoint="$1"
  local without_scheme="${endpoint#*://}"
  local authority="${without_scheme%%/*}"

  echo "${authority%%:*}"
}

is_gf_reapi_host() {
  local host="$1"

  [[ ${host} == gf-reapi-cell* || ${host} == *.gf-rbe.svc || ${host} == *.gf-rbe.svc.* ]]
}

BAZEL_REQUIRES_GF_REAPI_CREDENTIALS=false
if [[ -n ${BAZEL_REMOTE_EXECUTOR_VALUE} ]] && is_gf_reapi_host "$(endpoint_host "${BAZEL_REMOTE_EXECUTOR_VALUE}")"; then
  BAZEL_REQUIRES_GF_REAPI_CREDENTIALS=true
elif [[ -n ${BAZEL_REMOTE_CACHE_VALUE} ]] && is_gf_reapi_host "$(endpoint_host "${BAZEL_REMOTE_CACHE_VALUE}")"; then
  BAZEL_REQUIRES_GF_REAPI_CREDENTIALS=true
fi

GF_REAPI_CREDENTIAL_STATE="not-required"
if [[ ${BAZEL_REQUIRES_GF_REAPI_CREDENTIALS} == "true" ]]; then
  if [[ -n ${GF_REAPI_TOKEN_FILE_VALUE} && -n ${GF_REAPI_INLINE_TOKEN_VALUE} ]]; then
    GF_REAPI_CREDENTIAL_STATE="ambiguous"
  elif [[ -n ${GF_REAPI_TOKEN_FILE_VALUE} ]]; then
    GF_REAPI_CREDENTIAL_STATE="token-file"
  elif [[ -n ${GF_REAPI_INLINE_TOKEN_VALUE} ]]; then
    GF_REAPI_CREDENTIAL_STATE="inline-token"
  elif [[ -f ${GF_REAPI_DEFAULT_TOKEN_FILE} ]]; then
    GF_REAPI_CREDENTIAL_STATE="projected-token-file"
  else
    GF_REAPI_CREDENTIAL_STATE="missing"
  fi
fi

cat <<EOF
Cache Attachment Contract
=========================
Context:            ${CONTEXT}
Attic server:       $(display_value "${ATTIC_SERVER_VALUE}")
Attic cache:        ${ATTIC_CACHE_VALUE}
Attic public key:   $([[ -n ${ATTIC_PUBLIC_KEY_VALUE} ]] && echo configured || echo unset)
Nix config:         ${NIX_ATTACHMENT_STATE}
Nix substituter:    $(display_value "${EXPECTED_ATTIC_SUBSTITUTER}")
Bazel mode:         ${EFFECTIVE_BAZEL_MODE}
Bazel remote cache: $(display_value "${BAZEL_REMOTE_CACHE_VALUE}")
Bazel executor:     $(display_value "${BAZEL_REMOTE_EXECUTOR_VALUE}")
GF REAPI auth:      ${GF_REAPI_CREDENTIAL_STATE}
Expected mode:      ${EXPECTED_BAZEL_MODE}
Strict Bazel:       ${STRICT}
Strict Nix:         ${STRICT_NIX}

Contract:
- self-hosted runners should receive cache endpoints from workflow/bootstrap setup
- developer machines only prove Bazel shared-cache dogfood when BAZEL_REMOTE_CACHE is explicitly set
- executor-backed Bazel work requires BAZEL_REMOTE_EXECUTOR and BAZEL_REMOTE_CACHE to be set explicitly
- BAZEL_REMOTE_EXECUTOR and BAZEL_REMOTE_CACHE are separately declared runner attachments; executor-backed Bazel may use a unified executor CAS/cache
- gf-reapi-cell endpoints require a scoped Bazel credential helper with a short-lived JWT source
- developer machines prove Attic/Nix cache attachment when NIX_CONFIG carries the Attic substituter and public key
- empty BAZEL_REMOTE_CACHE means compatibility-local-only unless an invalid executor-only configuration is present
- literal shell placeholders are invalid; Bazel rc files do not expand environment variables
- stale fuzzy-dev, attic-cache-dev, attic.dev-cluster, and attic.tinyland endpoint names are out of contract
EOF

if [[ ${EFFECTIVE_BAZEL_MODE} != "${EXPECTED_BAZEL_MODE}" ]]; then
  echo
  echo "ERROR: GF_BAZEL_SUBSTRATE_MODE=${EFFECTIVE_BAZEL_MODE} disagrees with Bazel endpoint presence."
  exit 1
fi

if [[ ${STALE_ENDPOINT} == "true" ]]; then
  echo
  echo "ERROR: BAZEL_REMOTE_CACHE points at a stale or explicitly out-of-contract endpoint."
  exit 1
fi

if [[ ${STALE_EXECUTOR_ENDPOINT} == "true" ]]; then
  echo
  echo "ERROR: BAZEL_REMOTE_EXECUTOR points at a stale or explicitly out-of-contract endpoint."
  exit 1
fi

if [[ ${LITERAL_ENDPOINT} == "true" ]]; then
  echo
  echo "ERROR: BAZEL_REMOTE_CACHE is a literal shell placeholder, not a real endpoint."
  exit 1
fi

if [[ ${LITERAL_EXECUTOR_ENDPOINT} == "true" ]]; then
  echo
  echo "ERROR: BAZEL_REMOTE_EXECUTOR is a literal shell placeholder, not a real endpoint."
  exit 1
fi

if [[ ${UNSUPPORTED_ENDPOINT} == "true" ]]; then
  echo
  echo "ERROR: BAZEL_REMOTE_CACHE must start with grpc://, grpcs://, http://, or https://."
  exit 1
fi

if [[ ${UNSUPPORTED_EXECUTOR_ENDPOINT} == "true" ]]; then
  echo
  echo "ERROR: BAZEL_REMOTE_EXECUTOR must start with grpc://, grpcs://, http://, or https://."
  exit 1
fi

if [[ -n ${BAZEL_REMOTE_EXECUTOR_VALUE} && -z ${BAZEL_REMOTE_CACHE_VALUE} ]]; then
  echo
  echo "ERROR: executor-backed mode requires BAZEL_REMOTE_CACHE to prove runner cache wiring."
  exit 1
fi

if [[ ${GF_REAPI_CREDENTIAL_STATE} == "ambiguous" ]]; then
  echo
  echo "ERROR: set either GF_REAPI_CREDENTIAL_HELPER_TOKEN_FILE or GF_REAPI_CREDENTIAL_HELPER_TOKEN, not both."
  exit 1
fi

if [[ ${STRICT} == "true" && ${GF_REAPI_CREDENTIAL_STATE} == "missing" ]]; then
  echo
  echo "ERROR: gf-reapi-cell endpoint requires a JWT source for the Bazel credential helper."
  echo "Set GF_REAPI_CREDENTIAL_HELPER_TOKEN_FILE, GF_REAPI_CREDENTIAL_HELPER_TOKEN, or mount ${GF_REAPI_DEFAULT_TOKEN_FILE}."
  exit 1
fi

if [[ ${STRICT_NIX} == "true" && ${STALE_NIX_ENDPOINT} == "true" ]]; then
  echo
  echo "ERROR: NIX_CONFIG points at a stale or explicitly out-of-contract Attic endpoint."
  exit 1
fi

if [[ ${STRICT_NIX} == "true" && ${ATTIC_DECLARED} == "true" && ${ATTIC_CONFIGURED} != "true" ]]; then
  echo
  echo "ERROR: Attic/Nix attachment is partially configured; set ATTIC_SERVER, ATTIC_CACHE, and ATTIC_PUBLIC_KEY together."
  exit 1
fi

if [[ ${STRICT} == "true" && -z ${BAZEL_REMOTE_CACHE_VALUE} ]]; then
  echo
  echo "ERROR: strict mode requires BAZEL_REMOTE_CACHE to be set."
  exit 1
fi

if [[ ${STRICT_NIX} == "true" && ${NIX_ATTACHED} != "true" ]]; then
  echo
  echo "ERROR: strict Nix mode requires NIX_CONFIG to include the configured Attic substituter and public key."
  exit 1
fi

echo
echo "Status: ${EXPECTED_BAZEL_MODE}"
