#!/usr/bin/env python3
"""Architecture boundary linter.

Thin wrapper around the python-layer-lint package.
See packages/python-layer-lint/ for the extracted library.
"""
import sys
from pathlib import Path

from python_layer_lint.linter import lint_features_dir

ROOT = Path(__file__).resolve().parent.parent.parent

FEATURES_DIRS = [
    ROOT / "apps" / "main" / "backend" / "features",
    ROOT / "apps" / "tfc" / "backend" / "features",
]


def main() -> int:
    all_violations: list[str] = []

    for features_dir in FEATURES_DIRS:
        if not features_dir.exists():
            continue
        all_violations.extend(lint_features_dir(features_dir))

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
