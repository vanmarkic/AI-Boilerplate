"""The storage handle behaves the same way for every provider.

The load-bearing assertion here is that memory mode never opens a database
connection. If it ever does, the service stops being able to boot with nothing
deployed and this suite stops being able to run service-free — which is the
architecture's central claim, so it is worth a test rather than care.
"""

from unittest.mock import patch

import pytest

from adapters.memory.memory_store import MemoryStore
from core import registry, storage
from core.storage import get_storage, memory_store


async def _resolve() -> object:
    """Drive the get_storage dependency to its yielded value."""
    generator = get_storage()
    handle = await anext(generator)
    await generator.aclose()
    return handle


class TestMemoryStorage:
    """Memory mode is self-contained."""

    async def test_yields_the_shared_store(self) -> None:
        assert await _resolve() is memory_store()

    async def test_never_opens_a_database_connection(self) -> None:
        """A connection here would break "boots with nothing deployed"."""

        def explode(*args: object, **kwargs: object) -> None:
            raise AssertionError("memory mode must not open a database session")

        with patch.object(storage, "async_session_factory", explode):
            assert isinstance(await _resolve(), MemoryStore)

    async def test_the_store_outlives_a_single_handle(self) -> None:
        """Storage is long-lived; only the repository around it is per-request."""
        assert await _resolve() is await _resolve()


class TestRepositoryConstruction:
    """Repositories are built per request, around whatever storage is handed in."""

    @pytest.mark.parametrize(
        "build",
        [
            registry.indicator_repository,
            registry.allowlist_repository,
            registry.alert_repository,
            registry.case_repository,
            registry.playbook_run_repository,
        ],
        ids=lambda f: f.__name__,
    )
    def test_each_call_returns_a_fresh_repository(self, build: object) -> None:
        """No repository is a singleton — that is what makes SQL sessions safe."""
        store = MemoryStore()
        assert build(store) is not build(store)  # type: ignore[operator]

    @pytest.mark.parametrize(
        "build",
        [
            registry.indicator_repository,
            registry.allowlist_repository,
            registry.alert_repository,
            registry.case_repository,
            registry.playbook_run_repository,
        ],
        ids=lambda f: f.__name__,
    )
    def test_repositories_share_the_storage_they_are_given(self, build: object) -> None:
        store = MemoryStore()
        first = build(store)  # type: ignore[operator]
        second = build(store)  # type: ignore[operator]
        assert first._store is second._store

    async def test_two_stores_do_not_see_each_other(self) -> None:
        """Handing a test its own store gives it the isolation a fresh DB would."""
        from adapters.contract.repository_contract import make_alert

        one = registry.alert_repository(MemoryStore())
        other = registry.alert_repository(MemoryStore())
        saved = await one.save(make_alert())
        assert await other.get(saved.alert_id) is None

    def test_an_unknown_provider_fails_loudly(self) -> None:
        with patch.object(registry.settings, "repository_provider", "cassandra"):
            with pytest.raises(ValueError, match="cassandra"):
                registry.alert_repository(MemoryStore())


class TestStoreIsolation:
    """MemoryStore.clear gives a test the reset a fresh database gives."""

    async def test_clear_empties_every_collection(self) -> None:
        from adapters.contract.repository_contract import make_alert

        store = MemoryStore()
        await registry.alert_repository(store).save(make_alert())
        assert store.alerts

        store.clear()
        assert not store.alerts
