"""RedactMiddleware — strip sensitive fields before storage/fan-out/delivery.

Place this **after** :class:`AuditPolicyMiddleware` (see the recommended
ordering in this package's ``__init__``) so it can apply the ``redact_fields``
of the selected policy. Redaction combines two sources:

* a fixed ``base_fields`` set configured once at wiring time (always redacted,
  regardless of chain position), and
* the ``redact_fields`` of ``context.audit_policy`` — only available once
  ``AuditPolicyMiddleware`` has selected a policy. If this middleware runs
  before policy selection, ``context.audit_policy`` is ``None`` and only
  ``base_fields`` are scrubbed.

Because :class:`AuditEvent` is immutable, redaction produces a new event via
``dataclasses.replace`` and swaps it onto ``context.event`` so every downstream
middleware (store, sinks, channels) sees only the sanitised version.
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
