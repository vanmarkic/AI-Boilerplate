import importlib.util
import re
from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager
from pathlib import Path
from types import ModuleType

from fastapi import FastAPI

from core.config import settings
from core.middleware import setup_middleware

_FEATURE_NAME_RE = re.compile(r"^[a-z][a-z0-9_]*$")


def _load_router_module(name: str, filepath: Path) -> ModuleType:
    """Load a feature router module from its validated file path."""
    module_name = f"features.{name}.{name}_router"
    spec = importlib.util.spec_from_file_location(module_name, filepath)
    if spec is None or spec.loader is None:
        raise ImportError(f"Cannot load module from {filepath}")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def discover_routers(app: FastAPI) -> None:
    """Auto-discover and register routers from features/*/.

    Features here are inbound adapters only — a router, its schemas and a
    manifest. Persistence and vendor integration live under adapters/, because
    they are shared across slices rather than owned by one.
    """
    features_dir = Path(__file__).parent / "features"
    for feature_dir in sorted(features_dir.iterdir()):
        if not feature_dir.is_dir() or feature_dir.name.startswith("_"):
            continue
        name = feature_dir.name
        if not _FEATURE_NAME_RE.match(name):
            continue
        router_file = feature_dir / f"{name}_router.py"
        if router_file.exists():
            module = _load_router_module(name, router_file)
            app.include_router(module.router)


@asynccontextmanager
async def _lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    """Resolve every configured adapter at startup, so misconfiguration fails fast."""
    from core import registry

    registry.bound_providers()
    yield


def create_app() -> FastAPI:
    """Application factory."""
    application = FastAPI(
        title=settings.app_name,
        version=settings.app_version,
        lifespan=_lifespan,
    )
    setup_middleware(application)
    discover_routers(application)
    return application


app = create_app()
