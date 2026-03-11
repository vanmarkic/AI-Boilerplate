import importlib
from pathlib import Path

from fastapi import FastAPI

from core.config import settings
from core.middleware import setup_middleware


def discover_routers(app: FastAPI) -> None:
    """Auto-discover and register routers from features/*/.

    Looks for {name}_router.py in each feature directory and registers
    the `router` object. Works with tier filtering since excluded features
    are not present in the features/ directory at build time.
    """
    features_dir = Path(__file__).parent / "features"
    for feature_dir in sorted(features_dir.iterdir()):
        if not feature_dir.is_dir() or feature_dir.name.startswith("_"):
            continue
        router_file = feature_dir / f"{feature_dir.name}_router.py"
        if router_file.exists():
            module = importlib.import_module(
                f"features.{feature_dir.name}.{feature_dir.name}_router"
            )
            app.include_router(module.router)


def create_app() -> FastAPI:
    """Application factory."""
    application = FastAPI(
        title=settings.app_name,
        version=settings.app_version,
    )
    setup_middleware(application)
    discover_routers(application)
    return application


app = create_app()
