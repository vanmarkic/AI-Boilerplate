"""Override global autouse fixtures for pure engine unit tests."""

import pytest


@pytest.fixture(autouse=True)
async def setup_db() -> None:
    """No-op: engine tests don't need a database."""
    return  # type: ignore[misc]
