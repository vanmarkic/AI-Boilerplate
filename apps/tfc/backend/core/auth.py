"""Authentication is disabled for TFC.

get_current_user returns a stub identity so existing code that
depends on it continues to work without changes.
"""

from dataclasses import dataclass


@dataclass(frozen=True)
class CurrentUser:
    """Represents the current user (stub — no auth)."""

    id: str = "anonymous"
    email: str = ""
    roles: list[str] = ()  # type: ignore[assignment]


async def get_current_user() -> CurrentUser:
    """Return a default anonymous user (no authentication)."""
    return CurrentUser()
