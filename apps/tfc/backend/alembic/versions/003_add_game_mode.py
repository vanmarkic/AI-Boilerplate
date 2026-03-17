"""Add game_mode column to tfc_exercises.

Revision ID: 003_add_game_mode
Revises: 002_domain_configs
Create Date: 2026-03-17
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "003_add_game_mode"
down_revision: Union[str, None] = "002_domain_configs"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


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
