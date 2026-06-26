"""Plugin registration for the JSONL file sink.

The core never imports this module directly; it is reached either via the
``audit_framework.plugins`` entry point declared in ``pyproject.toml`` (picked
up by :meth:`PluginRegistry.discover_entrypoints`) or by an explicit module
path passed to :meth:`PluginRegistry.load_from_config`.
"""

from __future__ import annotations

from typing import Any

from audit_framework_jsonl.sink import JsonlFileSink

__all__ = ["register"]


def register(registry: Any) -> None:
    """Register :class:`JsonlFileSink` as the ``file_jsonl`` external sink."""
    registry.register("external_sink", "file_jsonl", JsonlFileSink)
