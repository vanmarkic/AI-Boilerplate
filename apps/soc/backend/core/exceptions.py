"""HTTP-facing errors and the domain → HTTP translation table.

The domain raises framework-free ``DomainError`` subclasses (see
``domain/soc_error.py``).  This module is the only place that knows what
those mean in HTTP terms, which is what keeps status codes out of the core.
"""

from domain.soc_error import (
    ConflictingStateError,
    DomainError,
    IntegrationAuthError,
    IntegrationRejectedError,
    IntegrationUnavailableError,
    InvalidIndicatorError,
    PolicyViolationError,
    UnknownEntityError,
)


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
    """Malformed or unacceptable request (400)."""

    def __init__(self, detail: str = "Bad request") -> None:
        super().__init__(detail, status_code=400)


# Most specific first — resolution walks this in order.
_DOMAIN_STATUS_MAP: tuple[tuple[type[DomainError], int], ...] = (
    (UnknownEntityError, 404),
    (ConflictingStateError, 409),
    (InvalidIndicatorError, 422),
    (PolicyViolationError, 422),
    (IntegrationAuthError, 502),
    (IntegrationRejectedError, 502),
    (IntegrationUnavailableError, 503),
)

_DEFAULT_DOMAIN_STATUS = 500


def domain_error_status(exc: DomainError) -> int:
    """Return the HTTP status code that represents a domain error."""
    for error_type, status_code in _DOMAIN_STATUS_MAP:
        if isinstance(exc, error_type):
            return status_code
    return _DEFAULT_DOMAIN_STATUS
