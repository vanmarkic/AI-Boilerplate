"""Built-in pipeline middlewares.

Each middleware implements :class:`~audit_framework.core.pipeline.AuditMiddleware`
and depends only on ports (Protocols), never on concrete adapters. The
recommended ordering is::

    AuditPolicy → Redact → Store → SinkFanOut → BroadcastPolicy → Dispatch → Escalation

This deviates deliberately from the *illustrative* diagram in spec §3, which
lists Redact first. ``RedactMiddleware`` applies the ``redact_fields`` declared
by the **selected** :class:`AuditPolicy`, so it must run *after*
``AuditPolicyMiddleware`` for per-policy redaction to take effect — otherwise
``context.audit_policy`` is still ``None`` and only the redactor's static
``base_fields`` are scrubbed. If you also need pre-policy scrubbing of
always-sensitive fields, place a second ``RedactMiddleware(base_fields=[...])``
at the very front of the chain.
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
