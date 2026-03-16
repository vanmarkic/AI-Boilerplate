import os
from collections.abc import AsyncGenerator, Generator
from unittest.mock import AsyncMock, patch

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from core.database import Base, get_session
from main import app

# Use PostgreSQL in CI, SQLite locally
TEST_DB_URL = os.getenv(
    "DATABASE_URL",
    "sqlite+aiosqlite:///:memory:",
)

_BYPASS_ROLE = "__test_bypass__"


@pytest.fixture(autouse=True)
async def setup_db() -> AsyncGenerator[None]:
    engine = create_async_engine(TEST_DB_URL)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
    await engine.dispose()


@pytest.fixture(autouse=True)
def _bypass_rbac() -> Generator[None, None, None]:
    """Pre-seed RBAC cache and mock JWT parsing so feature tests
    that don't care about authorization are not blocked by the middleware.
    """
    import core.rbac as rbac_module
    from core.rbac import PermissionRule

    rbac_module._cache = {
        _BYPASS_ROLE: [PermissionRule(route_pattern="/api/**", method="*")],
    }
    rbac_module._cache_loaded_at = 1e18  # far future — never expires

    with patch(
        "core.auth.parse_jwt_roles",
        new_callable=AsyncMock,
        return_value=[_BYPASS_ROLE],
    ):
        yield

    rbac_module._cache = {}
    rbac_module._cache_loaded_at = 0.0


@pytest.fixture
async def client() -> AsyncGenerator[AsyncClient]:
    engine = create_async_engine(TEST_DB_URL)
    session_factory = async_sessionmaker(engine, expire_on_commit=False)

    async def override_session() -> AsyncGenerator[AsyncSession]:
        async with session_factory() as session:
            async with session.begin():
                yield session

    app.dependency_overrides[get_session] = override_session
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac
    app.dependency_overrides.clear()
    await engine.dispose()
