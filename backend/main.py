from fastapi import FastAPI

from core.config import settings
from core.middleware import setup_middleware
from features.health.health_router import router as health_router
from features.user.user_router import router as user_router


def create_app() -> FastAPI:
    """Application factory."""
    application = FastAPI(
        title=settings.app_name,
        version=settings.app_version,
    )
    setup_middleware(application)
    application.include_router(health_router)
    application.include_router(user_router)
    return application


app = create_app()
