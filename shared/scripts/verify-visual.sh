#!/usr/bin/env bash
# verify-visual.sh — Run visual snapshot tests for TFC frontend.
# Used by Claude Code PostToolUse hook after frontend view/CSS edits.
#
# Usage:
#   bash shared/scripts/verify-visual.sh          # run visual tests
#   bash shared/scripts/verify-visual.sh --update  # update baselines
#
# Exit codes:
#   0  = all snapshots match (or updated)
#   1  = snapshot diff detected (regression)
#   2  = dev server not running

set -euo pipefail

TFC_DIR="$(cd "$(dirname "$0")/../../apps/tfc/frontend" && pwd)"
BASE_URL="http://localhost:4201"

# Check if dev server is running
if ! curl -s --max-time 2 "$BASE_URL" > /dev/null 2>&1; then
  echo "VISUAL_VERIFY: dev server not running at $BASE_URL — skipping"
  exit 2
fi

cd "$TFC_DIR"

if [[ "${1:-}" == "--update" ]]; then
  npx playwright test --grep @visual --update-snapshots 2>&1
  echo "VISUAL_VERIFY: baselines updated"
else
  if npx playwright test --grep @visual 2>&1; then
    echo "VISUAL_VERIFY: PASS — all snapshots match"
  else
    echo "VISUAL_VERIFY: FAIL — snapshot diffs detected"
    echo "Run 'npm run e2e:visual:update' from apps/tfc/frontend/ to update baselines"
    exit 1
  fi
fi
