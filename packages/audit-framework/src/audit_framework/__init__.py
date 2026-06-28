"""audit-framework — technology-agnostic audit, notification & case-management core.

A pipe-and-filter audit pipeline plus a ports-and-adapters plugin system, with
**zero runtime dependencies**. Every external capability (storage, identity,
delivery, SIEM sinks, case backends) is a Protocol in
:mod:`audit_framework.core.ports`; concrete adapters ship as separate plugin
packages discovered via :class:`~audit_framework.core.plugin_registry.PluginRegistry`.

See ``README.md`` for the architecture overview and a runnable example.
"""

from audit_framework.core import (
    AuditEvent,
    AuditMiddleware,
    AuditPolicy,
    AuditPolicyEngine,
    BroadcastPolicy,
    BroadcastPolicyEngine,
    BroadcastTarget,
    Dispatcher,
    Notification,
    NotificationDirective,
    Pipeline,
    PipelineContext,
    PluginError,
    PluginRegistry,
    PolicyMatcher,
    auditable,
)

import importlib.metadata as _md

try:
    __version__ = _md.version("audit-framework")
except _md.PackageNotFoundError:  # running from source without an install
    __version__ = "0.0.0+unknown"

__all__ = [
    "__version__",
    "AuditEvent",
    "AuditPolicy",
    "BroadcastPolicy",
    "BroadcastTarget",
    "Notification",
    "NotificationDirective",
    "PipelineContext",
    "Pipeline",
    "AuditMiddleware",
    "PolicyMatcher",
    "AuditPolicyEngine",
    "BroadcastPolicyEngine",
    "Dispatcher",
    "PluginRegistry",
    "PluginError",
    "auditable",
]
