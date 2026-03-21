#!/usr/bin/env bash
# visual-edit-reminder.sh — PostToolUse hook for Edit tool.
# Prints a reminder when TFC frontend view/CSS files are edited.
# Does NOT run tests — that would be too slow for every edit.

# Hook receives tool input as JSON on stdin
INPUT=$(cat)
FILE_PATH=$(echo "$INPUT" | python3 -c "import sys,json; print(json.load(sys.stdin).get('file_path',''))" 2>/dev/null || echo "")

# Only remind for TFC frontend visual files
case "$FILE_PATH" in
  */tfc/frontend/src/*.html|*/tfc/frontend/src/*.css|*/tfc/frontend/src/*component.ts)
    echo "VISUAL_REMINDER: Frontend view file changed. Run 'npm run e2e:visual' from apps/tfc/frontend/ when ready to verify."
    ;;
esac
