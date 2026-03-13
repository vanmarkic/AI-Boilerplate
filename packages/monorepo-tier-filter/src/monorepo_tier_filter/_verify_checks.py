"""Verification checks for tier-filtered builds.

Each function inspects one aspect of a filtered build output and returns
a list of human-readable violation strings (empty means pass).
"""

import ast
import re
from pathlib import Path

from monorepo_tier_filter._verify_helpers import _read_tier, _scan_files_for_refs


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


def verify_backend_entrypoint(
    main_path: Path, excluded: set[str]
) -> list[str]:
    """Parse main.py AST and flag imports from excluded features."""
    violations: list[str] = []
    if not main_path.exists():
        return violations

    try:
        tree = ast.parse(main_path.read_text())
    except SyntaxError:
        return [f"[{main_path.name}] SyntaxError — cannot parse"]

    for node in ast.walk(tree):
        modules: list[str] = []
        if isinstance(node, ast.ImportFrom) and node.module:
            modules.append(node.module)
        elif isinstance(node, ast.Import):
            modules.extend(alias.name for alias in node.names)

        for module in modules:
            if module.startswith("features."):
                feature_name = module.split(".")[1]
                if feature_name in excluded:
                    violations.append(
                        f"[{main_path.name}:{node.lineno}] imports excluded "
                        f"feature '{feature_name}'"
                    )
    return violations


def verify_frontend_routes(
    routes_path: Path, excluded: set[str]
) -> list[str]:
    """Scan app.routes.ts for lazy-loaded routes that reference excluded features."""
    violations: list[str] = []
    if not routes_path.exists():
        return violations

    text = routes_path.read_text()
    for match in re.finditer(r"import\(['\"]\.\/features\/([^/'\"]+)", text):
        feature_name = match.group(1)
        if feature_name in excluded:
            line_no = text[: match.start()].count("\n") + 1
            violations.append(
                f"[{routes_path.name}:{line_no}] routes excluded "
                f"feature '{feature_name}'"
            )
    return violations


def verify_core_no_feature_imports(
    backend_core: Path,
    frontend_shared: Path,
    excluded: set[str],
    skip_files: set[str] | None = None,
) -> list[str]:
    """Ensure core/shared directories don't import excluded features."""
    violations: list[str] = []
    _skip: set[str] = skip_files or {"dependencies.py"}

    if backend_core.exists():
        for py_file in backend_core.rglob("*.py"):
            if py_file.name in _skip:
                continue
            try:
                tree = ast.parse(py_file.read_text())
            except SyntaxError:
                continue
            for node in ast.walk(tree):
                modules: list[str] = []
                if isinstance(node, ast.ImportFrom) and node.module:
                    modules.append(node.module)
                elif isinstance(node, ast.Import):
                    modules.extend(alias.name for alias in node.names)
                for module in modules:
                    if module.startswith("features."):
                        feature_name = module.split(".")[1]
                        if feature_name in excluded:
                            violations.append(
                                f"[{backend_core.name}/{py_file.name}:{node.lineno}] "
                                f"imports excluded feature '{feature_name}'"
                            )

    if frontend_shared.exists():
        for ts_file in frontend_shared.rglob("*.ts"):
            text = ts_file.read_text()
            for match in re.finditer(r"from\s+['\"].*features/([^/'\"]+)", text):
                feature_name = match.group(1)
                if feature_name in excluded:
                    line_no = text[: match.start()].count("\n") + 1
                    rel = ts_file.relative_to(frontend_shared)
                    violations.append(
                        f"[{frontend_shared.name}/{rel}:{line_no}] imports excluded "
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
