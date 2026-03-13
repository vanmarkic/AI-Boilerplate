"""Internal helpers for tier-build verification.

Provides YAML reading, feature discovery, and text-scanning utilities
used by the verification checks.
"""

import re
from pathlib import Path

try:
    import yaml

    HAS_YAML = True
except ImportError:
    HAS_YAML = False

TEXT_SUFFIXES: set[str] = {".py", ".ts", ".js", ".html", ".css", ".yaml", ".json"}


def _read_tier(feature_dir: Path) -> int:
    """Read the tier value from a feature's manifest.yaml, defaulting to 1."""
    manifest = feature_dir / "manifest.yaml"
    if not manifest.exists() or not HAS_YAML:
        return 1
    try:
        with open(manifest) as f:
            data = yaml.safe_load(f)
    except (OSError, yaml.YAMLError):
        return 1
    if not isinstance(data, dict):
        return 1
    return data.get("tier", 1)


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
    """Return feature names whose tier exceeds max_tier."""
    return {name for name, tier in all_features.items() if tier > max_tier}


def _included_names(all_features: dict[str, int], max_tier: int) -> set[str]:
    """Return feature names whose tier is at or below max_tier."""
    return {name for name, tier in all_features.items() if tier <= max_tier}


def _scan_files_for_refs(
    root_path: Path, excluded: set[str], label: str, recursive: bool = True
) -> list[str]:
    """Scan text files under root_path for word-boundary references to excluded names."""
    violations: list[str] = []
    if not root_path.exists():
        return violations

    patterns: dict[str, re.Pattern[str]] = {
        name: re.compile(rf"\b{re.escape(name)}\b") for name in excluded
    }
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
