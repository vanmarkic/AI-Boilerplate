from unittest.mock import AsyncMock

import pytest

from core.auth import CurrentUser
from features.admin_users.admin_users_service import (
    PROTECTED_ROLES,
    UNDELETABLE_ROLES,
    AdminUsersService,
)


def _make_user(roles: list[str]) -> CurrentUser:
    return CurrentUser(id="u1", email="test@test.dev", roles=roles)


def _mock_kc() -> AsyncMock:
    kc = AsyncMock()
    kc.list_users.return_value = [
        {"id": "uid1", "username": "alice", "email": "a@b.c", "enabled": True}
    ]
    kc.count_users.return_value = 1
    kc.get_user_roles.return_value = [{"id": "r1", "name": "user"}]
    kc.get_role_by_name.return_value = {"id": "r1", "name": "user"}
    kc.list_realm_roles.return_value = [
        {"id": "r1", "name": "admin", "description": ""},
        {"id": "r2", "name": "user", "description": ""},
    ]
    kc.create_realm_role.return_value = {
        "id": "r3",
        "name": "custom",
        "description": "desc",
    }
    return kc


class TestListUsers:
    async def test_returns_users_with_roles(self) -> None:
        kc = _mock_kc()
        svc = AdminUsersService(kc)
        result = await svc.list_users(None, 0, 50)
        assert result.total == 1
        assert result.users[0].username == "alice"
        assert result.users[0].roles == ["user"]


class TestAssignRoles:
    async def test_admin_can_assign_protected_roles(self) -> None:
        kc = _mock_kc()
        svc = AdminUsersService(kc)
        admin = _make_user(["admin"])
        await svc.assign_roles("uid1", ["admin"], admin)
        kc.assign_roles.assert_called_once()

    async def test_role_manager_can_assign_non_protected(self) -> None:
        kc = _mock_kc()
        svc = AdminUsersService(kc)
        mgr = _make_user(["role_manager"])
        await svc.assign_roles("uid1", ["user"], mgr)
        kc.assign_roles.assert_called_once()

    async def test_role_manager_blocked_from_protected(self) -> None:
        kc = _mock_kc()
        svc = AdminUsersService(kc)
        mgr = _make_user(["role_manager"])
        with pytest.raises(Exception, match="protected roles"):
            await svc.assign_roles("uid1", ["admin"], mgr)

    async def test_regular_user_blocked(self) -> None:
        kc = _mock_kc()
        svc = AdminUsersService(kc)
        user = _make_user(["user"])
        with pytest.raises(Exception, match="admin or role_manager"):
            await svc.assign_roles("uid1", ["user"], user)


class TestRemoveRoles:
    async def test_admin_can_remove_protected(self) -> None:
        kc = _mock_kc()
        svc = AdminUsersService(kc)
        admin = _make_user(["admin"])
        await svc.remove_roles("uid1", ["role_manager"], admin)
        kc.remove_roles.assert_called_once()

    async def test_role_manager_blocked_from_removing_protected(self) -> None:
        kc = _mock_kc()
        svc = AdminUsersService(kc)
        mgr = _make_user(["role_manager"])
        with pytest.raises(Exception, match="protected roles"):
            await svc.remove_roles("uid1", ["admin"], mgr)


class TestCreateRole:
    async def test_admin_can_create(self) -> None:
        kc = _mock_kc()
        svc = AdminUsersService(kc)
        admin = _make_user(["admin"])
        result = await svc.create_role("custom", "desc", admin)
        assert result.name == "custom"
        kc.create_realm_role.assert_called_once_with("custom", "desc")

    async def test_non_admin_blocked(self) -> None:
        kc = _mock_kc()
        svc = AdminUsersService(kc)
        mgr = _make_user(["role_manager"])
        with pytest.raises(Exception, match="Only admin"):
            await svc.create_role("custom", "desc", mgr)


class TestDeleteRole:
    async def test_admin_can_delete_custom(self) -> None:
        kc = _mock_kc()
        svc = AdminUsersService(kc)
        admin = _make_user(["admin"])
        await svc.delete_role("custom_role", admin)
        kc.delete_realm_role.assert_called_once_with("custom_role")

    async def test_cannot_delete_protected(self) -> None:
        kc = _mock_kc()
        svc = AdminUsersService(kc)
        admin = _make_user(["admin"])
        for role in UNDELETABLE_ROLES:
            with pytest.raises(Exception, match="protected role"):
                await svc.delete_role(role, admin)

    async def test_non_admin_blocked(self) -> None:
        kc = _mock_kc()
        svc = AdminUsersService(kc)
        user = _make_user(["user"])
        with pytest.raises(Exception, match="Only admin"):
            await svc.delete_role("custom", user)


class TestProtectedRolesConstant:
    def test_protected_roles_defined(self) -> None:
        assert "admin" in PROTECTED_ROLES
        assert "role_manager" in PROTECTED_ROLES
