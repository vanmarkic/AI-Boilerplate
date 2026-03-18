"""Add game_mode column to tfc_exercises.

Revision ID: 003_add_game_mode
Revises: 002_domain_configs
Create Date: 2026-03-17
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "003_add_game_mode"
down_revision: str | None = "002_domain_configs"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "tfc_exercises",
        sa.Column(
            "game_mode",
            sa.String(50),
            nullable=False,
            server_default="classic",
        ),
    )


def downgrade() -> None:
    op.drop_column("tfc_exercises", "game_mode")
