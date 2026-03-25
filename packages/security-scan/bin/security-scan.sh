#!/usr/bin/env bash
# Run available security scanners locally and write reports to security-reports/
set -euo pipefail

REPO_ROOT="$(git rev-parse --show-toplevel)"
REPORT_DIR="${REPO_ROOT}/security-reports"
TIMESTAMP="$(date -u +%Y-%m-%dT%H%M%SZ)"

mkdir -p "$REPORT_DIR"

passed=0
failed=0
skipped=0

run_scanner() {
  local name="$1"
  shift
  if command -v "${1}" &>/dev/null; then
    echo "==> Running ${name}..."
    if "$@"; then
      echo "    ${name}: done"
      ((passed++))
    else
      echo "    ${name}: completed with findings"
      ((passed++))
    fi
  else
    echo "==> Skipping ${name} (not installed)"
    ((skipped++))
  fi
}

# --- npm audit (frontend) ---
if [ -f "${REPO_ROOT}/frontend/package-lock.json" ]; then
  echo "==> Running npm audit (frontend)..."
  (cd "${REPO_ROOT}/frontend" && npm audit --json 2>/dev/null) \
    > "${REPORT_DIR}/npm-audit-frontend-${TIMESTAMP}.json" || true
  ((passed++))
  echo "    npm audit (frontend): done"
else
  echo "==> Skipping npm audit (frontend) — no package-lock.json"
  ((skipped++))
fi

# --- npm audit (root) ---
if [ -f "${REPO_ROOT}/package-lock.json" ]; then
  echo "==> Running npm audit (root)..."
  (cd "${REPO_ROOT}" && npm audit --json 2>/dev/null) \
    > "${REPORT_DIR}/npm-audit-root-${TIMESTAMP}.json" || true
  ((passed++))
  echo "    npm audit (root): done"
fi

# --- pip-audit (backend) ---
if command -v pip-audit &>/dev/null && [ -d "${REPO_ROOT}/backend" ]; then
  echo "==> Running pip-audit..."
  pip-audit --format json --output "${REPORT_DIR}/pip-audit-${TIMESTAMP}.json" 2>/dev/null || true
  ((passed++))
  echo "    pip-audit: done"
else
  echo "==> Skipping pip-audit (not installed or no backend/)"
  ((skipped++))
fi

# --- Bandit (Python SAST) ---
if command -v bandit &>/dev/null && [ -d "${REPO_ROOT}/backend" ]; then
  echo "==> Running bandit..."
  bandit -r "${REPO_ROOT}/backend/" -f json -o "${REPORT_DIR}/bandit-${TIMESTAMP}.json" 2>/dev/null || true
  ((passed++))
  echo "    bandit: done"
else
  echo "==> Skipping bandit (not installed or no backend/)"
  ((skipped++))
fi

# --- Semgrep (SAST) ---
if command -v semgrep &>/dev/null; then
  echo "==> Running semgrep..."
  semgrep scan --config auto --json --output "${REPORT_DIR}/semgrep-${TIMESTAMP}.json" \
    "${REPO_ROOT}" 2>/dev/null || true
  ((passed++))
  echo "    semgrep: done"
else
  echo "==> Skipping semgrep (not installed)"
  ((skipped++))
fi

# --- Gitleaks (secrets) ---
if command -v gitleaks &>/dev/null; then
  echo "==> Running gitleaks..."
  gitleaks detect --source "${REPO_ROOT}" --report-format json \
    --report-path "${REPORT_DIR}/gitleaks-${TIMESTAMP}.json" 2>/dev/null || true
  ((passed++))
  echo "    gitleaks: done"
else
  echo "==> Skipping gitleaks (not installed)"
  ((skipped++))
fi

# --- Summary ---
echo ""
echo "Security scan complete: ${passed} ran, ${skipped} skipped"
echo "Reports written to: ${REPORT_DIR}/"
ls -1 "${REPORT_DIR}/"*"${TIMESTAMP}"* 2>/dev/null || echo "(no reports generated)"
