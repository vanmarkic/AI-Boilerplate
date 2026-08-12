#!/usr/bin/env bash
# lint-file-length.sh — Enforce per-category file length limits.
#
# Limits:
#   - Production source files:  350 lines
#   - UI primitives (packages/ui/src/):  150 lines (excluding *.spec.ts, *.stories.ts)
#   - Test files (*_test.py, *.spec.ts, *_prop_test.py):  500 lines
#   - E2E test files (e2e/):  no limit (skipped)
#
# Reads .lint-file-length-ignore for exclusions (one path pattern per line, comments with #).

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
IGNORE_FILE="$REPO_ROOT/.lint-file-length-ignore"

LIMIT_DEFAULT=350
LIMIT_UI=150
LIMIT_TEST=500

# Load ignore patterns
ignore_patterns=()
if [[ -f "$IGNORE_FILE" ]]; then
  while IFS= read -r line; do
    line="${line%%#*}"     # strip comments
    line="${line// /}"     # strip whitespace
    [[ -z "$line" ]] && continue
    ignore_patterns+=("$line")
  done < "$IGNORE_FILE"
fi

is_ignored() {
  local filepath="$1"
  for pattern in "${ignore_patterns[@]+"${ignore_patterns[@]}"}"; do
    if [[ "$filepath" == *"$pattern"* ]]; then
      return 0
    fi
  done
  return 1
}

violations=0

while IFS= read -r filepath; do
  # Make path relative to repo root
  relpath="${filepath#"$REPO_ROOT"/}"

  # Skip excluded directories.
  # .venv/site-packages are third-party sources: gitignored, and `uv venv`
  # inside a backend would otherwise drown the report in vendor files.
  case "$relpath" in
    */node_modules/*|*/generated/*|*/dist/*|*/alembic/versions/*|*/__pycache__/*) continue ;;
    .venv/*|*/.venv/*|*/site-packages/*) continue ;;
  esac

  # Skip E2E files (no limit)
  case "$relpath" in
    */e2e/*) continue ;;
  esac

  # Skip ignored files
  if is_ignored "$relpath"; then
    continue
  fi

  lines=$(wc -l < "$filepath")

  # Determine category and limit
  limit=$LIMIT_DEFAULT
  category="source"

  # Test files get higher limit
  case "$relpath" in
    *_test.py|*.spec.ts|*_prop_test.py)
      limit=$LIMIT_TEST
      category="test"
      ;;
  esac

  # UI primitives get stricter limit (but not test/story files)
  if [[ "$category" == "source" ]]; then
    case "$relpath" in
      packages/ui/src/*)
        case "$relpath" in
          *.stories.ts) ;;  # stories are exempt from UI limit
          *)
            limit=$LIMIT_UI
            category="ui-primitive"
            ;;
        esac
        ;;
    esac
  fi

  if (( lines > limit )); then
    echo "FAIL  $relpath: $lines lines (limit: $limit for $category)"
    violations=$((violations + 1))
  fi
done < <(find "$REPO_ROOT/apps" "$REPO_ROOT/packages" -type f \( -name '*.py' -o -name '*.ts' \) 2>/dev/null)

if (( violations > 0 )); then
  echo ""
  echo "$violations file(s) exceed their line limit."
  exit 1
else
  echo "All files within line limits."
  exit 0
fi
