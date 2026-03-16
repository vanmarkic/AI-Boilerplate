"""Add RBAC permissions for admin_users endpoints.

Revision ID: 002
Revises: 001
Create Date: 2026-03-16

"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "002"
down_revision: str | Sequence[str] | None = "001"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Seed role_permissions for admin_users endpoints."""
    role_permissions = sa.table(
        "role_permissions",
        sa.column("role", sa.String),
        sa.column("route_pattern", sa.String),
        sa.column("method", sa.String),
        sa.column("frontend_route", sa.String),
    )

    op.bulk_insert(
        role_permissions,
        [
            # role_manager: user listing and role management
            {
                "role": "role_manager",
                "route_pattern": "/api/admin/users",
                "method": "GET",
                "frontend_route": "/admin",
            },
            {
                "role": "role_manager",
                "route_pattern": "/api/admin/users/*/roles",
                "method": "GET",
                "frontend_route": "/admin",
            },
            {
                "role": "role_manager",
                "route_pattern": "/api/admin/users/*/roles",
                "method": "POST",
                "frontend_route": "/admin",
            },
            {
                "role": "role_manager",
                "route_pattern": "/api/admin/users/*/roles",
                "method": "DELETE",
                "frontend_route": "/admin",
            },
            {
                "role": "role_manager",
                "route_pattern": "/api/admin/roles",
                "method": "GET",
                "frontend_route": "/admin",
            },
        ],
    )


def downgrade() -> None:
    """Remove admin_users permissions."""
    op.execute(
        "DELETE FROM role_permissions "
        "WHERE route_pattern LIKE '/api/admin/users%' "
        "OR (route_pattern = '/api/admin/roles' AND role = 'role_manager')"
    )
