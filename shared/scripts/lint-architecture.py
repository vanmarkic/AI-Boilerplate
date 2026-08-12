#!/usr/bin/env python3
"""Architecture boundary linter.

Thin wrapper around the python-layer-lint package.
See packages/python-layer-lint/ for the extracted library.

Two layouts are linted:
  * feature-sliced apps (main, tfc) — layer rules + tiers + manifest sync
  * hexagonal apps (soc)            — hexagonal layer rules + package-root rules

For soc, ``core/`` is deliberately excluded: it is the composition root and is
the one place allowed to see every layer at once.
"""
import sys
from pathlib import Path

from python_layer_lint.linter import lint_features_dir, lint_package_dir
from python_layer_lint.soc_rules import (
    SOC_LAYER_RULES,
    SOC_LOCAL_ROOTS,
    SOC_ROOT_RULES,
)

ROOT = Path(__file__).resolve().parent.parent.parent

FEATURES_DIRS = [
    ROOT / "apps" / "main" / "backend" / "features",
    ROOT / "apps" / "tfc" / "backend" / "features",
]

SOC_BACKEND = ROOT / "apps" / "soc" / "backend"
SOC_PACKAGES = ["domain", "application", "adapters"]


def lint_soc() -> list[str]:
    """Lint the hexagonal SOC backend."""
    violations: list[str] = []
    for package in SOC_PACKAGES:
        violations.extend(
            lint_package_dir(
                SOC_BACKEND / package,
                SOC_LAYER_RULES,
                SOC_LOCAL_ROOTS,
                SOC_ROOT_RULES,
            )
        )

    # Inbound HTTP is feature-sliced, so tier boundaries and manifest/endpoint
    # sync apply there exactly as they do for the other apps.
    violations.extend(
        lint_features_dir(
            SOC_BACKEND / "features",
            SOC_LAYER_RULES,
            SOC_LOCAL_ROOTS,
            SOC_ROOT_RULES,
        )
    )
    return violations


def main() -> int:
    all_violations: list[str] = []

    for features_dir in FEATURES_DIRS:
        if not features_dir.exists():
            continue
        all_violations.extend(lint_features_dir(features_dir))

    all_violations.extend(lint_soc())

    if all_violations:
        print("Architecture boundary violations found:\n")
        for v in all_violations:
            print(f"  ✗ {v}")
        print(f"\n{len(all_violations)} violation(s) found.")
        return 1

    print("✓ No architecture boundary violations found.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
