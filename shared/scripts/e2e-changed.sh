#!/usr/bin/env bash
#
# e2e-changed.sh — map git-changed feature folders to Playwright @tags.
#
# Usage:
#   bash shared/scripts/e2e-changed.sh [base_branch] [app]
#
# Arguments:
#   base_branch  Branch to diff against (default: origin/master)
#   app          "main" or "tfc" (default: auto-detect from changed files)
#
# Output:
#   A grep pattern string for Playwright, e.g. "@waiting-room|@player"
#   Exits 0 with pattern, or exits 1 if no mapping found (run full suite).

set -euo pipefail

BASE="${1:-origin/master}"
APP="${2:-}"

# ── Feature-folder → tag mapping ────────────────────────────────────
# Main app features
declare -A MAIN_MAP=(
  [landing]="@landing"
  [auth]="@auth"
  [register]="@auth"
  [dashboard]="@dashboard"
  [user-profile]="@user-profile"
  [admin-permissions]="@admin"
  [weather]="@weather"
  [canary]="@canary"
)

# TFC app features
declare -A TFC_MAP=(
  [home]="@home|@landing"
  [waiting-room]="@waiting-room"
  [player]="@player"
  [game-master]="@game-master"
  [scenario-builder]="@scenario-builder"
  [review]="@review"
)

# ── Collect changed files ───────────────────────────────────────────

CHANGED=$(git diff --name-only "$BASE"...HEAD 2>/dev/null || git diff --name-only "$BASE")

# ── Determine which app(s) changed ─────────────────────────────────

MAIN_CHANGED=false
TFC_CHANGED=false

if echo "$CHANGED" | grep -q "apps/main/frontend/"; then
  MAIN_CHANGED=true
fi
if echo "$CHANGED" | grep -q "apps/tfc/frontend/"; then
  TFC_CHANGED=true
fi
# Shared packages affect both apps
if echo "$CHANGED" | grep -q "packages/"; then
  MAIN_CHANGED=true
  TFC_CHANGED=true
fi

# ── Build tag set from changed feature folders ──────────────────────

TAGS=()

collect_tags() {
  local app_path="$1"
  shift
  local -n map_ref=$1

  local features
  features=$(echo "$CHANGED" | grep "$app_path/src/app/features/" | \
    sed "s|.*$app_path/src/app/features/||" | cut -d/ -f1 | sort -u)

  for feature in $features; do
    if [[ -n "${map_ref[$feature]:-}" ]]; then
      TAGS+=("${map_ref[$feature]}")
    fi
  done

  # E2E spec files changed directly → extract tags from filenames
  local specs
  specs=$(echo "$CHANGED" | grep "$app_path/e2e/tests/.*\.spec\.ts" | \
    sed "s|.*e2e/tests/||;s|\.spec\.ts||" | sort -u)

  for spec in $specs; do
    # Map spec filename to tag (e.g. waiting-room.spec.ts → @waiting-room)
    TAGS+=("@${spec}")
  done
}

if [[ "$APP" == "main" ]] || { [[ -z "$APP" ]] && $MAIN_CHANGED; }; then
  collect_tags "apps/main/frontend" MAIN_MAP
fi

if [[ "$APP" == "tfc" ]] || { [[ -z "$APP" ]] && $TFC_CHANGED; }; then
  collect_tags "apps/tfc/frontend" TFC_MAP
fi

# ── Deduplicate and output ──────────────────────────────────────────

if [[ ${#TAGS[@]} -eq 0 ]]; then
  echo "NO_MATCH" >&2
  exit 1
fi

# Deduplicate, join with |
PATTERN=$(printf '%s\n' "${TAGS[@]}" | tr '|' '\n' | sort -u | paste -sd'|')

echo "$PATTERN"
