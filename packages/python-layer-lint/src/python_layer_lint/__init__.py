"""AST-based architecture linter enforcing layer dependency rules and tier boundaries."""

from python_layer_lint.linter import (
    LAYER_RULES,
    check_imports,
    check_tier_boundaries,
    lint_features_dir,
    lint_package_dir,
)
from python_layer_lint.soc_rules import (
    SOC_LAYER_RULES,
    SOC_LOCAL_ROOTS,
    SOC_ROOT_RULES,
)

__all__ = [
    "LAYER_RULES",
    "SOC_LAYER_RULES",
    "SOC_LOCAL_ROOTS",
    "SOC_ROOT_RULES",
    "check_imports",
    "check_tier_boundaries",
    "lint_features_dir",
    "lint_package_dir",
]
