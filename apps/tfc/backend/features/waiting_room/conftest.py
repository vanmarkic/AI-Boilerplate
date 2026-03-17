"""Test fixtures for waiting room feature tests."""
from __future__ import annotations

import pytest

from features.waiting_room.waiting_room_store import waiting_room_store


@pytest.fixture(autouse=True)
def reset_waiting_room_store() -> None:
    """Reset the global waiting room store between tests."""
    waiting_room_store._rooms.clear()
