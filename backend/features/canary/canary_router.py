"""Canary tier-2 feature — used only for build-filtering verification."""

from fastapi import APIRouter

# This marker must never appear in a tier-1 build output.
CANARY_TIER2_BACKEND_MARKER = "canary-tier2-backend-present"

router = APIRouter(prefix="/canary", tags=["canary"])


@router.get("/ping")
def ping() -> dict[str, str]:
    return {"marker": CANARY_TIER2_BACKEND_MARKER}
