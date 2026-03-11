#!/usr/bin/env python3
"""Verify a tier-filtered build contains only the expected features.

Runs AFTER filter-features.py to confirm:
  1. Every included feature has tier <= target tier.
  2. No source file references an excluded (higher-tier) feature.
  3. Generated wiring files only register included features.

Usage:
  verify-tier-build.py --tier=1 --backend-dest=build/backend/features --frontend-dest=build/frontend/features
  verify-tier-build.py --tier=1 --backend-dest=build/backend/features  # backend only
"""
import argparse
import re
import sys
from pathlib import Path

try:
    import yaml

    HAS_YAML = True
except ImportError:
    HAS_YAML = False

# Directories that hold ALL features (pre-filter) — used to discover excluded names.
BACKEND_ALL = Path(__file__).resolve().parent.parent.parent / "backend" / "features"
FRONTEND_ALL = Path(__file__).resolve().parent.parent.parent / "frontend" / "src" / "app" / "features"


def _read_tier(feature_dir: Path) -> int:
    manifest = feature_dir / "manifest.yaml"
    if not manifest.exists() or not HAS_YAML:
        return 1
    with open(manifest) as f:
        return yaml.safe_load(f).get("tier", 1)


def _feature_names(src_dir: Path) -> dict[str, int]:
    """Return {feature_name: tier} for every feature in a source directory."""
    result: dict[str, int] = {}
    if not src_dir.exists():
        return result
    for d in sorted(src_dir.iterdir()):
        if d.is_dir() and not d.name.startswith("_"):
            result[d.name] = _read_tier(d)
    return result


def _excluded_names(all_features: dict[str, int], max_tier: int) -> set[str]:
    return {name for name, tier in all_features.items() if tier > max_tier}


def verify_no_excluded_refs(dest: Path, excluded: set[str], kind: str) -> list[str]:
    """Scan every source file in dest for references to excluded feature names."""
    violations: list[str] = []
    if not dest.exists():
        return violations

    patterns = {name: re.compile(rf"\b{re.escape(name)}\b") for name in excluded}

    for src_file in dest.rglob("*"):
        if not src_file.is_file():
            continue
        # Only scan text files
        if src_file.suffix not in (".py", ".ts", ".js", ".html", ".css", ".yaml", ".json"):
            continue
        try:
            text = src_file.read_text()
        except (UnicodeDecodeError, PermissionError):
            continue
        for name, pattern in patterns.items():
            if pattern.search(text):
                violations.append(
                    f"[{kind}] {src_file.relative_to(dest)} references excluded "
                    f"feature '{name}'"
                )
    return violations


def verify_included_tiers(dest: Path, max_tier: int, kind: str) -> list[str]:
    """Verify every feature directory in dest has tier <= max_tier."""
    violations: list[str] = []
    if not dest.exists():
        return violations
    for d in sorted(dest.iterdir()):
        if not d.is_dir() or d.name.startswith("_"):
            continue
        tier = _read_tier(d)
        if tier > max_tier:
            violations.append(
                f"[{kind}] Feature '{d.name}' (tier {tier}) should not be in "
                f"a tier-{max_tier} build"
            )
    return violations


def main() -> int:
    parser = argparse.ArgumentParser(description="Verify tier-filtered build output")
    parser.add_argument("--tier", type=int, required=True)
    parser.add_argument("--backend-dest", type=Path, default=None)
    parser.add_argument("--frontend-dest", type=Path, default=None)
    args = parser.parse_args()

    if not args.backend_dest and not args.frontend_dest:
        print("At least one of --backend-dest or --frontend-dest is required.")
        return 1

    all_violations: list[str] = []

    if args.backend_dest:
        all_backend = _feature_names(BACKEND_ALL)
        excluded_be = _excluded_names(all_backend, args.tier)
        all_violations.extend(verify_included_tiers(args.backend_dest, args.tier, "backend"))
        all_violations.extend(verify_no_excluded_refs(args.backend_dest, excluded_be, "backend"))
        print(f"Backend: {len(list(args.backend_dest.iterdir()))} features, "
              f"{len(excluded_be)} excluded names checked")

    if args.frontend_dest:
        all_frontend = _feature_names(FRONTEND_ALL)
        excluded_fe = _excluded_names(all_frontend, args.tier)
        all_violations.extend(verify_included_tiers(args.frontend_dest, args.tier, "frontend"))
        all_violations.extend(verify_no_excluded_refs(args.frontend_dest, excluded_fe, "frontend"))
        print(f"Frontend: {len(list(args.frontend_dest.iterdir()))} features, "
              f"{len(excluded_fe)} excluded names checked")

    if all_violations:
        print(f"\nTier-{args.tier} build verification FAILED:\n")
        for v in all_violations:
            print(f"  ✗ {v}")
        print(f"\n{len(all_violations)} violation(s) found.")
        return 1

    print(f"\n✓ Tier-{args.tier} build verified: no excluded feature leaks.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
