import json
import os
from functools import lru_cache

from fastapi import Depends, HTTPException, status


class FeatureFlags:
    """Runtime feature toggles within the shipped tier.

    Build-time exclusion determines what code EXISTS.
    Runtime flags determine what's ACTIVE among what exists.
    Default: all shipped features are active.
    """

    def __init__(self) -> None:
        raw = os.getenv("FEATURE_FLAGS", "{}")
        self._flags: dict[str, bool] = json.loads(raw)

    def is_enabled(self, feature_name: str) -> bool:
        """Check if a feature is enabled. Default True (all shipped features active)."""
        return self._flags.get(feature_name, True)


@lru_cache
def get_feature_flags() -> FeatureFlags:
    return FeatureFlags()


def require_feature(feature_name: str):
    """FastAPI dependency that gates an endpoint behind a feature flag.

    Usage: @router.get("/analytics", dependencies=[Depends(require_feature("analytics"))])
    """
    async def _check(flags: FeatureFlags = Depends(get_feature_flags)) -> None:
        if not flags.is_enabled(feature_name):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Feature '{feature_name}' is not enabled",
            )
    return _check
