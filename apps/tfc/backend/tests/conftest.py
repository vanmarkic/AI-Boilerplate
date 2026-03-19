"""Conftest for migration rollback tests.

Overrides the root conftest's autouse `setup_db` fixture with a no-op.
Migration tests manage the database schema entirely through Alembic commands;
running Base.metadata.create_all / drop_all in parallel causes AccessExclusiveLock
deadlocks on PostgreSQL when both sets of DDL run against the same database.
"""

from collections.abc import AsyncGenerator

import pytest


@pytest.fixture(autouse=True)
async def setup_db() -> AsyncGenerator[None]:  # noqa: RUF029
    """No-op override: migration tests use Alembic directly."""
    yield
