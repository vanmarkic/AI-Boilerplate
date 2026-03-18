"""Add practice_mode column to tfc_exercises.

Revision ID: 006_add_practice_mode
Revises: 005_update_default_terminology
Create Date: 2026-03-18
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "006_add_practice_mode"
down_revision: str | None = "005_update_default_terminology"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "tfc_exercises",
        sa.Column("practice_mode", sa.Boolean(), nullable=False, server_default=sa.text("false")),
    )


def downgrade() -> None:
    op.drop_column("tfc_exercises", "practice_mode")
