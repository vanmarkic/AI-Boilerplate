"""Health response bodies."""

from core.base_schema import ResponseBase


class HealthResponse(ResponseBase):
    """Simple liveness answer."""

    status: str


class AdapterBindingResponse(ResponseBase):
    """Which implementation is bound to each outbound port."""

    providers: dict[str, str]
