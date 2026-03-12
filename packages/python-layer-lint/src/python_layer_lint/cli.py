"""CLI entry point for python-layer-lint."""
import sys
from pathlib import Path

from python_layer_lint.linter import lint_features_dir


def main() -> int:
    features_dir = Path(sys.argv[1]) if len(sys.argv) > 1 else Path("backend/features")

    if not features_dir.exists():
        print(f"Features directory not found: {features_dir}")
        return 0  # Not an error if backend isn't set up yet

    violations = lint_features_dir(features_dir)

    if violations:
        print("Architecture boundary violations found:\n")
        for v in violations:
            print(f"  ✗ {v}")
        print(f"\n{len(violations)} violation(s) found.")
        return 1

    print("✓ No architecture boundary violations found.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
