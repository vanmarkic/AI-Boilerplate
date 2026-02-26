from dataclasses import dataclass


@dataclass(frozen=True)
class CurrentUser:
    """Represents the authenticated user. STUB implementation."""

    id: str
    email: str
    roles: list[str]


async def get_current_user() -> CurrentUser:
    """STUB: Replace with real auth (Keycloak, JWT, OAuth2).

    Swap this function body to integrate real authentication.
    All endpoints using Depends(get_current_user) will automatically
    use the new implementation.
    """
    return CurrentUser(
        id="stub-user-1",
        email="dev@local.dev",
        roles=["admin"],
    )
