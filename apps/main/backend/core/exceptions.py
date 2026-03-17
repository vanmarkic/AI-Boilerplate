"""Domain exceptions for the service layer.

Services raise these instead of FastAPI's HTTPException so that
business logic stays framework-agnostic.  The exception handler
registered in ``core/middleware.py`` translates them into JSON
responses with the appropriate HTTP status code.
"""


class AppError(Exception):
    """Base application error with an HTTP status code."""

    def __init__(self, detail: str, *, status_code: int = 500) -> None:
        self.detail = detail
        self.status_code = status_code
        super().__init__(detail)


class NotFoundError(AppError):
    """Resource not found (404)."""

    def __init__(self, detail: str = "Not found") -> None:
        super().__init__(detail, status_code=404)


class ConflictError(AppError):
    """Resource conflict (409)."""

    def __init__(self, detail: str = "Conflict") -> None:
        super().__init__(detail, status_code=409)


class ForbiddenError(AppError):
    """Insufficient permissions (403)."""

    def __init__(self, detail: str = "Forbidden") -> None:
        super().__init__(detail, status_code=403)
