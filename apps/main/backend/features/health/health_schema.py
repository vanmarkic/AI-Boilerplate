from core.base_schema import ResponseBase


class HealthResponse(ResponseBase):
    status: str
    version: str
