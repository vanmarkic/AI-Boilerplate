"""Override global autouse fixtures for exercise WS unit tests."""
import pytest


@pytest.fixture(autouse=True)
async def setup_db() -> None:
    """No-op: WS tests don't need a database."""
    yield  # type: ignore[misc]


@pytest.fixture(autouse=True)
def _bypass_auth() -> None:
    """No-op: WS tests don't need auth mocking."""
    yield  # type: ignore[misc]
