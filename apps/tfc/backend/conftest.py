import os
from collections.abc import AsyncGenerator

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import StaticPool

import core.database as db_module
from core.database import Base, get_session
from features.audit.audit_model import AuditEntry  # noqa: F401 — register before create_all
from main import app

# Use PostgreSQL in CI, SQLite locally
TEST_DB_URL = os.getenv(
    "DATABASE_URL",
    "sqlite+aiosqlite:///:memory:",
)

_is_sqlite = "sqlite" in TEST_DB_URL


@pytest.fixture(autouse=True)
async def setup_db() -> AsyncGenerator[None]:
    engine = create_async_engine(
        TEST_DB_URL,
        **(
            {"connect_args": {"check_same_thread": False}, "poolclass": StaticPool}
            if _is_sqlite
            else {}
        ),
    )
    session_factory = async_sessionmaker(engine, expire_on_commit=False)

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async def override_session() -> AsyncGenerator[AsyncSession]:
        async with session_factory() as session:
            async with session.begin():
                yield session

    app.dependency_overrides[get_session] = override_session
    # Also override the module-level factory so out-of-request code uses the test DB
    original_factory = db_module.async_session_factory
    db_module.async_session_factory = session_factory
    yield
    app.dependency_overrides.clear()
    db_module.async_session_factory = original_factory

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
    await engine.dispose()


@pytest.fixture
async def client() -> AsyncGenerator[AsyncClient]:
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac
