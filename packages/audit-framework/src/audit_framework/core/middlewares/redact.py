"""RedactMiddleware — strip sensitive fields before anything else sees them.

Runs first in the chain so no downstream middleware (store, sinks, channels)
ever observes raw secrets. Redaction is applied in two waves:

* a fixed ``base_fields`` set configured once at wiring time (always redacted), and
* any ``redact_fields`` declared by the audit policy *once it has been selected*
  — applied on a second pass if this middleware is also placed after policy
  evaluation, or honoured by re-running redaction when ``context.audit_policy``
  is already present.

Because :class:`AuditEvent` is immutable, redaction produces a new event via
``dataclasses.replace`` and swaps it onto ``context.event`` so the rest of the
chain sees only the sanitised version.
"""

from __future__ import annotations

import dataclasses

from audit_framework.core.models import AuditEvent, PipelineContext
from audit_framework.core.pipeline import NextCallable
from audit_framework.core.ports import Redactor

__all__ = ["RedactMiddleware"]


class RedactMiddleware:
    """Sanitises ``changes`` and ``metadata`` using the :class:`Redactor` port."""

    def __init__(self, redactor: Redactor, base_fields: list[str] | None = None) -> None:
        self._redactor = redactor
        self._base_fields = list(base_fields or [])

    async def process(
        self, event: AuditEvent, context: PipelineContext, next: NextCallable
    ) -> None:
        fields = list(self._base_fields)
        if context.audit_policy and context.audit_policy.redact_fields:
            fields.extend(context.audit_policy.redact_fields)

        if fields:
            context.event = dataclasses.replace(
                event,
                changes=self._redactor.redact(event.changes, fields),
                metadata=self._redactor.redact(event.metadata, fields),
            )
        await next()
