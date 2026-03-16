"""Tests for SessionStore in-memory session management."""
from engine.exercise_engine import EngineConfig
from engine.session_store import SessionStore


def _config(exercise_id: int = 1) -> EngineConfig:
    return EngineConfig(exercise_id=exercise_id, title=f"Ex-{exercise_id}")


class TestCreateAndGet:
    def test_create_returns_engine(self) -> None:
        store = SessionStore()
        engine = store.create(_config(1))
        assert engine is not None
        assert engine.phase.value == "setup"

    def test_get_returns_created_engine(self) -> None:
        store = SessionStore()
        created = store.create(_config(1))
        fetched = store.get(1)
        assert fetched is created

    def test_get_missing_returns_none(self) -> None:
        store = SessionStore()
        assert store.get(999) is None


class TestRemove:
    def test_remove_existing_returns_true(self) -> None:
        store = SessionStore()
        store.create(_config(1))
        assert store.remove(1) is True
        assert store.get(1) is None

    def test_remove_missing_returns_false(self) -> None:
        store = SessionStore()
        assert store.remove(999) is False


class TestListActive:
    def test_list_active_returns_ids(self) -> None:
        store = SessionStore()
        store.create(_config(1))
        store.create(_config(2))
        active = store.list_active()
        assert sorted(active) == [1, 2]

    def test_list_active_empty(self) -> None:
        store = SessionStore()
        assert store.list_active() == []


class TestCount:
    def test_count_reflects_sessions(self) -> None:
        store = SessionStore()
        assert store.count == 0
        store.create(_config(1))
        assert store.count == 1
        store.create(_config(2))
        assert store.count == 2
        store.remove(1)
        assert store.count == 1


class TestOverwrite:
    def test_overwrite_existing_session(self) -> None:
        store = SessionStore()
        first = store.create(_config(1))
        second = store.create(_config(1))
        assert first is not second
        assert store.get(1) is second
        assert store.count == 1
