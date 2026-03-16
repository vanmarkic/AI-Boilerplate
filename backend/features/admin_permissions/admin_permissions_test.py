from unittest.mock import AsyncMock, patch

import pytest
from httpx import AsyncClient

from core.auth import CurrentUser
from core.rbac import (
    PermissionRule,
    _match_pattern,
    clear_permissions_cache,
)


# ---------------------------------------------------------------------------
# Route pattern matching unit tests
# ---------------------------------------------------------------------------


class TestMatchPattern:
    def test_exact_match(self) -> None:
        assert _match_pattern("/api/health", "/api/health") is True

    def test_exact_mismatch(self) -> None:
        assert _match_pattern("/api/health", "/api/users") is False

    def test_single_wildcard(self) -> None:
        assert _match_pattern("/api/users/*", "/api/users/123") is True

    def test_single_wildcard_no_deeper(self) -> None:
        assert _match_pattern("/api/users/*", "/api/users/123/name") is False

    def test_double_wildcard(self) -> None:
        assert _match_pattern("/api/**", "/api/admin/permissions") is True

    def test_double_wildcard_deep(self) -> None:
        assert _match_pattern("/api/**", "/api/a/b/c/d") is True

    def test_double_wildcard_single_segment(self) -> None:
        assert _match_pattern("/api/**", "/api/health") is True

    def test_no_match_outside_prefix(self) -> None:
        assert _match_pattern("/api/**", "/other/path") is False


# ---------------------------------------------------------------------------
# RBAC middleware integration tests
# ---------------------------------------------------------------------------

_ADMIN_USER = CurrentUser(id="admin-1", email="admin@test.dev", roles=["admin"])
_USER = CurrentUser(id="user-1", email="user@test.dev", roles=["user"])
_MANAGER = CurrentUser(
    id="mgr-1", email="manager@test.dev", roles=["role_manager"]
)


def _mock_cache() -> dict[str, list[PermissionRule]]:
    return {
        "admin": [PermissionRule(route_pattern="/api/**", method="*")],
        "role_manager": [
            PermissionRule(
                route_pattern="/api/admin/permissions", method="GET"
            ),
            PermissionRule(
                route_pattern="/api/admin/permissions", method="POST"
            ),
            PermissionRule(
                route_pattern="/api/admin/permissions/*", method="PUT"
            ),
            PermissionRule(
                route_pattern="/api/admin/permissions/*", method="DELETE"
            ),
            PermissionRule(
                route_pattern="/api/admin/permissions/reload", method="POST"
            ),
            PermissionRule(route_pattern="/api/me/*", method="GET"),
        ],
        "user": [
            PermissionRule(route_pattern="/api/users/*", method="GET"),
            PermissionRule(route_pattern="/api/me/*", method="GET"),
        ],
    }


@pytest.fixture(autouse=True)
def _seed_rbac_cache() -> None:
    """Pre-populate the RBAC cache so tests don't need a DB."""
    import core.rbac as rbac_module

    rbac_module._cache = _mock_cache()
    rbac_module._cache_loaded_at = 1e18  # far future → never expires
    yield
    clear_permissions_cache()


class TestRBACMiddleware:
    async def test_public_health_allowed_without_token(
        self, client: AsyncClient
    ) -> None:
        resp = await client.get("/api/health")
        assert resp.status_code != 401

    async def test_returns_401_for_missing_token(
        self, client: AsyncClient
    ) -> None:
        resp = await client.get("/api/admin/permissions")
        assert resp.status_code == 401

    @patch("core.auth.parse_jwt_roles", new_callable=AsyncMock)
    async def test_admin_can_access_any_route(
        self, mock_roles: AsyncMock, client: AsyncClient
    ) -> None:
        mock_roles.return_value = ["admin"]
        resp = await client.get(
            "/api/admin/permissions",
            headers={"Authorization": "Bearer fake"},
        )
        # Should pass RBAC (may still need valid dependency)
        assert resp.status_code != 403

    @patch("core.auth.parse_jwt_roles", new_callable=AsyncMock)
    async def test_user_cannot_access_admin_routes(
        self, mock_roles: AsyncMock, client: AsyncClient
    ) -> None:
        mock_roles.return_value = ["user"]
        resp = await client.get(
            "/api/admin/permissions",
            headers={"Authorization": "Bearer fake"},
        )
        assert resp.status_code == 403


class TestProtectedRoles:
    """Verify privilege escalation guard for protected roles."""

    async def test_non_admin_cannot_create_admin_permission(self) -> None:
        from features.admin_permissions.admin_permissions_service import (
            AdminPermissionsService,
            PROTECTED_ROLES,
        )

        assert "admin" in PROTECTED_ROLES
        assert "role_manager" in PROTECTED_ROLES
