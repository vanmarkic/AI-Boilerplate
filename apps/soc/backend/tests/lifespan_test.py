"""Adapters that hold a connection pool are released on the way out.

Every vendor client has an ``aclose``. None of them was reachable: the lifespan
resolved the adapters, yielded, and ended — so the ``lru_cache``'d ports held
their ``httpx.AsyncClient`` instances until the process died and shutdown
dropped the pools rather than draining them.

Five ``aclose`` methods that nothing calls are not a small oversight; they are
five methods that read as wired and are not. This suite makes them reachable and
keeps them that way.
"""

from unittest.mock import patch

import pytest

from core import registry
from main import _lifespan, create_app

PORTS = ("threat_intel_port", "search_port", "case_management_port", "orchestration_port")


class Closeable:
    """A stand-in for an adapter that owns a connection pool."""

    def __init__(self) -> None:
        self.closed = 0

    async def aclose(self) -> None:
        self.closed += 1


class NotCloseable:
    """A stand-in for an in-memory adapter, which owns nothing to release."""


async def _run_lifespan() -> None:
    """Drive the lifespan through startup and shutdown."""
    async with _lifespan(create_app()):
        pass


class TestShutdownReleasesAdapters:
    """The half of the lifespan that was missing."""

    async def test_every_closeable_port_is_closed(self) -> None:
        stubs = {name: Closeable() for name in PORTS}
        with patch.multiple(registry, **{name: (lambda s=stub: s) for name, stub in stubs.items()}):
            await _run_lifespan()
        assert all(stub.closed == 1 for stub in stubs.values()), {
            name: stub.closed for name, stub in stubs.items()
        }

    async def test_an_adapter_without_aclose_is_left_alone(self) -> None:
        """Memory mode is the default, and nothing there needs releasing."""
        with patch.multiple(registry, **{name: (lambda: NotCloseable()) for name in PORTS}):
            await _run_lifespan()  # must not raise

    async def test_one_failing_close_does_not_strand_the_others(self) -> None:
        """Shutdown is best-effort: a stuck pool must not keep the rest open."""

        class Angry(Closeable):
            async def aclose(self) -> None:
                raise RuntimeError("connection already gone")

        stubs: dict[str, object] = {PORTS[0]: Angry()}
        stubs.update({name: Closeable() for name in PORTS[1:]})
        with patch.multiple(registry, **{name: (lambda s=stub: s) for name, stub in stubs.items()}):
            await _run_lifespan()
        assert all(stubs[name].closed == 1 for name in PORTS[1:])  # type: ignore[attr-defined]

    async def test_startup_still_fails_loudly_on_misconfiguration(self) -> None:
        """Adding shutdown must not swallow the boot-time check."""
        with patch.object(registry.settings, "search_provider", "elasticsearch"):
            with pytest.raises(ValueError, match="elasticsearch"):
                await _run_lifespan()
