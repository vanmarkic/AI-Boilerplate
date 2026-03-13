"""Verify a tier-filtered build contains only the expected features.

Runs AFTER tier-filter to confirm:
  1. Every included feature has tier <= target tier.
  2. No source file in the filtered output references an excluded feature.
  3. Entrypoints (main.py, app.routes.ts) do not hardcode excluded features.
  4. Generated wiring files only register included features.
  5. Shared/core code does not import excluded feature modules.

Usage:
  tier-verify --tier=1 --backend-dest=build/backend/features --frontend-dest=build/frontend/features
  tier-verify --tier=1 --backend-dest=build/backend/features  # backend only
"""

import argparse
import sys
from pathlib import Path

from monorepo_tier_filter._verify_checks import (
    verify_backend_entrypoint,
    verify_backend_generated_init,
    verify_core_no_feature_imports,
    verify_filtered_output,
    verify_frontend_generated_routes,
    verify_frontend_routes,
    verify_included_tiers,
)
from monorepo_tier_filter._verify_helpers import (
    _excluded_names,
    _feature_names,
    _included_names,
)


def main() -> int:
    """CLI entry point for tier-build verification."""
    parser = argparse.ArgumentParser(description="Verify tier-filtered build output")
    parser.add_argument("--tier", type=int, required=True)
    parser.add_argument("--backend-src", type=Path, default=None)
    parser.add_argument("--backend-dest", type=Path, default=None)
    parser.add_argument("--frontend-src", type=Path, default=None)
    parser.add_argument("--frontend-dest", type=Path, default=None)
    parser.add_argument("--backend-main", type=Path, default=None)
    parser.add_argument("--frontend-routes", type=Path, default=None)
    parser.add_argument("--backend-core", type=Path, default=None)
    parser.add_argument("--frontend-shared", type=Path, default=None)
    args = parser.parse_args()

    if not args.backend_dest and not args.frontend_dest:
        print("At least one of --backend-dest or --frontend-dest is required.")
        return 1

    all_violations: list[str] = []
    checks_run = 0

    if args.backend_dest:
        checks_run, all_violations = _run_backend_checks(args, checks_run, all_violations)

    if args.frontend_dest:
        checks_run, all_violations = _run_frontend_checks(args, checks_run, all_violations)

    print(f"\nRan {checks_run} verification checks.")

    if all_violations:
        print(f"\nTier-{args.tier} build verification FAILED:\n")
        for v in all_violations:
            print(f"  \u2717 {v}")
        print(f"\n{len(all_violations)} violation(s) found.")
        return 1

    print(f"\u2713 Tier-{args.tier} build verified: no excluded feature leaks.")
    return 0


def _run_backend_checks(
    args: argparse.Namespace, checks_run: int, all_violations: list[str]
) -> tuple[int, list[str]]:
    """Execute all backend verification checks."""
    backend_src = args.backend_src or Path("backend/features")
    all_backend = _feature_names(backend_src)
    excluded_be = _excluded_names(all_backend, args.tier)
    included_be = _included_names(all_backend, args.tier)

    all_violations.extend(
        verify_included_tiers(args.backend_dest, args.tier, "backend")
    )
    all_violations.extend(
        verify_filtered_output(args.backend_dest, excluded_be, "backend")
    )
    if args.backend_main:
        all_violations.extend(verify_backend_entrypoint(args.backend_main, excluded_be))
    if args.backend_core:
        all_violations.extend(
            verify_core_no_feature_imports(
                args.backend_core,
                args.frontend_shared or Path("nonexistent"),
                excluded_be,
            )
        )
    all_violations.extend(
        verify_backend_generated_init(args.backend_dest, included_be)
    )
    checks_run += 5
    print(
        f"Backend: {len(included_be)} included, {len(excluded_be)} excluded, "
        f"5 checks"
    )
    return checks_run, all_violations


def _run_frontend_checks(
    args: argparse.Namespace, checks_run: int, all_violations: list[str]
) -> tuple[int, list[str]]:
    """Execute all frontend verification checks."""
    frontend_src = args.frontend_src or Path("frontend/src/app/features")
    all_frontend = _feature_names(frontend_src)
    excluded_fe = _excluded_names(all_frontend, args.tier)
    included_fe = _included_names(all_frontend, args.tier)

    all_violations.extend(
        verify_included_tiers(args.frontend_dest, args.tier, "frontend")
    )
    all_violations.extend(
        verify_filtered_output(args.frontend_dest, excluded_fe, "frontend")
    )
    if args.frontend_routes:
        all_violations.extend(verify_frontend_routes(args.frontend_routes, excluded_fe))
    if args.frontend_shared:
        all_violations.extend(
            verify_core_no_feature_imports(
                args.backend_core or Path("nonexistent"),
                args.frontend_shared,
                excluded_fe,
            )
        )
    all_violations.extend(
        verify_frontend_generated_routes(args.frontend_dest, included_fe)
    )
    checks_run += 5
    print(
        f"Frontend: {len(included_fe)} included, {len(excluded_fe)} excluded, "
        f"5 checks"
    )
    return checks_run, all_violations


if __name__ == "__main__":
    sys.exit(main())
