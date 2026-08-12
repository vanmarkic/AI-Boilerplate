"""The guard the architecture linter cannot provide.

``python-layer-lint`` only inspects first-party imports, so ``import httpx``
inside ``domain/`` is invisible to it. This test closes that hole by AST-scanning
every module in the core for banned imports, and by checking that no vendor
name appears anywhere in the core's source text.

If this test fails, the core has stopped being independent of its edges.
"""

import ast
from pathlib import Path

import pytest

CORE_PACKAGES = ("domain", "application")

# Frameworks, drivers and transports the core must never reach for.
BANNED_ROOTS = frozenset(
    {
        "sqlalchemy",
        "fastapi",
        "starlette",
        "httpx",
        "requests",
        "aiohttp",
        "pydantic",
        "pydantic_settings",
        "alembic",
        "opensearchpy",
        "opensearch",
        "pymisp",
        "asyncpg",
        "psycopg",
        "psycopg2",
        "redis",
        "core",
        "adapters",
        "features",
    }
)

# The core may not even *name* a vendor. Ports are phrased in domain language,
# so any hit here means vendor vocabulary has leaked inward.
BANNED_VENDOR_WORDS = ("misp", "iris", "shuffle", "opensearch", "elastic", "thehive")

BACKEND_ROOT = Path(__file__).resolve().parent.parent


def _core_modules() -> list[Path]:
    """Return every non-test Python module in the core packages."""
    modules: list[Path] = []
    for package in CORE_PACKAGES:
        package_dir = BACKEND_ROOT / package
        if not package_dir.exists():
            continue
        modules.extend(
            path for path in sorted(package_dir.rglob("*.py")) if not path.name.endswith("_test.py")
        )
    return modules


def _imported_roots(tree: ast.Module) -> set[str]:
    """Return the top-level package of every import in a module."""
    roots: set[str] = set()
    for node in ast.walk(tree):
        if isinstance(node, ast.Import):
            roots.update(alias.name.split(".")[0] for alias in node.names)
        elif isinstance(node, ast.ImportFrom) and node.module and node.level == 0:
            roots.add(node.module.split(".")[0])
    return roots


class TestDomainPurity:
    """The core imports nothing that ties it to a framework or a vendor."""

    def test_core_packages_are_not_empty(self) -> None:
        assert _core_modules(), "no core modules found — the guard would pass vacuously"

    @pytest.mark.parametrize("module", _core_modules(), ids=lambda p: p.name)
    def test_module_imports_no_infrastructure(self, module: Path) -> None:
        tree = ast.parse(module.read_text())
        offending = _imported_roots(tree) & BANNED_ROOTS
        assert not offending, (
            f"{module.relative_to(BACKEND_ROOT)} imports {sorted(offending)}; "
            "the core must depend on nothing but the standard library and itself"
        )

    @pytest.mark.parametrize("module", _core_modules(), ids=lambda p: p.name)
    def test_module_never_names_a_vendor(self, module: Path) -> None:
        source = module.read_text().lower()
        offending = [word for word in BANNED_VENDOR_WORDS if word in source]
        assert not offending, (
            f"{module.relative_to(BACKEND_ROOT)} mentions {offending}; "
            "ports and policies must be phrased in domain language only"
        )

    def test_relative_imports_are_absent(self) -> None:
        """Relative imports carry no package root, so the layer linter cannot see them."""
        offenders: list[str] = []
        for module in _core_modules():
            tree = ast.parse(module.read_text())
            for node in ast.walk(tree):
                if isinstance(node, ast.ImportFrom) and node.level > 0:
                    offenders.append(f"{module.name}:{node.lineno}")
        assert not offenders, f"relative imports bypass the architecture linter: {offenders}"
