"""Tests for the plugin registry: registration, lookup, and discovery errors."""

from __future__ import annotations

import pytest

from audit_framework.core.plugin_registry import PluginError, PluginRegistry


class _ImplA:
    pass


class _ImplB:
    pass


def test_register_and_get() -> None:
    reg = PluginRegistry()
    reg.register("audit_store", "postgres", _ImplA)
    assert reg.get("audit_store", "postgres") is _ImplA


def test_multiple_providers_per_port() -> None:
    reg = PluginRegistry()
    reg.register("external_sink", "splunk", _ImplA)
    reg.register("external_sink", "elk", _ImplB)
    assert reg.list_providers("external_sink") == ["elk", "splunk"]
    assert reg.list_ports() == ["external_sink"]


def test_duplicate_registration_raises() -> None:
    reg = PluginRegistry()
    reg.register("audit_store", "postgres", _ImplA)
    with pytest.raises(PluginError):
        reg.register("audit_store", "postgres", _ImplB)


def test_get_unknown_port_raises() -> None:
    reg = PluginRegistry()
    with pytest.raises(PluginError):
        reg.get("audit_store", "postgres")


def test_get_unknown_provider_lists_known() -> None:
    reg = PluginRegistry()
    reg.register("audit_store", "postgres", _ImplA)
    with pytest.raises(PluginError) as exc:
        reg.get("audit_store", "mysql")
    assert "postgres" in str(exc.value)


def test_list_providers_empty_for_unknown_port() -> None:
    reg = PluginRegistry()
    assert reg.list_providers("nope") == []


def test_load_from_config_invokes_register(monkeypatch: pytest.MonkeyPatch) -> None:
    # A module-like object exposing register(registry).
    import types

    module = types.ModuleType("fake_plugin_mod")

    def register(registry: PluginRegistry) -> None:
        registry.register("redactor", "hash", _ImplA)

    module.register = register  # type: ignore[attr-defined]

    import sys

    sys.modules["fake_plugin_mod"] = module
    try:
        reg = PluginRegistry()
        count = reg.load_from_config(["fake_plugin_mod"])
        assert count == 1
        assert reg.get("redactor", "hash") is _ImplA
    finally:
        del sys.modules["fake_plugin_mod"]


def test_load_from_config_missing_module_raises() -> None:
    reg = PluginRegistry()
    with pytest.raises(PluginError):
        reg.load_from_config(["definitely_not_a_real_module_xyz"])


if __name__ == "__main__":
    raise SystemExit(pytest.main([__file__, "-v"]))
