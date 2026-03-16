"""Add role_permissions table with seed data.

Revision ID: 001
Revises: None
Create Date: 2026-03-16

"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "001"
down_revision: str | Sequence[str] | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Create role_permissions table and seed initial data."""
    role_permissions = op.create_table(
        "role_permissions",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("role", sa.String(50), nullable=False, index=True),
        sa.Column("route_pattern", sa.String(255), nullable=False),
        sa.Column("method", sa.String(10), nullable=False),
        sa.Column("frontend_route", sa.String(255), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(),
            server_default=sa.func.now(),
            nullable=False,
        ),
    )

    op.bulk_insert(
        role_permissions,
        [
            # admin: wildcard access to all API routes
            {
                "role": "admin",
                "route_pattern": "/api/**",
                "method": "*",
                "frontend_route": None,
            },
            # role_manager: permission management only
            {
                "role": "role_manager",
                "route_pattern": "/api/admin/permissions",
                "method": "GET",
                "frontend_route": "/admin",
            },
            {
                "role": "role_manager",
                "route_pattern": "/api/admin/permissions",
                "method": "POST",
                "frontend_route": "/admin",
            },
            {
                "role": "role_manager",
                "route_pattern": "/api/admin/permissions/*",
                "method": "PUT",
                "frontend_route": "/admin",
            },
            {
                "role": "role_manager",
                "route_pattern": "/api/admin/permissions/*",
                "method": "DELETE",
                "frontend_route": "/admin",
            },
            {
                "role": "role_manager",
                "route_pattern": "/api/admin/permissions/reload",
                "method": "POST",
                "frontend_route": None,
            },
            {
                "role": "role_manager",
                "route_pattern": "/api/me/*",
                "method": "GET",
                "frontend_route": None,
            },
            # user: standard routes
            {
                "role": "user",
                "route_pattern": "/api/users/*",
                "method": "GET",
                "frontend_route": None,
            },
            {
                "role": "user",
                "route_pattern": "/api/me/*",
                "method": "GET",
                "frontend_route": "/dashboard",
            },
            {
                "role": "user",
                "route_pattern": "/api/me/*",
                "method": "GET",
                "frontend_route": "/profile",
            },
        ],
    )


def downgrade() -> None:
    """Drop role_permissions table."""
    op.drop_table("role_permissions")
