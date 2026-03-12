#!/usr/bin/env bash
# Thin wrapper — delegates to the extracted @aspect/security-scan package.
# See packages/security-scan/ for the source.
set -euo pipefail

REPO_ROOT="$(git rev-parse --show-toplevel)"
exec "${REPO_ROOT}/packages/security-scan/bin/security-scan.sh" "$@"
