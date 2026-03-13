from fastapi import APIRouter

from core.config import settings
from features.health.health_schema import HealthResponse

router = APIRouter(prefix="/api/health", tags=["health"])


@router.get("")
async def health_check() -> HealthResponse:
    """Health check endpoint."""
    return HealthResponse(
        status="ok",
        version=settings.app_version,
    )
