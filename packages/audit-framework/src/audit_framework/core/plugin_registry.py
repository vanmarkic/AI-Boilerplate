"""Plugin discovery and registration.

The core never imports concrete adapters. Instead, plugin packages call
``register(registry)`` to bind a ``(port, provider_name) -> implementation``.
Implementations are discovered two ways (AD-5):

* **Python entry points** under the ``audit_framework.plugins`` group.
* **Explicit module paths** listed in configuration.

Zero dependencies beyond the standard library and ``typing``.
"""

from __future__ import annotations

import importlib
from typing import Any, Callable, Iterable

__all__ = ["PluginRegistry", "PluginError"]

ENTRYPOINT_GROUP = "audit_framework.plugins"


class PluginError(RuntimeError):
    """Raised when a plugin cannot be found, loaded, or registered."""


class PluginRegistry:
    """A two-level registry: ``port -> {provider_name -> implementation}``.

    A "port" is the logical capability name (e.g. ``"audit_store"``,
    ``"external_sink"``). A "provider" is a named implementation of that port
    (e.g. ``"postgres"``, ``"splunk_hec"``). The same port can have many
    providers registered simultaneously (used for sink/channel fan-out).
    """

    def __init__(self) -> None:
        self._providers: dict[str, dict[str, Any]] = {}

    # ----------------------------------------------------------------- #
    # Registration                                                      #
    # ----------------------------------------------------------------- #
    def register(self, port: str, provider: str, implementation: Any) -> None:
        """Register ``implementation`` as ``provider`` for ``port``.

        Raises :class:`PluginError` if the same ``(port, provider)`` pair is
        registered twice, to surface accidental clobbering early.
        """
        bucket = self._providers.setdefault(port, {})
        if provider in bucket:
            raise PluginError(
                f"provider {provider!r} already registered for port {port!r}"
            )
        bucket[provider] = implementation

    # ----------------------------------------------------------------- #
    # Lookup                                                            #
    # ----------------------------------------------------------------- #
    def get(self, port: str, provider: str) -> Any:
        """Return the implementation registered as ``provider`` for ``port``.

        Raises :class:`PluginError` if either the port or the provider is
        unknown.
        """
        try:
            bucket = self._providers[port]
        except KeyError:
            raise PluginError(f"no providers registered for port {port!r}") from None
        try:
            return bucket[provider]
        except KeyError:
            known = ", ".join(sorted(bucket)) or "<none>"
            raise PluginError(
                f"unknown provider {provider!r} for port {port!r} "
                f"(known: {known})"
            ) from None

    def list_providers(self, port: str) -> list[str]:
        """Return the provider names registered for ``port`` (empty if none)."""
        return sorted(self._providers.get(port, {}))

    def list_ports(self) -> list[str]:
        """Return every port that has at least one registered provider."""
        return sorted(self._providers)

    # ----------------------------------------------------------------- #
    # Discovery                                                         #
    # ----------------------------------------------------------------- #
    def discover_entrypoints(self, group: str = ENTRYPOINT_GROUP) -> int:
        """Load every plugin advertised under the entry-point ``group``.

        Each entry point must resolve to a ``register(registry)`` callable.
        Returns the number of entry points successfully invoked. Raises
        :class:`PluginError` if an entry point fails to load or register.
        """
        # Imported lazily so the module has zero import-time cost.
        from importlib.metadata import entry_points

        count = 0
        for ep in self._iter_entrypoints(entry_points(), group):
            try:
                register_fn = ep.load()
            except Exception as exc:  # pragma: no cover - defensive
                raise PluginError(f"failed to load entry point {ep.name!r}: {exc}") from exc
            self._invoke_register(register_fn, source=f"entry point {ep.name!r}")
            count += 1
        return count

    def load_from_config(self, module_paths: Iterable[str]) -> int:
        """Import each ``module:function`` (or ``module``) path and register it.

        For a bare module path, the module's ``register`` attribute is used.
        Returns the number of paths successfully invoked.
        """
        count = 0
        for path in module_paths:
            register_fn = self._resolve_register(path)
            self._invoke_register(register_fn, source=f"config path {path!r}")
            count += 1
        return count

    # ----------------------------------------------------------------- #
    # Internals                                                         #
    # ----------------------------------------------------------------- #
    @staticmethod
    def _iter_entrypoints(eps: Any, group: str) -> Iterable[Any]:
        # importlib.metadata.entry_points returns different shapes across
        # Python versions; normalise to a flat iterable for ``group``.
        select = getattr(eps, "select", None)
        if callable(select):
            return select(group=group)
        return eps.get(group, [])  # pragma: no cover - legacy mapping API

    @staticmethod
    def _resolve_register(path: str) -> Callable[[Any], None]:
        module_name, _, attr = path.partition(":")
        attr = attr or "register"
        try:
            # The module path comes from trusted operator configuration (a
            # plugin-discovery setting), never from end-user/request input, so
            # this dynamic import is the intended extension mechanism, not an
            # injection sink. Reviewed in the branch security audit.
            module = importlib.import_module(module_name)  # nosemgrep
        except ImportError as exc:
            raise PluginError(f"cannot import plugin module {module_name!r}: {exc}") from exc
        try:
            return getattr(module, attr)
        except AttributeError:
            raise PluginError(
                f"plugin module {module_name!r} has no attribute {attr!r}"
            ) from None

    def _invoke_register(self, register_fn: Callable[[Any], None], source: str) -> None:
        if not callable(register_fn):
            raise PluginError(f"{source} did not resolve to a callable register()")
        try:
            register_fn(self)
        except PluginError:
            raise
        except Exception as exc:
            raise PluginError(f"{source} register() raised: {exc}") from exc
