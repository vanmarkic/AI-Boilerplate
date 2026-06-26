"""SinkFanOutMiddleware — forward the event to external sinks in parallel.

Fan-out (one event → many SIEM/log platforms) happens here, *inside* the
middleware, via ``asyncio.gather`` — never by branching the chain. Delivery is
best-effort: ``return_exceptions=True`` ensures one failing sink never blocks
the others or aborts the pipeline. Per-policy sink filtering is honoured: when
``AuditPolicy.sinks`` is set, only those named sinks receive the event.
"""

from __future__ import annotations

import asyncio

from audit_framework.core.models import AuditEvent, PipelineContext
from audit_framework.core.pipeline import NextCallable
from audit_framework.core.ports import ExternalSink

__all__ = ["SinkFanOutMiddleware"]


class SinkFanOutMiddleware:
    """Emits the event to every applicable :class:`ExternalSink` concurrently."""

    def __init__(self, sinks: list[ExternalSink]) -> None:
        self._sinks = list(sinks)

    async def process(
        self, event: AuditEvent, context: PipelineContext, next: NextCallable
    ) -> None:
        targets = self._select(context)
        if targets:
            results = await asyncio.gather(
                *(sink.emit(event, context) for sink in targets),
                return_exceptions=True,
            )
            self._record_failures(context, targets, results)
        await next()

    def _select(self, context: PipelineContext) -> list[ExternalSink]:
        policy = context.audit_policy
        allowed = policy.sinks if policy else None
        if allowed is None:
            return list(self._sinks)
        allowed_set = set(allowed)
        return [s for s in self._sinks if s.sink_name in allowed_set]

    @staticmethod
    def _record_failures(
        context: PipelineContext,
        targets: list[ExternalSink],
        results: list[object],
    ) -> None:
        failures = {
            sink.sink_name: str(result)
            for sink, result in zip(targets, results)
            if isinstance(result, Exception)
        }
        if failures:
            context.metadata["sink_failures"] = failures
