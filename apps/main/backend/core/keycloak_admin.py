"""Keycloak Admin REST API client.

Wraps the Keycloak Admin REST API using httpx.AsyncClient.
Authenticates via client credentials grant and caches the token.
"""

import time

import httpx

from core.config import settings

_token_cache: dict[str, str | float] = {}


async def _get_admin_token() -> str:
    """Obtain a service account token, using cache if not expired."""
    now = time.time()
    if _token_cache.get("token") and now < float(_token_cache.get("expires_at", 0)):
        return str(_token_cache["token"])

    token_url = (
        f"{settings.keycloak_url}/realms/{settings.keycloak_realm}/protocol/openid-connect/token"
    )
    async with httpx.AsyncClient() as client:
        resp = await client.post(
            token_url,
            data={
                "grant_type": "client_credentials",
                "client_id": settings.keycloak_admin_client_id,
                "client_secret": settings.keycloak_admin_client_secret,
            },
        )
        resp.raise_for_status()

    data = resp.json()
    _token_cache["token"] = data["access_token"]
    _token_cache["expires_at"] = now + data.get("expires_in", 300) - 30
    return str(_token_cache["token"])


def _admin_base_url() -> str:
    """Return the base URL for Keycloak Admin REST API."""
    return f"{settings.keycloak_url}/admin/realms/{settings.keycloak_realm}"


class KeycloakAdminClient:
    """Async client for Keycloak Admin REST API operations."""

    async def _headers(self) -> dict[str, str]:
        token = await _get_admin_token()
        return {"Authorization": f"Bearer {token}"}

    async def list_users(
        self,
        search: str | None = None,
        first: int = 0,
        max_results: int = 50,
    ) -> list[dict[str, object]]:
        """List realm users with optional search."""
        params: dict[str, str | int] = {"first": first, "max": max_results}
        if search:
            params["search"] = search
        async with httpx.AsyncClient() as client:
            resp = await client.get(
                f"{_admin_base_url()}/users",
                headers=await self._headers(),
                params=params,
            )
            resp.raise_for_status()
        return resp.json()  # type: ignore[no-any-return]

    async def count_users(self, search: str | None = None) -> int:
        """Count total realm users."""
        params: dict[str, str] = {}
        if search:
            params["search"] = search
        async with httpx.AsyncClient() as client:
            resp = await client.get(
                f"{_admin_base_url()}/users/count",
                headers=await self._headers(),
                params=params,
            )
            resp.raise_for_status()
        return int(resp.text)

    async def get_user_roles(self, user_id: str) -> list[dict[str, object]]:
        """Get realm role mappings for a user."""
        async with httpx.AsyncClient() as client:
            resp = await client.get(
                f"{_admin_base_url()}/users/{user_id}/role-mappings/realm",
                headers=await self._headers(),
            )
            resp.raise_for_status()
        return resp.json()  # type: ignore[no-any-return]

    async def assign_roles(self, user_id: str, roles: list[dict[str, str]]) -> None:
        """Assign realm roles to a user."""
        async with httpx.AsyncClient() as client:
            resp = await client.post(
                f"{_admin_base_url()}/users/{user_id}/role-mappings/realm",
                headers=await self._headers(),
                json=roles,
            )
            resp.raise_for_status()

    async def remove_roles(self, user_id: str, roles: list[dict[str, str]]) -> None:
        """Remove realm roles from a user."""
        async with httpx.AsyncClient() as client:
            resp = await client.request(
                "DELETE",
                f"{_admin_base_url()}/users/{user_id}/role-mappings/realm",
                headers=await self._headers(),
                json=roles,
            )
            resp.raise_for_status()

    async def list_realm_roles(self) -> list[dict[str, object]]:
        """List all realm roles."""
        async with httpx.AsyncClient() as client:
            resp = await client.get(
                f"{_admin_base_url()}/roles",
                headers=await self._headers(),
            )
            resp.raise_for_status()
        return resp.json()  # type: ignore[no-any-return]

    async def get_role_by_name(self, name: str) -> dict[str, object]:
        """Get a realm role by name."""
        async with httpx.AsyncClient() as client:
            resp = await client.get(
                f"{_admin_base_url()}/roles/{name}",
                headers=await self._headers(),
            )
            resp.raise_for_status()
        return resp.json()  # type: ignore[no-any-return]

    async def create_realm_role(self, name: str, description: str = "") -> dict[str, object]:
        """Create a new realm role."""
        async with httpx.AsyncClient() as client:
            resp = await client.post(
                f"{_admin_base_url()}/roles",
                headers=await self._headers(),
                json={"name": name, "description": description},
            )
            resp.raise_for_status()
        return await self.get_role_by_name(name)

    async def delete_realm_role(self, name: str) -> None:
        """Delete a realm role."""
        async with httpx.AsyncClient() as client:
            resp = await client.delete(
                f"{_admin_base_url()}/roles/{name}",
                headers=await self._headers(),
            )
            resp.raise_for_status()
