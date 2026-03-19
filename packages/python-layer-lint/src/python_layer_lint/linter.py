"""Core linting logic.

Enforces the dependency flow:
  router  → service, schema, core
  service → repository, model, schema, core
  repository → model, core
  model   → core only

Also enforces tier boundaries:
  A feature with tier=N must not import from a feature with tier>N.

And validates manifest endpoint sync:
  api_endpoints in manifest.yaml must match actual router decorators.
"""
import ast
from pathlib import Path

from python_layer_lint.manifest_sync import check_manifest_endpoints

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


def get_layer(filename: str) -> str | None:
    """Extract layer name from filename like 'user_router.py' → 'router'."""
    parts = filename.replace(".py", "").split("_")
    if len(parts) >= 2:
        return parts[-1]
    return None


def get_feature_tier(feature_dir: Path) -> int:
    """Read tier from manifest.yaml. Default to 1 if no manifest."""
    manifest = feature_dir / "manifest.yaml"
    if not manifest.exists() or not HAS_YAML:
        return 1
    with open(manifest) as f:
        data = yaml.safe_load(f)
    return data.get("tier", 1)


def check_imports(filepath: Path, layer_rules: dict[str, set[str]] | None = None) -> list[str]:
    """Check a file's imports against layer rules."""
    rules = layer_rules or LAYER_RULES
    violations: list[str] = []
    layer = get_layer(filepath.name)
    if layer is None or layer not in rules:
        return violations

    allowed = rules[layer]
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
                    imported_suffix = parts[-1].rsplit("_", 1)[-1]
                    if imported_suffix in rules and imported_suffix not in allowed:
                        violations.append(
                            f"{filepath}:{node.lineno} - "
                            f"'{layer}' layer imports '{imported_suffix}' "
                            f"(allowed: {sorted(allowed)})"
                        )
    return violations


def check_tier_boundaries(filepath: Path, features_dir: Path) -> list[str]:
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
                        target_dir = features_dir / target_feature
                        if target_dir.exists():
                            target_tier = get_feature_tier(target_dir)
                            if target_tier > source_tier:
                                violations.append(
                                    f"{filepath}:{node.lineno} - "
                                    f"tier-{source_tier} feature '{source_feature}' "
                                    f"imports tier-{target_tier} feature '{target_feature}'"
                                )
    return violations


def lint_features_dir(features_dir: Path, layer_rules: dict[str, set[str]] | None = None) -> list[str]:
    """Lint all Python files in a features directory."""
    if not features_dir.exists():
        return []

    all_violations: list[str] = []
    for py_file in features_dir.rglob("*.py"):
        all_violations.extend(check_imports(py_file, layer_rules))
        all_violations.extend(check_tier_boundaries(py_file, features_dir))

    # Validate manifest api_endpoints match actual router decorators
    for feature_dir in sorted(features_dir.iterdir()):
        if feature_dir.is_dir() and not feature_dir.name.startswith("_"):
            all_violations.extend(check_manifest_endpoints(feature_dir))

    return all_violations
