#!/usr/bin/env bash
# Integration tests for scaffold-feature.sh
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SCAFFOLD="$SCRIPT_DIR/scaffold-feature.sh"
PASS=0
FAIL=0
TMPDIR=$(mktemp -d)
trap 'rm -rf "$TMPDIR"' EXIT

# --- Helpers ---
assert_file_exists() {
  if [[ -f "$1" ]]; then
    PASS=$((PASS + 1))
  else
    echo "FAIL: expected file $1 to exist"
    FAIL=$((FAIL + 1))
  fi
}

assert_contains() {
  if grep -q "$2" "$1" 2>/dev/null; then
    PASS=$((PASS + 1))
  else
    echo "FAIL: $1 missing '$2'"
    FAIL=$((FAIL + 1))
  fi
}

seed_workspace() {
  # Create the minimal directory structure the scaffold expects
  mkdir -p "$TMPDIR/backend/core" "$TMPDIR/backend/features"
  mkdir -p "$TMPDIR/frontend/src/app/features"
  cat > "$TMPDIR/backend/core/dependencies.py" << 'EOF'
from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession

from core.database import get_session
EOF
}

# ============================================================
echo "=== Scaffold Integration Tests ==="
echo ""

# --- Test 1: Basic scaffold creates all expected files ---
echo "Test 1: File creation"
seed_workspace
cd "$TMPDIR"
bash "$SCAFFOLD" widget 1

assert_file_exists backend/features/widget/widget_model.py
assert_file_exists backend/features/widget/widget_schema.py
assert_file_exists backend/features/widget/widget_repository.py
assert_file_exists backend/features/widget/widget_service.py
assert_file_exists backend/features/widget/widget_router.py
assert_file_exists backend/features/widget/widget_test.py
assert_file_exists backend/features/widget/manifest.yaml
assert_file_exists backend/features/widget/__init__.py
assert_file_exists frontend/src/app/features/widget/widget.types.ts
assert_file_exists frontend/src/app/features/widget/widget.store.ts
assert_file_exists frontend/src/app/features/widget/widget.component.ts
assert_file_exists frontend/src/app/features/widget/widget.routes.ts
assert_file_exists frontend/src/app/features/widget/widget.component.spec.ts
assert_file_exists frontend/src/app/features/widget/manifest.yaml

# --- Test 2: Default plural (naive) ---
echo "Test 2: Default plural"
assert_contains backend/features/widget/widget_router.py "/api/widgets"

# --- Test 3: Plural override ---
echo "Test 3: Plural override"
rm -rf "$TMPDIR/backend/features/status" "$TMPDIR/frontend/src/app/features/status"
bash "$SCAFFOLD" status 1 statuses

assert_contains backend/features/status/status_router.py "/api/statuses"
assert_contains backend/features/status/manifest.yaml "POST /api/statuses"
assert_contains backend/features/status/manifest.yaml "GET /api/statuses/{status_id}"

# --- Test 4: Idempotency — running twice doesn't duplicate dependency ---
echo "Test 4: Idempotency"
count_before=$(grep -c "def get_widget_service" backend/core/dependencies.py)
bash "$SCAFFOLD" widget 1
count_after=$(grep -c "def get_widget_service" backend/core/dependencies.py)
if [[ "$count_before" -eq "$count_after" ]]; then
  PASS=$((PASS + 1))
else
  echo "FAIL: dependency factory duplicated (before=$count_before, after=$count_after)"
  FAIL=$((FAIL + 1))
fi

# --- Test 5: Manifest has populated endpoints ---
echo "Test 5: Manifest endpoints populated"
assert_contains backend/features/widget/manifest.yaml "POST /api/widgets"
assert_contains backend/features/widget/manifest.yaml "GET /api/widgets/{widget_id}"

# --- Test 6: Store has precise import hint ---
echo "Test 6: Store import hint"
assert_contains frontend/src/app/features/widget/widget.store.ts "from '../../shared/api/generated'"

# --- Test 7: Test file has vi import ---
echo "Test 7: vi import"
assert_contains frontend/src/app/features/widget/widget.component.spec.ts "import { vi } from 'vitest'"

# --- Test 8: Name transformations with kebab-case input ---
echo "Test 8: Name transforms (kebab-case)"
rm -rf "$TMPDIR/backend/features/order_item" "$TMPDIR/frontend/src/app/features/order-item"
bash "$SCAFFOLD" order-item 2

assert_file_exists backend/features/order_item/order_item_model.py
assert_file_exists frontend/src/app/features/order-item/order-item.component.ts
assert_contains backend/features/order_item/order_item_model.py "class OrderItem"
assert_contains backend/features/order_item/order_item_router.py "/api/order_items"
assert_contains frontend/src/app/features/order-item/order-item.store.ts "OrderItemStore"

# --- Test 9: Backend model uses correct PascalCase ---
echo "Test 9: PascalCase class names"
assert_contains backend/features/widget/widget_model.py "class Widget"
assert_contains backend/features/widget/widget_schema.py "class CreateWidgetRequest"
assert_contains backend/features/widget/widget_schema.py "class WidgetResponse"

# --- Test 10: Dependency factory wired correctly ---
echo "Test 10: Dependency factory"
assert_contains backend/core/dependencies.py "def get_widget_service"
assert_contains backend/core/dependencies.py "from features.widget.widget_repository import WidgetRepository"

# ============================================================
echo ""
echo "Results: $PASS passed, $FAIL failed"
[[ $FAIL -eq 0 ]] && exit 0 || exit 1
