#!/usr/bin/env python3
"""Verify a tier-filtered build contains only the expected features.

Runs AFTER filter-features.py to confirm:
  1. Every included feature has tier <= target tier.
  2. No source file in the filtered output references an excluded feature.
  3. Entrypoints (main.py, app.routes.ts) do not hardcode excluded features.
  4. Generated wiring files only register included features.
  5. Shared/core code does not import excluded feature modules.

Usage:
  verify-tier-build.py --tier=1 --backend-dest=build/backend/features --frontend-dest=build/frontend/features
  verify-tier-build.py --tier=1 --backend-dest=build/backend/features  # backend only
"""
import argparse
import ast
import re
import sys
from pathlib import Path

try:
    import yaml

    HAS_YAML = True
except ImportError:
    HAS_YAML = False

ROOT = Path(__file__).resolve().parent.parent.parent

# Source directories holding ALL features (pre-filter).
BACKEND_ALL = ROOT / "backend" / "features"
FRONTEND_ALL = ROOT / "frontend" / "src" / "app" / "features"

# Entrypoints that wire features — must not reference excluded features.
BACKEND_MAIN = ROOT / "backend" / "main.py"
FRONTEND_ROUTES = ROOT / "frontend" / "src" / "app" / "app.routes.ts"

# Directories that must never import feature-specific modules.
BACKEND_CORE = ROOT / "backend" / "core"
FRONTEND_SHARED = ROOT / "frontend" / "src" / "app" / "shared"

TEXT_SUFFIXES = {".py", ".ts", ".js", ".html", ".css", ".yaml", ".json"}


# ── Helpers ──────────────────────────────────────────────────


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


def _included_names(all_features: dict[str, int], max_tier: int) -> set[str]:
    return {name for name, tier in all_features.items() if tier <= max_tier}


def _scan_files_for_refs(
    root_path: Path, excluded: set[str], label: str, recursive: bool = True
) -> list[str]:
    """Scan text files under root_path for word-boundary references to excluded names."""
    violations: list[str] = []
    if not root_path.exists():
        return violations

    patterns = {name: re.compile(rf"\b{re.escape(name)}\b") for name in excluded}
    iterator = root_path.rglob("*") if recursive else root_path.iterdir()

    for src_file in iterator:
        if not src_file.is_file() or src_file.suffix not in TEXT_SUFFIXES:
            continue
        try:
            text = src_file.read_text()
        except (UnicodeDecodeError, PermissionError):
            continue
        for name, pattern in patterns.items():
            if pattern.search(text):
                rel = src_file.relative_to(root_path) if recursive else src_file.name
                violations.append(
                    f"[{label}] {rel} references excluded feature '{name}'"
                )
    return violations


# ── Verification steps ───────────────────────────────────────


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


def verify_filtered_output(dest: Path, excluded: set[str], kind: str) -> list[str]:
    """Scan every file in the filtered output for references to excluded features."""
    return _scan_files_for_refs(dest, excluded, f"{kind}/filtered-output")


def verify_backend_entrypoint(excluded: set[str]) -> list[str]:
    """Parse main.py AST and flag imports from excluded features."""
    violations: list[str] = []
    if not BACKEND_MAIN.exists():
        return violations

    try:
        tree = ast.parse(BACKEND_MAIN.read_text())
    except SyntaxError:
        return [f"[backend/main.py] SyntaxError — cannot parse"]

    for node in ast.walk(tree):
        if isinstance(node, (ast.Import, ast.ImportFrom)):
            module = ""
            if isinstance(node, ast.ImportFrom) and node.module:
                module = node.module
            elif isinstance(node, ast.Import):
                module = ".".join(alias.name for alias in node.names)

            if module.startswith("features."):
                feature_name = module.split(".")[1]
                if feature_name in excluded:
                    violations.append(
                        f"[backend/main.py:{node.lineno}] imports excluded "
                        f"feature '{feature_name}'"
                    )
    return violations


def verify_frontend_routes(excluded: set[str]) -> list[str]:
    """Scan app.routes.ts for lazy-loaded routes that reference excluded features."""
    violations: list[str] = []
    if not FRONTEND_ROUTES.exists():
        return violations

    text = FRONTEND_ROUTES.read_text()
    # Match import('./features/<name>/...')
    for match in re.finditer(r"import\(['\"]\.\/features\/([^/'\"]+)", text):
        feature_name = match.group(1)
        if feature_name in excluded:
            # Find line number
            line_no = text[: match.start()].count("\n") + 1
            violations.append(
                f"[frontend/app.routes.ts:{line_no}] routes excluded "
                f"feature '{feature_name}'"
            )
    return violations


def verify_core_no_feature_imports(excluded: set[str]) -> list[str]:
    """Ensure backend/core/ and frontend/shared/ don't import excluded features."""
    violations: list[str] = []

    # Backend core — check Python AST
    if BACKEND_CORE.exists():
        for py_file in BACKEND_CORE.rglob("*.py"):
            try:
                tree = ast.parse(py_file.read_text())
            except SyntaxError:
                continue
            for node in ast.walk(tree):
                if isinstance(node, (ast.Import, ast.ImportFrom)):
                    module = ""
                    if isinstance(node, ast.ImportFrom) and node.module:
                        module = node.module
                    elif isinstance(node, ast.Import):
                        module = ".".join(alias.name for alias in node.names)
                    if module.startswith("features."):
                        feature_name = module.split(".")[1]
                        if feature_name in excluded:
                            violations.append(
                                f"[backend/core/{py_file.name}:{node.lineno}] "
                                f"imports excluded feature '{feature_name}'"
                            )

    # Frontend shared — check for import paths to excluded features
    if FRONTEND_SHARED.exists():
        for ts_file in FRONTEND_SHARED.rglob("*.ts"):
            text = ts_file.read_text()
            for match in re.finditer(r"from\s+['\"].*features/([^/'\"]+)", text):
                feature_name = match.group(1)
                if feature_name in excluded:
                    line_no = text[: match.start()].count("\n") + 1
                    rel = ts_file.relative_to(FRONTEND_SHARED)
                    violations.append(
                        f"[frontend/shared/{rel}:{line_no}] imports excluded "
                        f"feature '{feature_name}'"
                    )
    return violations


def verify_backend_generated_init(dest: Path, included: set[str]) -> list[str]:
    """Verify generated __init__.py only wires included backend features."""
    violations: list[str] = []
    init_file = dest / "__init__.py"
    if not init_file.exists():
        return violations
    text = init_file.read_text()
    for match in re.finditer(r"from features\.(\w+)\.", text):
        feature_name = match.group(1)
        if feature_name not in included:
            violations.append(
                f"[backend/__init__.py] registers non-included "
                f"feature '{feature_name}'"
            )
    return violations


def verify_frontend_generated_routes(dest: Path, included: set[str]) -> list[str]:
    """Verify generated app.routes.generated.ts only wires included frontend features."""
    violations: list[str] = []
    gen_routes = dest.parent / "app.routes.generated.ts"
    if not gen_routes.exists():
        return violations
    text = gen_routes.read_text()
    for match in re.finditer(r"features/([^/'\"]+)/", text):
        feature_name = match.group(1)
        if feature_name not in included:
            violations.append(
                f"[frontend/app.routes.generated.ts] registers non-included "
                f"feature '{feature_name}'"
            )
    return violations


# ── Main ─────────────────────────────────────────────────────


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
    checks_run = 0

    if args.backend_dest:
        all_backend = _feature_names(BACKEND_ALL)
        excluded_be = _excluded_names(all_backend, args.tier)
        included_be = _included_names(all_backend, args.tier)

        # 1. No higher-tier dirs in filtered output
        all_violations.extend(
            verify_included_tiers(args.backend_dest, args.tier, "backend")
        )
        # 2. No references to excluded features in filtered output
        all_violations.extend(
            verify_filtered_output(args.backend_dest, excluded_be, "backend")
        )
        # 3. main.py doesn't import excluded features
        all_violations.extend(verify_backend_entrypoint(excluded_be))
        # 4. core/ doesn't import excluded features
        all_violations.extend(verify_core_no_feature_imports(excluded_be))
        # 5. Generated __init__.py only references included features
        all_violations.extend(
            verify_backend_generated_init(args.backend_dest, included_be)
        )
        checks_run += 5
        print(
            f"Backend: {len(included_be)} included, {len(excluded_be)} excluded, "
            f"5 checks"
        )

    if args.frontend_dest:
        all_frontend = _feature_names(FRONTEND_ALL)
        excluded_fe = _excluded_names(all_frontend, args.tier)
        included_fe = _included_names(all_frontend, args.tier)

        # 1. No higher-tier dirs in filtered output
        all_violations.extend(
            verify_included_tiers(args.frontend_dest, args.tier, "frontend")
        )
        # 2. No references to excluded features in filtered output
        all_violations.extend(
            verify_filtered_output(args.frontend_dest, excluded_fe, "frontend")
        )
        # 3. app.routes.ts doesn't route excluded features
        all_violations.extend(verify_frontend_routes(excluded_fe))
        # 4. shared/ doesn't import excluded features
        all_violations.extend(verify_core_no_feature_imports(excluded_fe))
        # 5. Generated routes file only references included features
        all_violations.extend(
            verify_frontend_generated_routes(args.frontend_dest, included_fe)
        )
        checks_run += 5
        print(
            f"Frontend: {len(included_fe)} included, {len(excluded_fe)} excluded, "
            f"5 checks"
        )

    print(f"\nRan {checks_run} verification checks.")

    if all_violations:
        print(f"\nTier-{args.tier} build verification FAILED:\n")
        for v in all_violations:
            print(f"  ✗ {v}")
        print(f"\n{len(all_violations)} violation(s) found.")
        return 1

    print(f"✓ Tier-{args.tier} build verified: no excluded feature leaks.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
