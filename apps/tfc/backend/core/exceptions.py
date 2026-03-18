"""Domain exceptions for the TFC service layer.

Services raise these instead of FastAPI's HTTPException so that
business logic stays framework-agnostic.  The exception handler
registered in ``core/middleware.py`` translates them into JSON
responses with the appropriate HTTP status code.

Pattern mirrors ``apps/main/backend/core/exceptions.py``.
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


class BadRequestError(AppError):
    """Invalid input or business-rule violation (400)."""

    def __init__(self, detail: str = "Bad request") -> None:
        super().__init__(detail, status_code=400)


class EngineError(AppError):
    """Engine operation failed (422).

    Use for engine-specific errors such as invalid state transitions
    or attempting actions on a non-running exercise.
    """

    def __init__(self, detail: str = "Engine operation failed") -> None:
        super().__init__(detail, status_code=422)
