"""The ``@auditable`` decorator — the primary developer-facing API.

Annotate a service-layer coroutine and every successful call is turned into an
:class:`AuditEvent` and pushed through the configured :class:`Pipeline`::

    @auditable(action="UPDATE", resource_type="contract", resource_id="contract_id")
    async def update_contract(self, contract_id: str, **changes): ...

Ambient ``actor_id`` / ``request_id`` / ``ip_address`` are read from
``contextvars`` that the framework's ASGI middleware populates per request, so
the service method itself stays free of audit plumbing. The pipeline is
resolved lazily through a pluggable provider, keeping the core decoupled from
how the application wires things together.

Zero dependencies beyond the standard library and ``typing``.
"""

from __future__ import annotations

import functools
import inspect
import uuid
from contextvars import ContextVar
from datetime import datetime, timezone
from typing import Any, Awaitable, Callable, Optional

from audit_framework.core.models import AuditEvent
from audit_framework.core.pipeline import Pipeline

__all__ = [
    "auditable",
    "set_pipeline_provider",
    "set_actor_context",
    "reset_actor_context",
    "current_actor",
]

# Ambient per-request actor context (set by the ASGI middleware).
_actor_id: ContextVar[Optional[str]] = ContextVar("audit_actor_id", default=None)
_request_id: ContextVar[Optional[str]] = ContextVar("audit_request_id", default=None)
_ip_address: ContextVar[Optional[str]] = ContextVar("audit_ip_address", default=None)

# How the decorator finds the pipeline to run. Replaced at bootstrap time.
_PipelineProvider = Callable[[], Optional[Pipeline]]
_pipeline_provider: _PipelineProvider = lambda: None


def set_pipeline_provider(provider: _PipelineProvider) -> None:
    """Install the callable used to resolve the active :class:`Pipeline`.

    The provider is called on every audited invocation. Returning ``None``
    disables auditing (the decorated method runs untouched) — useful in tests.
    """
    global _pipeline_provider
    _pipeline_provider = provider


def set_actor_context(
    *,
    actor_id: Optional[str] = None,
    request_id: Optional[str] = None,
    ip_address: Optional[str] = None,
) -> tuple[Any, Any, Any]:
    """Set the ambient actor context; return reset tokens for restoration."""
    return (
        _actor_id.set(actor_id),
        _request_id.set(request_id),
        _ip_address.set(ip_address),
    )


def reset_actor_context(tokens: tuple[Any, Any, Any]) -> None:
    """Restore the actor context from tokens returned by :func:`set_actor_context`."""
    actor_tok, request_tok, ip_tok = tokens
    _actor_id.reset(actor_tok)
    _request_id.reset(request_tok)
    _ip_address.reset(ip_tok)


def current_actor() -> Optional[str]:
    """Return the ambient actor id, or None when outside a request scope."""
    return _actor_id.get()


def _utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _resolve(
    spec: Optional[Any], bound: dict[str, Any], result: Any, default: str
) -> str:
    """Resolve a ``resource_id``-style spec to a string.

    * callable  -> ``spec(bound, result)``
    * arg name  -> value of that bound argument
    * otherwise -> the literal value (or ``default`` when ``spec`` is None)
    """
    if spec is None:
        return default
    if callable(spec):
        return str(spec(bound, result))
    if isinstance(spec, str) and spec in bound:
        return str(bound[spec])
    return str(spec)


def auditable(
    *,
    action: str,
    resource_type: str,
    resource_id: Optional[Any] = None,
    changes: Optional[Callable[[dict[str, Any], Any], dict[str, Any]]] = None,
    metadata: Optional[dict[str, Any]] = None,
    actor_id: Optional[Any] = None,
) -> Callable[[Callable[..., Awaitable[Any]]], Callable[..., Awaitable[Any]]]:
    """Decorate an async service method so its calls are audited.

    Parameters
    ----------
    action, resource_type:
        Constant descriptors copied onto every emitted event.
    resource_id:
        Argument name, ``(bound, result) -> str`` callable, or literal used to
        identify the affected resource. Defaults to ``""`` if unresolved.
    changes:
        Optional ``(bound, result) -> dict`` producing the before/after diff.
    metadata:
        Static metadata merged into every event's ``metadata`` bag.
    actor_id:
        Override for the actor; same resolution rules as ``resource_id``. When
        omitted, the ambient request actor is used.

    The audit event is emitted **after** the wrapped coroutine returns
    successfully — a raising method is never recorded as a completed action.
    """

    def decorator(
        func: Callable[..., Awaitable[Any]]
    ) -> Callable[..., Awaitable[Any]]:
        if not inspect.iscoroutinefunction(func):
            raise TypeError("@auditable can only decorate async functions")
        signature = inspect.signature(func)

        @functools.wraps(func)
        async def wrapper(*args: Any, **kwargs: Any) -> Any:
            result = await func(*args, **kwargs)
            pipeline = _pipeline_provider()
            if pipeline is not None:
                await _emit(pipeline, signature, args, kwargs, result)
            return result

        return wrapper

    def _build_event(
        signature: inspect.Signature,
        args: tuple[Any, ...],
        kwargs: dict[str, Any],
        result: Any,
    ) -> AuditEvent:
        try:
            bound_args = signature.bind_partial(*args, **kwargs)
            bound = dict(bound_args.arguments)
        except TypeError:
            bound = dict(kwargs)
        # An explicit actor_id spec wins even when it resolves to a falsy value
        # (e.g. "" for an anonymous actor); only fall back to the ambient/system
        # actor when no actor_id override was given.
        if actor_id is not None:
            resolved_actor = _resolve(actor_id, bound, result, "")
        else:
            resolved_actor = _actor_id.get() or "system"
        return AuditEvent(
            actor_id=resolved_actor,
            action=action,
            resource_type=resource_type,
            resource_id=_resolve(resource_id, bound, result, ""),
            timestamp=_utc_now_iso(),
            request_id=_request_id.get() or str(uuid.uuid4()),
            changes=changes(bound, result) if changes else {},
            ip_address=_ip_address.get(),
            metadata=dict(metadata) if metadata else {},
        )

    async def _emit(
        pipeline: Pipeline,
        signature: inspect.Signature,
        args: tuple[Any, ...],
        kwargs: dict[str, Any],
        result: Any,
    ) -> None:
        await pipeline.execute(_build_event(signature, args, kwargs, result))

    return decorator
