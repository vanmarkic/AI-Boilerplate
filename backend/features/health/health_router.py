from fastapi import APIRouter

from core.config import settings

router = APIRouter(prefix="/api/health", tags=["health"])


@router.get("")
async def health_check() -> dict[str, str]:
    """Health check endpoint."""
    return {
        "status": "ok",
        "version": settings.app_version,
    }
