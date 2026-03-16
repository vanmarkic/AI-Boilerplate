"""Unit tests for SessionStore in-memory engine registry."""
import pytest

from engine.session_store import SessionStore
from engine.exercise_engine import EngineConfig, EnginePhase


def _config(exercise_id: int = 1) -> EngineConfig:
    return EngineConfig(
        exercise_id=exercise_id,
        title=f"Exercise {exercise_id}",
    )


class TestCreate:
    def test_stores_engine(self) -> None:
        store = SessionStore()
        engine = store.create(_config(1))
        assert engine is not None
        assert engine.phase == EnginePhase.SETUP

    def test_overwrites_existing(self) -> None:
        store = SessionStore()
        e1 = store.create(_config(1))
        e2 = store.create(_config(1))
        assert e1 is not e2
        assert store.count == 1


class TestGet:
    def test_retrieves_stored_engine(self) -> None:
        store = SessionStore()
        engine = store.create(_config(1))
        assert store.get(1) is engine

    def test_returns_none_for_unknown(self) -> None:
        store = SessionStore()
        assert store.get(999) is None


class TestRemove:
    def test_deletes_stored_engine(self) -> None:
        store = SessionStore()
        store.create(_config(1))
        assert store.remove(1) is True
        assert store.get(1) is None

    def test_returns_false_for_unknown(self) -> None:
        store = SessionStore()
        assert store.remove(999) is False


class TestListActive:
    def test_returns_all_ids(self) -> None:
        store = SessionStore()
        store.create(_config(1))
        store.create(_config(2))
        store.create(_config(3))
        active = store.list_active()
        assert sorted(active) == [1, 2, 3]

    def test_empty_store(self) -> None:
        store = SessionStore()
        assert store.list_active() == []


class TestCount:
    def test_correct_count(self) -> None:
        store = SessionStore()
        assert store.count == 0
        store.create(_config(1))
        assert store.count == 1
        store.create(_config(2))
        assert store.count == 2
        store.remove(1)
        assert store.count == 1
