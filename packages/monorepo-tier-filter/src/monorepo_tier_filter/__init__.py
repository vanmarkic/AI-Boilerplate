"""Tier-based feature filtering and build verification for monorepos."""

from monorepo_tier_filter.filter_features import filter_features, get_feature_tier
from monorepo_tier_filter._verify_checks import (
    verify_backend_entrypoint,
    verify_backend_generated_init,
    verify_core_no_feature_imports,
    verify_filtered_output,
    verify_frontend_generated_routes,
    verify_frontend_routes,
    verify_included_tiers,
)

__all__ = [
    "filter_features",
    "get_feature_tier",
    "verify_backend_entrypoint",
    "verify_backend_generated_init",
    "verify_core_no_feature_imports",
    "verify_filtered_output",
    "verify_frontend_generated_routes",
    "verify_frontend_routes",
    "verify_included_tiers",
]
