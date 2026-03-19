"""Manifest endpoint sync checker.

AST-parses *_router.py files to extract actual endpoints and compares them
against the api_endpoints list in manifest.yaml.  Returns violations when
the two are out of sync.
"""
from __future__ import annotations

import ast
import re
from pathlib import Path

try:
    import yaml

    HAS_YAML = True
except ImportError:
    HAS_YAML = False

HTTP_METHODS = {"get", "post", "put", "delete", "patch", "head", "options"}
WS_METHODS = {"websocket"}
ALL_METHODS = HTTP_METHODS | WS_METHODS

# Regex fallback for files that fail AST parsing (e.g. PEP 695 syntax on <3.12)
_PREFIX_RE = re.compile(r'APIRouter\([^)]*prefix\s*=\s*["\']([^"\']+)["\']')
_DECORATOR_RE = re.compile(
    r'@router\.(\w+)\(\s*["\']([^"\']+)["\']',
)


def _extract_router_prefix(tree: ast.Module) -> str | None:
    """Find APIRouter(prefix="...") and return the prefix string."""
    for node in ast.walk(tree):
        if not isinstance(node, ast.Call):
            continue
        func = node.func
        name = ""
        if isinstance(func, ast.Name):
            name = func.id
        elif isinstance(func, ast.Attribute):
            name = func.attr
        if name != "APIRouter":
            continue
        for kw in node.keywords:
            if kw.arg == "prefix" and isinstance(kw.value, ast.Constant):
                return str(kw.value.value)
    return None


def _extract_decorator_endpoints(
    tree: ast.Module,
    prefix: str,
) -> set[str]:
    """Extract endpoint strings from @router.<method>("/path") decorators."""
    endpoints: set[str] = set()
    for node in ast.walk(tree):
        if not isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
            continue
        for dec in node.decorator_list:
            if not isinstance(dec, ast.Call):
                continue
            func = dec.func
            if not isinstance(func, ast.Attribute):
                continue
            method_name = func.attr.lower()
            if method_name not in HTTP_METHODS | WS_METHODS:
                continue
            if not dec.args:
                continue
            first_arg = dec.args[0]
            if not isinstance(first_arg, ast.Constant) or not isinstance(
                first_arg.value, str
            ):
                continue
            path = first_arg.value
            full_path = prefix + path
            if method_name in WS_METHODS:
                label = "WS"
            else:
                label = method_name.upper()
            endpoints.add(f"{label} {full_path}")
    return endpoints


def _extract_endpoints_regex(source: str) -> tuple[str, set[str]]:
    """Regex fallback: extract prefix and endpoints when AST parsing fails."""
    prefix_match = _PREFIX_RE.search(source)
    prefix = prefix_match.group(1) if prefix_match else ""
    endpoints: set[str] = set()
    for match in _DECORATOR_RE.finditer(source):
        method_name = match.group(1).lower()
        path = match.group(2)
        if method_name not in ALL_METHODS:
            continue
        label = "WS" if method_name in WS_METHODS else method_name.upper()
        endpoints.add(f"{label} {prefix}{path}")
    return prefix, endpoints


def _load_manifest_endpoints(manifest_path: Path) -> set[str] | None:
    """Load api_endpoints from manifest.yaml. Returns None if no manifest."""
    if not manifest_path.exists() or not HAS_YAML:
        return None
    with open(manifest_path) as f:
        data = yaml.safe_load(f)
    if data is None:
        return None
    raw = data.get("api_endpoints")
    if raw is None:
        return None
    return set(raw)


def _normalise(endpoint: str) -> str:
    """Normalise parameter names so {id} and {exercise_id} compare equal."""
    return re.sub(r"\{[^}]+\}", "{_}", endpoint)


def check_manifest_endpoints(feature_dir: Path) -> list[str]:
    """Compare manifest api_endpoints against actual router decorators.

    Returns a list of human-readable violation strings (empty = all good).
    """
    if not HAS_YAML:
        return []

    manifest_path = feature_dir / "manifest.yaml"
    manifest_eps = _load_manifest_endpoints(manifest_path)
    if manifest_eps is None:
        return []

    router_files = sorted(feature_dir.glob("*_router.py"))
    if not router_files:
        return []

    code_eps: set[str] = set()
    for rf in router_files:
        source = rf.read_text()
        try:
            tree = ast.parse(source)
        except SyntaxError:
            # Fallback to regex for files with newer Python syntax
            _, eps = _extract_endpoints_regex(source)
            code_eps |= eps
            continue
        prefix = _extract_router_prefix(tree) or ""
        code_eps |= _extract_decorator_endpoints(tree, prefix)

    violations: list[str] = []
    feature_name = feature_dir.name

    code_norm = {_normalise(e): e for e in code_eps}
    manifest_norm = {_normalise(e): e for e in manifest_eps}

    in_code_only = set(code_norm.keys()) - set(manifest_norm.keys())
    in_manifest_only = set(manifest_norm.keys()) - set(code_norm.keys())

    for key in sorted(in_code_only):
        violations.append(
            f"{manifest_path}: endpoint in router but missing from manifest: "
            f"{code_norm[key]}"
        )

    for key in sorted(in_manifest_only):
        violations.append(
            f"{manifest_path}: endpoint in manifest but not in any router: "
            f"{manifest_norm[key]}"
        )

    return violations
