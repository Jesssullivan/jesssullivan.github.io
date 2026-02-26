#!/usr/bin/env bash
#
# propagate-dispatch-secret.sh
#
# Sets BLOG_DISPATCH_TOKEN as an Actions secret on all public repos
# owned by Jesssullivan. This token enables source repos to trigger
# repository_dispatch on jesssullivan.github.io for blog post collection.
#
# Usage:
#   echo "ghp_your_token_here" | ./scripts/propagate-dispatch-secret.sh
#   # or interactively:
#   ./scripts/propagate-dispatch-secret.sh
#
# The token needs `contents:write` permission on jesssullivan.github.io
# (a fine-grained PAT scoped to that single repo is ideal).

set -euo pipefail

SECRET_NAME="BLOG_DISPATCH_TOKEN"
OWNER="Jesssullivan"

# Read token from stdin or prompt
if [ -t 0 ]; then
  echo "Enter the PAT value for ${SECRET_NAME}:"
  read -rs TOKEN
else
  read -r TOKEN
fi

if [ -z "$TOKEN" ]; then
  echo "Error: empty token" >&2
  exit 1
fi

echo "Fetching repos for ${OWNER}..."
REPOS=$(gh repo list "$OWNER" --source --no-archived --json name --jq '.[].name' --limit 200)
COUNT=$(echo "$REPOS" | wc -l | tr -d ' ')
echo "Found ${COUNT} repos"
echo

UPDATED=0
SKIPPED=0

for REPO in $REPOS; do
  FULL="${OWNER}/${REPO}"
  # Skip the blog repo itself — it doesn't need to dispatch to itself
  if [ "$REPO" = "jesssullivan.github.io" ]; then
    echo "  skip ${FULL} (blog repo)"
    ((SKIPPED++))
    continue
  fi

  echo -n "  ${FULL}... "
  if echo "$TOKEN" | gh secret set "$SECRET_NAME" --repo "$FULL" 2>/dev/null; then
    echo "ok"
    ((UPDATED++))
  else
    echo "failed (no admin access?)"
    ((SKIPPED++))
  fi
done

echo
echo "Done: ${UPDATED} repos updated, ${SKIPPED} skipped"
