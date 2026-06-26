"""Built-in pipeline middlewares.

Each middleware implements :class:`~audit_framework.core.pipeline.AuditMiddleware`
and depends only on ports (Protocols), never on concrete adapters. The canonical
ordering (spec §3) is::

    Redact → AuditPolicy → Store → SinkFanOut → BroadcastPolicy → Dispatch → Escalation
"""

from audit_framework.core.middlewares.audit_policy import AuditPolicyMiddleware
from audit_framework.core.middlewares.broadcast import BroadcastPolicyMiddleware
from audit_framework.core.middlewares.dispatch import DispatchMiddleware
from audit_framework.core.middlewares.escalation import EscalationMiddleware
from audit_framework.core.middlewares.redact import RedactMiddleware
from audit_framework.core.middlewares.sink_fanout import SinkFanOutMiddleware
from audit_framework.core.middlewares.store import StoreMiddleware

__all__ = [
    "RedactMiddleware",
    "AuditPolicyMiddleware",
    "StoreMiddleware",
    "SinkFanOutMiddleware",
    "BroadcastPolicyMiddleware",
    "DispatchMiddleware",
    "EscalationMiddleware",
]
