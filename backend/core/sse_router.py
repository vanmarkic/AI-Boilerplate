"""Generic SSE endpoint: GET /api/events/{channel}

Any authenticated client can subscribe to a named channel and receive
real-time JSON payloads via Server-Sent Events.

The channel name is validated against an allow-list that features
register at import time (see `register_channel`). Unregistered channels
return 404 — this prevents arbitrary LISTEN on the Postgres connection.

Channel names are exposed as an enum in the OpenAPI spec so the
generated TypeScript client gets a typed union.
"""

import logging
from collections.abc import AsyncGenerator
from typing import Annotated

from fastapi import APIRouter, Path, Request, status
from fastapi.responses import StreamingResponse

from core.sse import event_bus

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/events", tags=["events"])

# Channel registry — features call register_channel() at module level.
_allowed_channels: dict[str, str] = {}


def register_channel(name: str, *, description: str = "") -> None:
    """Whitelist a channel name so clients can subscribe to it.

    Call this at module level in a feature's router or service module:

        from core.sse_router import register_channel
        register_channel("comments", description="New comment notifications")
    """
    _allowed_channels[name] = description


def get_allowed_channels() -> dict[str, str]:
    """Return a copy of registered channels (useful for introspection)."""
    return dict(_allowed_channels)


def patch_channel_enum(openapi_schema: dict) -> dict:
    """Inject registered channel names as an enum into the OpenAPI spec.

    Called from the OpenAPI export command *after* all routers are
    discovered, so every register_channel() call has already executed.
    """
    paths = openapi_schema.get("paths", {})
    channel_path = paths.get("/api/events/{channel}", {})
    for method_spec in channel_path.values():
        if not isinstance(method_spec, dict):
            continue
        for param in method_spec.get("parameters", []):
            if param.get("name") == "channel" and param.get("in") == "path":
                param["schema"] = {
                    "type": "string",
                    "enum": sorted(_allowed_channels.keys()),
                    "description": "Available SSE channels: "
                    + ", ".join(
                        f"{k} ({v})" if v else k
                        for k, v in sorted(_allowed_channels.items())
                    ),
                }
    return openapi_schema


@router.get(
    "/{channel}",
    response_class=StreamingResponse,
    summary="Subscribe to real-time events on a channel",
    operation_id="subscribeToChannel",
)
async def subscribe(
    channel: Annotated[str, Path(description="SSE channel name")],
    request: Request,
) -> StreamingResponse:
    """Stream events to the client via SSE."""
    if channel not in _allowed_channels:
        return StreamingResponse(
            content=f'data: {{"error": "unknown channel: {channel}"}}\n\n',
            status_code=status.HTTP_404_NOT_FOUND,
            media_type="text/event-stream",
        )

    async def _stream() -> AsyncGenerator[bytes, None]:
        async for payload in event_bus.subscribe(channel):
            if await request.is_disconnected():
                break
            yield f"data: {payload}\n\n".encode()

    return StreamingResponse(
        _stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@router.get(
    "",
    summary="List available SSE channels",
    operation_id="listChannels",
)
async def list_channels() -> dict[str, str]:
    """Return all registered channels and their descriptions."""
    return get_allowed_channels()
