#!/usr/bin/env python3
"""Verify a tier-filtered build contains only the expected features.

Thin wrapper around the monorepo-tier-filter package that injects
project-specific paths. See packages/monorepo-tier-filter/ for the library.
"""
import sys
from pathlib import Path

from monorepo_tier_filter.verify_tier_build import main as _pkg_main

ROOT = Path(__file__).resolve().parent.parent.parent

# Inject project-specific defaults into sys.argv so the generic CLI
# receives the paths that were previously hardcoded.
_DEFAULTS = {
    "--backend-src": str(ROOT / "backend" / "features"),
    "--backend-main": str(ROOT / "backend" / "main.py"),
    "--backend-core": str(ROOT / "backend" / "core"),
    "--frontend-src": str(ROOT / "frontend" / "src" / "app" / "features"),
    "--frontend-routes": str(ROOT / "frontend" / "src" / "app" / "app.routes.ts"),
    "--frontend-shared": str(ROOT / "frontend" / "src" / "app" / "shared"),
}


def main() -> int:
    # Only inject defaults for args not already provided by the caller.
    provided = set(sys.argv[1:])
    extra: list[str] = []
    for flag, value in _DEFAULTS.items():
        if not any(arg.startswith(flag) for arg in provided):
            extra.extend([flag, value])
    sys.argv[1:1] = extra
    return _pkg_main()


if __name__ == "__main__":
    sys.exit(main())
