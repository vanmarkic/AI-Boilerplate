"""The pipe-and-filter pipeline orchestrator.

A :class:`Pipeline` is an ordered list of middlewares. Each middleware
implements :class:`AuditMiddleware` — ``process(event, context, next)`` — and
calls ``await next()`` to pass control downstream. A middleware can:

* short-circuit by *not* calling ``next`` (or by setting ``context.halt()``),
* wrap downstream work by doing things before and after ``await next()``.

The pipeline is the only place that knows the chain exists; fan-out (to many
sinks or channels) happens *inside* individual middlewares via the event bus,
never by branching the chain.

Zero dependencies beyond the standard library and ``typing``.
"""

from __future__ import annotations

from typing import Awaitable, Callable, Protocol, runtime_checkable

from audit_framework.core.models import AuditEvent, PipelineContext

__all__ = ["AuditMiddleware", "Pipeline", "NextCallable"]

# The continuation a middleware awaits to invoke the rest of the chain.
NextCallable = Callable[[], Awaitable[None]]


@runtime_checkable
class AuditMiddleware(Protocol):
    """One stage of the pipeline.

    Implementations MUST either call ``await next()`` exactly once to continue
    the chain, or deliberately stop it (by returning early and/or calling
    ``context.halt()``). They MUST NOT call ``next`` more than once.
    """

    async def process(
        self,
        event: AuditEvent,
        context: PipelineContext,
        next: NextCallable,
    ) -> None:
        """Process ``event``, optionally awaiting ``next()`` to continue."""
        ...


class Pipeline:
    """Builds and runs an ordered middleware chain over a single event."""

    def __init__(self) -> None:
        self._middlewares: list[AuditMiddleware] = []

    def use(self, middleware: AuditMiddleware) -> "Pipeline":
        """Append ``middleware`` to the chain. Returns ``self`` for chaining."""
        self._middlewares.append(middleware)
        return self

    @property
    def middlewares(self) -> tuple[AuditMiddleware, ...]:
        """The middlewares in execution order (read-only)."""
        return tuple(self._middlewares)

    async def execute(self, event: AuditEvent) -> PipelineContext:
        """Run ``event`` through every middleware and return the final context.

        A fresh :class:`PipelineContext` is created per call, so a pipeline is
        safe to reuse concurrently across events. If any middleware sets
        ``context.halt()``, the chain stops *before* the next middleware runs.

        The event handed to each middleware is read from ``context.event`` at
        invocation time, so a middleware may *transform* the event in flight
        (e.g. redaction via ``dataclasses.replace``) and downstream middlewares
        will observe the new version.
        """
        context = PipelineContext(event=event)
        await self._run_from(0, context)
        return context

    async def _run_from(self, index: int, context: PipelineContext) -> None:
        if index >= len(self._middlewares) or context.halted:
            return
        middleware = self._middlewares[index]

        async def _next() -> None:
            await self._run_from(index + 1, context)

        await middleware.process(context.event, context, _next)
