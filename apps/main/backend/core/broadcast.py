"""Decorator to broadcast a service method's return value over SSE.

Usage in a service:

    from core.broadcast import broadcast

    class CommentService:
        @broadcast("comments")
        async def create_comment(self, request: CreateCommentRequest) -> CommentResponse:
            ...
            return CommentResponse.model_validate(entity)

After the method returns successfully, the decorator publishes the
Pydantic model (serialised to JSON) on the given pg NOTIFY channel.
The original return value is passed through unchanged.

Supports:
  - Static channel name:  @broadcast("comments")
  - Dynamic channel via kwarg:  @broadcast(channel_kwarg="room_id", prefix="room")
    → publishes on "room:42" when room_id=42
"""

import functools
import logging
from collections.abc import Callable, Coroutine
from typing import Any, ParamSpec, TypeVar

from pydantic import BaseModel

from core.sse import event_bus

logger = logging.getLogger(__name__)

P = ParamSpec("P")
R = TypeVar("R")


def broadcast(
    channel: str | None = None,
    *,
    channel_kwarg: str | None = None,
    prefix: str | None = None,
) -> Callable[
    [Callable[P, Coroutine[Any, Any, R]]],
    Callable[P, Coroutine[Any, Any, R]],
]:
    """Decorator that publishes the return value to an SSE channel.

    Args:
        channel: Static channel name (e.g. "comments").
        channel_kwarg: Name of a kwarg whose value is appended to *prefix*
                       to form a dynamic channel (e.g. room_id → "room:42").
        prefix: Prefix used with *channel_kwarg*.
    """
    if channel is None and channel_kwarg is None:
        raise ValueError("Provide either `channel` or `channel_kwarg`")

    def decorator(
        fn: Callable[P, Coroutine[Any, Any, R]],
    ) -> Callable[P, Coroutine[Any, Any, R]]:
        @functools.wraps(fn)
        async def wrapper(*args: P.args, **kwargs: P.kwargs) -> R:
            result = await fn(*args, **kwargs)

            resolved_channel = channel
            if channel_kwarg is not None:
                key = kwargs.get(channel_kwarg)
                if key is None:
                    logger.warning(
                        "broadcast: kwarg '%s' missing, skipping publish",
                        channel_kwarg,
                    )
                    return result
                resolved_channel = f"{prefix}:{key}" if prefix else str(key)

            if resolved_channel is None:
                return result

            payload: dict[str, Any]
            if isinstance(result, BaseModel):
                payload = result.model_dump(mode="json")
            elif isinstance(result, dict):
                payload = result
            else:
                payload = {"data": result}

            try:
                await event_bus.publish(resolved_channel, payload)
            except Exception:
                logger.exception("broadcast: failed to publish on '%s'", resolved_channel)

            return result

        return wrapper

    return decorator
