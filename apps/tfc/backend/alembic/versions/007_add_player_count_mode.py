"""Add player_count_mode column to tfc_exercises.

Revision ID: 007_add_player_count_mode
Revises: 00fb7a3af6bd
Create Date: 2026-03-23
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "007_add_player_count_mode"
down_revision: str | None = "00fb7a3af6bd"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "tfc_exercises",
        sa.Column(
            "player_count_mode",
            sa.String(20),
            nullable=False,
            server_default=sa.text("'full'"),
        ),
    )


def downgrade() -> None:
    op.drop_column("tfc_exercises", "player_count_mode")
