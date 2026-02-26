#!/usr/bin/env python3
"""Architecture boundary linter.

Enforces the dependency flow:
  router  → service, schema, core
  service → repository, model, schema, core
  repository → model, core
  model   → core only

Also enforces tier boundaries:
  A feature with tier=N must not import from a feature with tier>N.
"""
import ast
import sys
from pathlib import Path

try:
    import yaml
    HAS_YAML = True
except ImportError:
    HAS_YAML = False

LAYER_RULES: dict[str, set[str]] = {
    "router": {"service", "schema", "core"},
    "service": {"repository", "model", "schema", "core"},
    "repository": {"model", "core"},
    "model": {"core"},
    "schema": set(),  # schemas should not import feature-local modules
    "test": {"router", "service", "repository", "model", "schema", "core"},
}

FEATURES_DIR = Path(__file__).resolve().parent.parent.parent / "backend" / "features"


def get_layer(filename: str) -> str | None:
    """Extract layer name from filename like 'user_router.py' → 'router'."""
    parts = filename.replace(".py", "").split("_")
    if len(parts) >= 2:
        return parts[-1]
    return None


def check_imports(filepath: Path) -> list[str]:
    """Check a file's imports against layer rules."""
    violations: list[str] = []
    layer = get_layer(filepath.name)
    if layer is None or layer not in LAYER_RULES:
        return violations

    allowed = LAYER_RULES[layer]
    try:
        tree = ast.parse(filepath.read_text())
    except SyntaxError:
        return [f"{filepath}: SyntaxError, cannot parse"]

    for node in ast.walk(tree):
        if isinstance(node, (ast.Import, ast.ImportFrom)):
            module = ""
            if isinstance(node, ast.ImportFrom) and node.module:
                module = node.module
            elif isinstance(node, ast.Import):
                module = ".".join(alias.name for alias in node.names)

            # Only check feature-local imports
            if module.startswith("features."):
                parts = module.split(".")
                if len(parts) >= 3:
                    imported_layer = parts[-1].split(".")[-1]
                    # Extract layer from module like features.user.user_service
                    for segment in parts[2:]:
                        sub = segment.split("_")
                        for s in sub:
                            if s in LAYER_RULES and s not in allowed:
                                violations.append(
                                    f"{filepath}:{node.lineno} - "
                                    f"'{layer}' layer imports '{s}' "
                                    f"(allowed: {sorted(allowed)})"
                                )
    return violations


def get_feature_tier(feature_dir: Path) -> int:
    """Read tier from manifest.yaml. Default to 1 if no manifest."""
    manifest = feature_dir / "manifest.yaml"
    if not manifest.exists() or not HAS_YAML:
        return 1
    with open(manifest) as f:
        data = yaml.safe_load(f)
    return data.get("tier", 1)


def check_tier_boundaries(filepath: Path) -> list[str]:
    """Check that a feature doesn't import from a higher-tier feature."""
    violations: list[str] = []
    if not HAS_YAML:
        return violations

    feature_dir = filepath.parent
    source_tier = get_feature_tier(feature_dir)
    source_feature = feature_dir.name

    try:
        tree = ast.parse(filepath.read_text())
    except SyntaxError:
        return violations

    for node in ast.walk(tree):
        if isinstance(node, (ast.Import, ast.ImportFrom)):
            module = ""
            if isinstance(node, ast.ImportFrom) and node.module:
                module = node.module
            elif isinstance(node, ast.Import):
                module = ".".join(alias.name for alias in node.names)

            if module.startswith("features."):
                parts = module.split(".")
                if len(parts) >= 2:
                    target_feature = parts[1]
                    if target_feature != source_feature:
                        target_dir = FEATURES_DIR / target_feature
                        if target_dir.exists():
                            target_tier = get_feature_tier(target_dir)
                            if target_tier > source_tier:
                                violations.append(
                                    f"{filepath}:{node.lineno} - "
                                    f"tier-{source_tier} feature '{source_feature}' "
                                    f"imports tier-{target_tier} feature '{target_feature}'"
                                )
    return violations


def main() -> int:
    if not FEATURES_DIR.exists():
        print(f"Features directory not found: {FEATURES_DIR}")
        return 0  # Not an error if backend isn't set up yet

    all_violations: list[str] = []
    for py_file in FEATURES_DIR.rglob("*.py"):
        all_violations.extend(check_imports(py_file))
        all_violations.extend(check_tier_boundaries(py_file))

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
