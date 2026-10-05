#!/usr/bin/env bash
set -euo pipefail
source_sha=${1:?exact source SHA required}
artifact=${2:?new absolute artifact directory required}
# The orchestrator records actual fixed-stage exit results; no standalone seal
# operation can manufacture gate claims without running those stages.
node scripts/local-production-artifact.mjs qualify "$artifact" "$source_sha"
