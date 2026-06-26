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

Redaction is field-name based and applies uniformly to three surfaces: the
``changes`` diff, the ``metadata`` bag, and the redactable **top-level scalar
fields** of the event (e.g. ``ip_address``, ``actor_id``, ``resource_id``). A
field named in ``base_fields``/``redact_fields`` is scrubbed wherever it appears
— so naming ``ip_address`` actually masks ``event.ip_address``, not just a key
that happens to live inside ``changes``/``metadata``.

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

# Top-level event fields eligible for name-based redaction. The immutable
# correlation/identity scaffolding (timestamp, request_id, action) is excluded
# so a stray field name can't blank out fields the pipeline relies on.
_REDACTABLE_FIELDS = ("actor_id", "resource_type", "resource_id", "ip_address")


class RedactMiddleware:
    """Sanitises ``changes``, ``metadata`` and top-level fields via :class:`Redactor`."""

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
                **self._redact_top_level(event, fields),
            )
        await next()

    def _redact_top_level(self, event: AuditEvent, fields: list[str]) -> dict:
        """Return the subset of top-level fields whose value the redactor changed."""
        present = {
            name: getattr(event, name)
            for name in _REDACTABLE_FIELDS
            if getattr(event, name) is not None
        }
        if not present:
            return {}
        redacted = self._redactor.redact(present, fields)
        # Only pass through fields the redactor actually touched, so unrelated
        # fields keep their exact original value (and type).
        return {k: v for k, v in redacted.items() if k in present and v != present[k]}
